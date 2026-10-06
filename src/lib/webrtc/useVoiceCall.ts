"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface CallParticipant {
  userId: number;
  username: string | null;
  firstName: string;
  photoUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isHost: boolean;
  connectionState: "connecting" | "connected" | "failed";
}

type SignalType = "offer" | "answer" | "ice" | "join" | "leave" | "mute" | "kick";

interface SignalMessage {
  id: number;
  from_user_id: number;
  to_user_id: number | null;
  type: SignalType;
  payload: Record<string, unknown>;
  created_at: string;
}

interface Props {
  roomId: string;
  userId: number;
  /** Announced in the join signal so others render the crown */
  isHost?: boolean;
  userInfo: { username: string | null; firstName: string; photoUrl: string | null };
}

/**
 * useVoiceCall — WebRTC mesh voice call with Discord-style features.
 *
 * - Auto-joins on mount (voice-first rooms)
 * - Speaking detection via Web Audio AnalyserNode (local + remote)
 * - Host moderation: force-mute / kick via call_signals ('mute' | 'kick')
 * - Signaling via Supabase Realtime on call_signals table
 */
export function useVoiceCall({ roomId, userId, isHost, userInfo }: Props) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  /** Force-muted by the host — user cannot unmute until host mutes someone else/unmutes */
  const [forceMuted, setForceMuted] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "pending">("pending");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const lastSignalIdRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedRef = useRef<boolean>(false);
  const forceMutedRef = useRef<boolean>(false);
  /** Short-lived TTL signaling token (issued on join, auto-refreshed on 401) */
  const voiceTokenRef = useRef<string | null>(null);

  // ── Speaking detection (Web Audio) ─────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<number, { analyser: AnalyserNode; data: Uint8Array; lastLevel: number }>>(new Map());
  const speakingLoopRef = useRef<number>(0);
  /** Speaking state emitted externally — throttled updates */
  const speakingStateRef = useRef<Map<number, boolean>>(new Map());

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  /** Ensure an AudioContext exists (resume on iOS after user gesture) */
  const ensureAudioContext = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  /** Attach an analyser to a MediaStream for speaking detection */
  const attachAnalyser = useCallback(
    (stream: MediaStream, uid: number) => {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        // Clean up previous analyser for this user
        const prev = analysersRef.current.get(uid);
        if (prev) {
          try { prev.analyser.disconnect(); } catch { /* ignore */ }
          analysersRef.current.delete(uid);
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        // NOTE: do NOT connect analyser to destination (echo)
        analysersRef.current.set(uid, {
          analyser,
          data: new Uint8Array(analyser.frequencyBinCount),
          lastLevel: 0,
        });
      } catch (err) {
        console.error("[voice] attachAnalyser error:", err);
      }
    },
    [ensureAudioContext]
  );

  /** RMS loop — updates isSpeaking on participants (threshold + smoothing) */
  const startSpeakingLoop = useCallback(() => {
    if (speakingLoopRef.current) return;
    const tick = () => {
      const changed: number[] = [];
      for (const [uid, entry] of analysersRef.current) {
        entry.analyser.getByteTimeDomainData(entry.data);
        let sum = 0;
        for (let i = 0; i < entry.data.length; i++) {
          const v = (entry.data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / entry.data.length);
        // Smoothed level (attack fast, release slow)
        const smoothed = rms > entry.lastLevel ? rms : entry.lastLevel * 0.85 + rms * 0.15;
        entry.lastLevel = smoothed;
        const speaking = smoothed > 0.045;
        const prevSpeaking = speakingStateRef.current.get(uid) ?? false;
        if (speaking !== prevSpeaking) {
          speakingStateRef.current.set(uid, speaking);
          changed.push(uid);
        }
      }
      if (changed.length > 0) {
        setParticipants((prev) =>
          prev.map((p) =>
            changed.includes(p.userId) ? { ...p, isSpeaking: speakingStateRef.current.get(p.userId) ?? false } : p
          )
        );
      }
      speakingLoopRef.current = requestAnimationFrame(tick);
    };
    speakingLoopRef.current = requestAnimationFrame(tick);
  }, []);

  const stopSpeakingLoop = useCallback(() => {
    if (speakingLoopRef.current) {
      cancelAnimationFrame(speakingLoopRef.current);
      speakingLoopRef.current = 0;
    }
  }, []);

  // iOS/Safari: AudioContext needs a user gesture — add a one-time listener
  useEffect(() => {
    const resume = () => {
      ensureAudioContext();
      document.removeEventListener("touchstart", resume);
      document.removeEventListener("click", resume);
    };
    document.addEventListener("touchstart", resume, { passive: true });
    document.addEventListener("click", resume);
    return () => {
      document.removeEventListener("touchstart", resume);
      document.removeEventListener("click", resume);
    };
  }, [ensureAudioContext]);

  /** (Re)fetch the TTL voice token for signaling */
  const fetchVoiceToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/voice-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[voice] token error:", data.error);
        return null;
      }
      const data = await res.json();
      voiceTokenRef.current = data.token;
      return data.token;
    } catch {
      return null;
    }
  }, [roomId]);

  const sendSignal = useCallback(
    async (type: SignalType, payload: Record<string, unknown> = {}, toUserId?: number, retried = false) => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/signal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(voiceTokenRef.current ? { "x-voice-token": voiceTokenRef.current } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ type, payload, to_user_id: toUserId }),
        });
        // Token expired mid-call — refresh once and retry
        if (res.status === 401 && !retried) {
          const ok = await fetchVoiceToken();
          if (ok) {
            await sendSignal(type, payload, toUserId, true);
          }
        }
      } catch (err) {
        console.error("[voice] sendSignal error:", err);
      }
    },
    [roomId, fetchVoiceToken]
  );

  const updateParticipant = useCallback((remoteUserId: number, updates: Partial<CallParticipant>) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === remoteUserId);
      if (existing) {
        return prev.map((p) => (p.userId === remoteUserId ? { ...p, ...updates } : p));
      }
      return prev;
    });
  }, []);

  /** Apply mute state to the local mic track (respecting forceMuted) */
  const applyMicState = useCallback((muted: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !muted;
    }
  }, []);

  const createPeerConnection = useCallback(
    (remoteUserId: number): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice", { candidate: event.candidate.toJSON() }, remoteUserId);
        }
      };

      pc.ontrack = (event) => {
        let audio = audioElementsRef.current.get(remoteUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
          audioElementsRef.current.set(remoteUserId, audio);
        }
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {
          // Autoplay blocked — will play on first interaction
        });
        // Attach speaking detection to the remote stream
        attachAnalyser(event.streams[0], remoteUserId);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          updateParticipant(remoteUserId, { connectionState: "connected" });
        } else if (state === "failed" || state === "disconnected") {
          updateParticipant(remoteUserId, { connectionState: "failed" });
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [sendSignal, updateParticipant, attachAnalyser]
  );

  /** Teardown without sending a leave signal (used on kick) */
  const leaveCallInternal = useCallback(async () => {
    for (const [, pc] of peerConnectionsRef.current) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    audioElementsRef.current.clear();

    for (const [uid, entry] of analysersRef.current) {
      try { entry.analyser.disconnect(); } catch { /* ignore */ }
      if (uid !== userId) analysersRef.current.delete(uid);
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    stopSpeakingLoop();
    setIsInCall(false);
    setIsMuted(false);
    setParticipants([]);
    joinedRef.current = false;
    speakingStateRef.current.clear();
  }, [stopSpeakingLoop, userId]);

  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      if (signal.from_user_id === userId) return;

      // Moderation signals are addressed directly to the target.
      // payload.force === false releases a previous force-mute
      // (party-game auto-mute / host unmute)
      if (signal.type === "mute") {
        if (signal.to_user_id === userId) {
          const force = (signal.payload as { force?: boolean } | null)?.force !== false;
          if (force) {
            forceMutedRef.current = true;
            setForceMuted(true);
            applyMicState(true);
            setIsMuted(true);
            updateParticipant(userId, { isMuted: true });
            // Confirm state back to the host
            sendSignal("ice", { muted_confirm: true }, signal.from_user_id).catch(() => {});
          } else {
            // Auto-release (e.g. your turn came in a party game)
            forceMutedRef.current = false;
            setForceMuted(false);
            applyMicState(false);
            setIsMuted(false);
            updateParticipant(userId, { isMuted: false });
          }
        } else if (signal.from_user_id !== userId) {
          // Another participant was muted — reflect their badge if known
          const force = (signal.payload as { force?: boolean } | null)?.force !== false;
          updateParticipant(signal.to_user_id ?? -1, { isMuted: force ? true : false });
        }
        return;
      }

      if (signal.type === "kick") {
        if (signal.to_user_id === userId) {
          setKicked(true);
          forceMutedRef.current = false;
          setForceMuted(false);
          await leaveCallInternal();
        }
        return;
      }

      switch (signal.type) {
        case "join": {
          // New user joined — create offer to them
          setParticipants((prev) => {
            if (!prev.some((p) => p.userId === signal.from_user_id)) {
              const payload = signal.payload as { username?: string; firstName?: string; photoUrl?: string; isHost?: boolean };
              return [...prev, {
                userId: signal.from_user_id,
                username: payload?.username ?? null,
                firstName: payload?.firstName ?? "Игрок",
                photoUrl: payload?.photoUrl ?? null,
                isHost: payload?.isHost ?? false,
                isMuted: false,
                isSpeaking: false,
                connectionState: "connecting",
              }];
            }
            return prev;
          });

          const pc = createPeerConnection(signal.from_user_id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("offer", { sdp: offer }, signal.from_user_id);
          break;
        }

        case "offer": {
          let pc = peerConnectionsRef.current.get(signal.from_user_id);
          if (!pc) {
            pc = createPeerConnection(signal.from_user_id);
          }
          await pc.setRemoteDescription(signal.payload.sdp as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal("answer", { sdp: answer }, signal.from_user_id);
          break;
        }

        case "answer": {
          const pc = peerConnectionsRef.current.get(signal.from_user_id);
          if (pc) {
            await pc.setRemoteDescription(signal.payload.sdp as RTCSessionDescriptionInit);
          }
          break;
        }

        case "ice": {
          // Reused as a generic channel: muted_confirm badge update
          if (signal.payload?.muted_confirm) {
            updateParticipant(signal.from_user_id, { isMuted: true });
            break;
          }
          const pc = peerConnectionsRef.current.get(signal.from_user_id);
          if (pc) {
            try {
              await pc.addIceCandidate(signal.payload.candidate as RTCIceCandidateInit);
            } catch {
              // Ignore — might be before remote description set
            }
          }
          break;
        }

        case "leave": {
          const pc = peerConnectionsRef.current.get(signal.from_user_id);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(signal.from_user_id);
          }
          const audio = audioElementsRef.current.get(signal.from_user_id);
          if (audio) {
            audio.srcObject = null;
            audioElementsRef.current.delete(signal.from_user_id);
          }
          const entry = analysersRef.current.get(signal.from_user_id);
          if (entry) {
            try { entry.analyser.disconnect(); } catch { /* ignore */ }
            analysersRef.current.delete(signal.from_user_id);
          }
          setParticipants((prev) => prev.filter((p) => p.userId !== signal.from_user_id));
          break;
        }
      }
    },
    [userId, createPeerConnection, sendSignal, updateParticipant, applyMicState, leaveCallInternal]
  );

  const joinCall = useCallback(async () => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    try {
      setError(null);
      setMicPermission("pending");

      // Request microphone — ONLY here, on explicit voice join
      // (never on app open / tab switches)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicPermission("granted");

      // TTL signaling token BEFORE any signal traffic
      const token = await fetchVoiceToken();
      if (!token) {
        throw new Error("Не удалось авторизовать голосовой канал");
      }

      // Local speaking detection
      attachAnalyser(stream, userId);

      // Subscribe to signaling
      const channel = supabase
        .channel(`call_signals_${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const newSignal = payload.new as SignalMessage;
            if (newSignal.id > lastSignalIdRef.current) {
              lastSignalIdRef.current = newSignal.id;
              handleSignal(newSignal);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Fetch existing signals (catch up)
      const res = await fetch(`/api/rooms/${roomId}/signal`, {
        credentials: "include",
        headers: voiceTokenRef.current ? { "x-voice-token": voiceTokenRef.current } : {},
      });
      if (res.ok) {
        const data = await res.json();
        for (const signal of (data.signals ?? []) as SignalMessage[]) {
          if (signal.id > lastSignalIdRef.current) {
            lastSignalIdRef.current = signal.id;
            if (signal.from_user_id !== userId) {
              handleSignal(signal);
            }
          }
        }
      }

      // Announce join
      await sendSignal("join", {
        user_id: userId,
        username: userInfo.username,
        firstName: userInfo.firstName,
        photoUrl: userInfo.photoUrl,
        isHost,
      });

      setIsInCall(true);
      setParticipants([{
        userId,
        username: userInfo.username,
        firstName: "Вы",
        photoUrl: userInfo.photoUrl,
        isHost: isHost ?? false,
        isMuted: false,
        isSpeaking: false,
        connectionState: "connected",
      }]);

      startSpeakingLoop();
    } catch (err) {
      console.error("[voice] joinCall error:", err);
      setMicPermission("denied");
      setError(err instanceof Error ? err.message : "Нет доступа к микрофону");
      joinedRef.current = false;
    }
  }, [roomId, userId, isHost, userInfo, handleSignal, sendSignal, attachAnalyser, startSpeakingLoop]);

  const leaveCall = useCallback(async () => {
    await sendSignal("leave", {});
    await leaveCallInternal();
  }, [sendSignal, leaveCallInternal]);

  const toggleMute = useCallback(() => {
    // Force-muted by host — cannot unmute
    if (forceMutedRef.current) return;
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        updateParticipant(userId, { isMuted: !audioTrack.enabled });
      }
    }
  }, [userId, updateParticipant]);

  // ── Host moderation ────────────────────────────────────────────

  /** Kick a participant (server enforces host-only): removes from room + force-leaves their call */
  const kickParticipant = useCallback(
    async (targetId: number) => {
      try {
        await fetch(`/api/rooms/${roomId}/moderate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "kick", target_id: targetId }),
        });
        // Optimistic local cleanup
        handleSignal({
          id: Date.now(),
          from_user_id: targetId,
          to_user_id: null,
          type: "leave",
          payload: {},
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[voice] kick error:", err);
      }
    },
    [roomId, handleSignal]
  );

  /** Force-mute a participant (server enforces host-only) */
  const muteParticipant = useCallback(
    async (targetId: number) => {
      try {
        await fetch(`/api/rooms/${roomId}/moderate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "mute", target_id: targetId }),
        });
        updateParticipant(targetId, { isMuted: true });
      } catch (err) {
        console.error("[voice] mute error:", err);
      }
    },
    [roomId, updateParticipant]
  );

  // NOTE: no auto-join — the mic is requested ONLY when the user
  // explicitly taps "Join voice" in the room (RoomView calls joinCall).
  // Cleanup on unmount stays automatic.
  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        leaveCall();
      }
    };
     
  }, []);

  return {
    isInCall,
    isMuted,
    forceMuted,
    kicked,
    participants,
    error,
    micPermission,
    joinCall,
    leaveCall,
    toggleMute,
    kickParticipant,
    muteParticipant,
    /** Release a host/auto force-mute (used by party-game turn engine) */
    releaseForceMute: useCallback(() => {
      forceMutedRef.current = false;
      setForceMuted(false);
    }, []),
  };
}
