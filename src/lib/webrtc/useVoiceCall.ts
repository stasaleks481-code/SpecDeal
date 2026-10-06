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
  connectionState: "connecting" | "connected" | "failed";
}

interface SignalMessage {
  id: number;
  from_user_id: number;
  to_user_id: number | null;
  type: "offer" | "answer" | "ice" | "join" | "leave";
  payload: Record<string, unknown>;
  created_at: string;
}

interface Props {
  roomId: string;
  userId: number;
  userInfo: { username: string | null; firstName: string; photoUrl: string | null };
}

/**
 * useVoiceCall — WebRTC mesh voice call.
 * Auto-joins on mount (user enters room → immediately in call).
 * Signaling via Supabase Realtime on call_signals table.
 */
export function useVoiceCall({ roomId, userId, userInfo }: Props) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "pending">("pending");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const lastSignalIdRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedRef = useRef<boolean>(false);

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  const sendSignal = useCallback(
    async (type: SignalMessage["type"], payload: Record<string, unknown> = {}, toUserId?: number) => {
      try {
        await fetch(`/api/rooms/${roomId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type, payload, to_user_id: toUserId }),
        });
      } catch (err) {
        console.error("[voice] sendSignal error:", err);
      }
    },
    [roomId]
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
    [sendSignal, updateParticipant]
  );

  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      if (signal.from_user_id === userId) return;

      switch (signal.type) {
        case "join": {
          // New user joined — create offer to them
          setParticipants((prev) => {
            if (!prev.some((p) => p.userId === signal.from_user_id)) {
              const payload = signal.payload as { username?: string; firstName?: string; photoUrl?: string };
              return [...prev, {
                userId: signal.from_user_id,
                username: payload?.username ?? null,
                firstName: payload?.firstName ?? "Игрок",
                photoUrl: payload?.photoUrl ?? null,
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
          setParticipants((prev) => prev.filter((p) => p.userId !== signal.from_user_id));
          break;
        }
      }
    },
    [userId, createPeerConnection, sendSignal, updateParticipant]
  );

  const joinCall = useCallback(async () => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    try {
      setError(null);
      setMicPermission("pending");

      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicPermission("granted");

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
      const res = await fetch(`/api/rooms/${roomId}/signal`, { credentials: "include" });
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
      });

      setIsInCall(true);
      setParticipants([{
        userId,
        username: userInfo.username,
        firstName: "Вы",
        photoUrl: userInfo.photoUrl,
        isMuted: false,
        isSpeaking: false,
        connectionState: "connected",
      }]);
    } catch (err) {
      console.error("[voice] joinCall error:", err);
      setMicPermission("denied");
      setError(err instanceof Error ? err.message : "Нет доступа к микрофону");
      joinedRef.current = false;
    }
  }, [roomId, userId, userInfo, handleSignal, sendSignal]);

  const leaveCall = useCallback(async () => {
    await sendSignal("leave", {});

    for (const [, pc] of peerConnectionsRef.current) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    audioElementsRef.current.clear();

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

    setIsInCall(false);
    setIsMuted(false);
    setParticipants([]);
    joinedRef.current = false;
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        updateParticipant(userId, { isMuted: !audioTrack.enabled });
      }
    }
  }, [userId, updateParticipant]);

  // Auto-join on mount
  useEffect(() => {
    joinCall();
    return () => {
      if (joinedRef.current) {
        leaveCall();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isInCall,
    isMuted,
    participants,
    error,
    micPermission,
    joinCall,
    leaveCall,
    toggleMute,
  };
}
