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

type SignalType =
  | "offer"
  | "answer"
  | "ice"
  | "join"
  | "leave"
  | "mute"
  | "kick"
  | "close";

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

const CONNECTION_TIMEOUT_MS = 20_000; // offer/answer never completed → failed
const DISCONNECT_GRACE_MS = 6_000; // transient network blip before "failed"
const POLL_INTERVAL_MS = 4_000; // signaling polling fallback (Realtime down-proof)
const AUDIO_RETRY_DELAYS = [250, 1000, 2500];

/**
 * useVoiceCall — WebRTC mesh voice call with Discord-style features.
 *
 * Reliability fixes (the "stuck on Подключение… / no audio" bug):
 *  1. ICE candidates arriving before the remote description are QUEUED
 *     per-peer and flushed after setRemoteDescription (they used to be
 *     silently dropped → connection never completed).
 *  2. Glare/duplicate protection: a duplicate join/offer never creates a
 *     second peer connection over a live one.
 *  3. Signaling polling fallback (4 s) — works even when the Supabase
 *     Realtime websocket dies inside the Telegram WebView.
 *  4. Fresh-only catch-up: signals older than 5 minutes are never replayed
 *     (server-side filter), so ghost participants from previous sessions
 *     no longer appear stuck on "подключение...".
 *  5. Connection timeout + disconnect grace: peers can no longer hang in
 *     "connecting" forever.
 *  6. Autoplay-safe audio: retried play() + one-time gesture unlock.
 *  7. Host "close" signal (scope voice|room) ends the call / room for
 *     every participant instantly.
 */
export function useVoiceCall({ roomId, userId, isHost, userInfo }: Props) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  /** Force-muted by the host — user cannot unmute until released */
  const [forceMuted, setForceMuted] = useState(false);
  const [kicked, setKicked] = useState(false);
  /** Host closed the call ('voice') or deleted the room ('room') for everyone */
  const [closedNotice, setClosedNotice] = useState<"voice" | "room" | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "pending">("pending");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  /** ICE candidates that arrived before the remote description was set */
  const pendingIceRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  /** Connection watchdog timers per peer */
  const connectTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const disconnectGraceRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const lastSignalIdRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusyRef = useRef(false);
  const joinedRef = useRef<boolean>(false);
  const forceMutedRef = useRef<boolean>(false);
  /** Short-lived TTL signaling token (issued on join, auto-refreshed on 401) */
  const voiceTokenRef = useRef<string | null>(null);

  // ── Speaking detection (Web Audio) ─────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<number, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; lastLevel: number }>>(new Map());
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

  /** Play a remote audio element with retries (Telegram autoplay quirks) */
  const playRemoteAudio = useCallback((audio: HTMLAudioElement) => {
    const attempt = (idx: number) => {
      if (audio.paused) {
        audio.play().catch(() => {
          if (idx < AUDIO_RETRY_DELAYS.length) {
            setTimeout(() => attempt(idx + 1), AUDIO_RETRY_DELAYS[idx]);
          }
        });
      }
    };
    attempt(0);
  }, []);

  // One-time gesture unlock: Telegram/iOS may block autoplay until the
  // user interacts — replay any paused remote audio on first touch.
  useEffect(() => {
    const unlock = () => {
      for (const [, audio] of audioElementsRef.current) {
        if (audio.paused) audio.play().catch(() => {});
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("click", unlock);
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

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

  const clearPeerTimers = useCallback((remoteUserId: number) => {
    const ct = connectTimeoutsRef.current.get(remoteUserId);
    if (ct) {
      clearTimeout(ct);
      connectTimeoutsRef.current.delete(remoteUserId);
    }
    const dg = disconnectGraceRef.current.get(remoteUserId);
    if (dg) {
      clearTimeout(dg);
      disconnectGraceRef.current.delete(remoteUserId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (remoteUserId: number): RTCPeerConnection => {
      // Never stack a second connection over a live one
      const existing = peerConnectionsRef.current.get(remoteUserId);
      if (existing) {
        clearPeerTimers(remoteUserId);
        try { existing.close(); } catch { /* ignore */ }
        peerConnectionsRef.current.delete(remoteUserId);
      }

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
        playRemoteAudio(audio);
        // Attach speaking detection to the remote stream
        attachAnalyser(event.streams[0], remoteUserId);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          clearPeerTimers(remoteUserId);
          updateParticipant(remoteUserId, { connectionState: "connected" });
        } else if (state === "failed") {
          clearPeerTimers(remoteUserId);
          updateParticipant(remoteUserId, { connectionState: "failed" });
        } else if (state === "disconnected") {
          // Grace period — transient blips recover on their own
          if (!disconnectGraceRef.current.has(remoteUserId)) {
            const t = setTimeout(() => {
              disconnectGraceRef.current.delete(remoteUserId);
              updateParticipant(remoteUserId, { connectionState: "failed" });
            }, DISCONNECT_GRACE_MS);
            disconnectGraceRef.current.set(remoteUserId, t);
          }
        }
      };

      // Watchdog: an offer/answer handshake that never completes must not
      // hang on "подключение..." forever.
      const watchdog = setTimeout(() => {
        connectTimeoutsRef.current.delete(remoteUserId);
        if (pc.connectionState !== "connected") {
          updateParticipant(remoteUserId, { connectionState: "failed" });
        }
      }, CONNECTION_TIMEOUT_MS);
      connectTimeoutsRef.current.set(remoteUserId, watchdog);

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [sendSignal, updateParticipant, attachAnalyser, playRemoteAudio, clearPeerTimers]
  );

  /** Flush ICE candidates queued before the remote description existed */
  const flushPendingIce = useCallback(async (remoteUserId: number, pc: RTCPeerConnection) => {
    const queue = pendingIceRef.current.get(remoteUserId);
    if (!queue || queue.length === 0) return;
    pendingIceRef.current.delete(remoteUserId);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch { /* ignore stale candidates */ }
    }
  }, []);

  /** Teardown without sending a leave signal (used on kick/close) */
  const leaveCallInternal = useCallback(async () => {
    for (const [, pc] of peerConnectionsRef.current) {
      try { pc.close(); } catch { /* ignore */ }
    }
    peerConnectionsRef.current.clear();
    for (const [uid] of connectTimeoutsRef.current) clearTimeout(connectTimeoutsRef.current.get(uid));
    connectTimeoutsRef.current.clear();
    for (const [uid] of disconnectGraceRef.current) clearTimeout(disconnectGraceRef.current.get(uid));
    disconnectGraceRef.current.clear();
    pendingIceRef.current.clear();
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
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    stopSpeakingLoop();
    setIsInCall(false);
    setIsMuted(false);
    setParticipants([]);
    joinedRef.current = false;
    speakingStateRef.current.clear();
  }, [stopSpeakingLoop, userId]);

  // ── Signaling receive (shared by Realtime + polling fallback) ──
  const handleSignalRef = useRef<(s: SignalMessage) => void>(() => {});

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      try {
        const res = await fetch(`/api/rooms/${roomId}/signal?after=${lastSignalIdRef.current}`, {
          credentials: "include",
          headers: voiceTokenRef.current ? { "x-voice-token": voiceTokenRef.current } : {},
        });
        if (res.status === 401) {
          const ok = await fetchVoiceToken();
          if (ok) {
            const retry = await fetch(`/api/rooms/${roomId}/signal?after=${lastSignalIdRef.current}`, {
              credentials: "include",
              headers: { "x-voice-token": voiceTokenRef.current! },
            });
            if (retry.ok) {
              const data = await retry.json();
              for (const s of (data.signals ?? []) as SignalMessage[]) {
                if (s.id > lastSignalIdRef.current) {
                  lastSignalIdRef.current = s.id;
                  handleSignalRef.current(s);
                }
              }
            }
          }
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        for (const s of (data.signals ?? []) as SignalMessage[]) {
          if (s.id > lastSignalIdRef.current) {
            lastSignalIdRef.current = s.id;
            handleSignalRef.current(s);
          }
        }
      } catch { /* network hiccup — next tick retries */ }
      finally {
        pollBusyRef.current = false;
      }
    }, POLL_INTERVAL_MS);
  }, [roomId, fetchVoiceToken]);

  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      if (signal.from_user_id === userId) return;

      // Host ended the call / deleted the room — applies to everyone
      if (signal.type === "close") {
        const scope = (signal.payload as { scope?: string } | null)?.scope === "room" ? "room" : "voice";
        forceMutedRef.current = false;
        setForceMuted(false);
        await leaveCallInternal();
        setClosedNotice(scope);
        return;
      }

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
          // New user joined — we (earlier occupant) create the offer.
          const alreadyConnecting =
            peerConnectionsRef.current.get(signal.from_user_id)?.connectionState === "connected" ||
            peerConnectionsRef.current.get(signal.from_user_id)?.connectionState === "connecting";

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

          if (alreadyConnecting) break; // duplicate/replayed join — keep live pc

          const pc = createPeerConnection(signal.from_user_id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("offer", { sdp: offer }, signal.from_user_id);
          break;
        }

        case "offer": {
          let pc = peerConnectionsRef.current.get(signal.from_user_id);
          // Glare guard: if we already offered to this peer (we are the
          // earlier occupant) or the handshake is mid-flight, keep ours.
          if (pc && (pc.localDescription?.type === "offer" || pc.signalingState === "have-local-offer")) {
            break;
          }
          if (!pc) {
            pc = createPeerConnection(signal.from_user_id);
          }
          await pc.setRemoteDescription(signal.payload.sdp as RTCSessionDescriptionInit);
          await flushPendingIce(signal.from_user_id, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal("answer", { sdp: answer }, signal.from_user_id);
          break;
        }

        case "answer": {
          const pc = peerConnectionsRef.current.get(signal.from_user_id);
          if (pc && !pc.remoteDescription) {
            await pc.setRemoteDescription(signal.payload.sdp as RTCSessionDescriptionInit);
            await flushPendingIce(signal.from_user_id, pc);
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
          const candidate = signal.payload.candidate as RTCIceCandidateInit | undefined;
          if (!candidate) break;
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
            } catch { /* stale candidate */ }
          } else {
            // Candidate arrived before the SDP — queue it, never drop
            const queue = pendingIceRef.current.get(signal.from_user_id) ?? [];
            queue.push(candidate);
            pendingIceRef.current.set(signal.from_user_id, queue);
          }
          break;
        }

        case "leave": {
          clearPeerTimers(signal.from_user_id);
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
          pendingIceRef.current.delete(signal.from_user_id);
          setParticipants((prev) => prev.filter((p) => p.userId !== signal.from_user_id));
          break;
        }
      }
    },
    [userId, createPeerConnection, sendSignal, updateParticipant, applyMicState, leaveCallInternal, flushPendingIce, clearPeerTimers]
  );

  // Keep the polling fallback wired to the latest handler
  useEffect(() => {
    handleSignalRef.current = (s) => { void handleSignal(s); };
  }, [handleSignal]);

  const joinCall = useCallback(async () => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    try {
      setError(null);
      setClosedNotice(null);
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

      // Subscribe to signaling (Realtime)
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

      // Catch up on RECENT signals only (server filters to the last
      // 5 minutes — no more ghost peers from ancient sessions)
      const res = await fetch(`/api/rooms/${roomId}/signal`, {
        credentials: "include",
        headers: voiceTokenRef.current ? { "x-voice-token": voiceTokenRef.current } : {},
      });
      if (res.status === 401) {
        await fetchVoiceToken();
      } else if (res.ok) {
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

      // Polling fallback — guarantees signaling delivery even if the
      // Realtime websocket silently dies inside the WebView
      startPolling();
    } catch (err) {
      console.error("[voice] joinCall error:", err);
      setMicPermission("denied");
      setError(err instanceof Error ? err.message : "Нет доступа к микрофону");
      joinedRef.current = false;
    }
  }, [roomId, userId, isHost, userInfo, handleSignal, sendSignal, attachAnalyser, startSpeakingLoop, fetchVoiceToken, startPolling]);

  const leaveCall = useCallback(async () => {
    await sendSignal("leave", {});
    await leaveCallInternal();
    setClosedNotice(null);
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
    closedNotice,
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
    /** Clear the "host ended call" inline notice (dismissed by UI) */
    dismissClosedNotice: useCallback(() => setClosedNotice(null), []),
  };
}
