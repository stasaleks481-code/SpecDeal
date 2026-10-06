"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

interface CallParticipant {
  userId: number;
  audioLevel: number;
  isMuted: boolean;
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
}

/**
 * useVoiceCall — WebRTC mesh voice call for a room.
 *
 * Architecture:
 * - Each participant connects to every other participant via RTCPeerConnection
 * - Signaling goes through Supabase Realtime on call_signals table
 * - Audio is captured via getUserMedia, sent via RTP, played via <audio> elements
 * - Mesh topology works for 2-5 participants
 *
 * STUN servers: Google's free public STUN
 */
export function useVoiceCall({ roomId, userId }: Props) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "failed">("idle");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const lastSignalIdRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
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
          audioElementsRef.current.set(remoteUserId, audio);
        }
        audio.srcObject = event.streams[0];
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setConnectionState("connected");
          setParticipants((prev) => {
            if (!prev.some((p) => p.userId === remoteUserId)) {
              return [...prev, { userId: remoteUserId, audioLevel: 0, isMuted: false }];
            }
            return prev;
          });
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [sendSignal]
  );

  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      if (signal.from_user_id === userId) return;

      switch (signal.type) {
        case "join": {
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
            } catch (err) {
              console.warn("[voice] ICE add error:", err);
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
    [userId, createPeerConnection, sendSignal]
  );

  const joinCall = useCallback(async () => {
    try {
      setError(null);
      setConnectionState("connecting");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

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

      const res = await fetch(`/api/rooms/${roomId}/signal`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        for (const signal of (data.signals ?? []) as SignalMessage[]) {
          if (signal.id > lastSignalIdRef.current) {
            lastSignalIdRef.current = signal.id;
          }
        }
      }

      await sendSignal("join", { user_id: userId });

      setIsInCall(true);
      setParticipants([{ userId, audioLevel: 0, isMuted: false }]);
      setConnectionState("connected");
    } catch (err) {
      console.error("[voice] joinCall error:", err);
      setError(err instanceof Error ? err.message : "Failed to access microphone");
      setConnectionState("failed");
    }
  }, [roomId, userId, handleSignal, sendSignal]);

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
    setConnectionState("idle");
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isInCall) {
        leaveCall();
      }
    };
  }, [isInCall, leaveCall]);

  return {
    isInCall,
    isMuted,
    participants,
    error,
    connectionState,
    joinCall,
    leaveCall,
    toggleMute,
  };
}
