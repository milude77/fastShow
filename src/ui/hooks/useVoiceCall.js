import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "./useSocket";

export const useVoiceCall = ({ userId, contactId, callerId, callMode, roomId }) => {
  const socket = useSocket();
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const [callStatus, setCallStatus] = useState("idle");
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(callMode === "video");
  const [isVideoMode, setIsVideoMode] = useState(callMode === "video");

  // 获取本地媒体流
  const getLocalVoiceStream = async (videoEnabled) => {
    if (!localStreamRef.current) {
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: videoEnabled,
          audio: true
        });
        setHasLocalVideo(localStreamRef.current.getVideoTracks().length > 0);
      } catch (error) {
        console.error('获取摄像头失败:', error);
        setHasLocalVideo(false);
      }
    }
  };

  // 创建 PeerConnection
  const createPeerConnection = useCallback(async (targetId = null) => {
    try {
      const { voiceServerUrl, username, credential } = await window.electronAPI.getVoiceChatServerUrl();

      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turn:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject",
            credentialType: "password"
          },
          {
            urls: `turn:${voiceServerUrl}`,
            username: username,
            credential: credential
          }
        ]
      });

      const pc = peerConnectionRef.current;
      remoteStreamRef.current = new MediaStream();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            roomId,
            targetId,
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.ontrack = (event) => {
        if (!remoteStreamRef.current.getTracks().find(t => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }
        setCallStatus("connected");
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setCallStatus("idle");
        }
      };

      // 添加本地轨道
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      return pc;
    } catch (error) {
      console.error('PC初始化失败:', error);
    }
  }, [socket, roomId]);

  // 关闭通话
  const closeCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    localStreamRef.current = null;
    remoteStreamRef.current = new MediaStream();
    setCallStatus("idle");
    setRemotePeerId(null);
  }, []);

  // 接受呼叫
  const acceptCall = async () => {
    if (!remotePeerId) return;
    setCallStatus("connecting");
    await createPeerConnection(remotePeerId);
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer, targetId: remotePeerId });
    } catch (error) {
      console.error('创建offer失败:', error);
    }
  };

  // 发起呼叫
  const startCall = () => {
    setCallStatus("calling");
    socket.emit("call-request", { roomId, contactId });
  };

  // 处理 ICE 候选
  const handleCandidate = async ({ candidate }) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("ICE失败:", e);
    }
  };

  // 处理 Answer
  const handleAnswer = async ({ answer }) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('处理answer失败:', error);
    }
  };

  // 处理 Offer
  const handleOffer = async ({ offer, senderId }) => {
    setRemotePeerId(senderId);
    await createPeerConnection(senderId);
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer, targetId: senderId });
    } catch (error) {
      console.error('处理offer失败:', error);
    }
  };

  // 处理呼叫请求
  const handleCallRequest = ({ callerId }) => {
    setRemotePeerId(callerId);
    setCallStatus("receiving");
  };

  // 初始化
  useEffect(() => {
    if (!socket) return;

    getLocalVoiceStream(isVideoMode);

    if (callerId && callerId !== 'null' && callerId !== 'undefined') {
      handleCallRequest({ callerId });
    }

    socket.emit("join-room", roomId);

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleCandidate);
    socket.on("call-request", handleCallRequest);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleCandidate);
      socket.off("call-request", handleCallRequest);
      closeCall();
    };
  }, [socket, isVideoMode]);

  // 切换视频模式
  const toggleVideoMode = async () => {
    const newMode = !isVideoMode;
    setIsVideoMode(newMode);
    setHasLocalVideo(newMode);

    // 重新获取流（简单策略：关闭旧流，开新流）
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    await getLocalVoiceStream(newMode);

    // 如果已建立连接，需重新 addTrack（简化处理：实际应协商 re-offer）
    const pc = peerConnectionRef.current;
    if (pc && localStreamRef.current) {
      // 移除旧轨道（简化）
      pc.getSenders().forEach(sender => pc.removeTrack(sender));
      // 添加新轨道
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }
  };

  return {
    callStatus,
    remotePeerId,
    hasLocalVideo,
    isVideoMode,
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    startCall,
    acceptCall,
    closeCall,
    toggleVideoMode
  };
};