import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "./useSocket";

export const useVoiceCall = ({ contactId, callerId, callMode, roomId, offer }) => {
  const socket = useSocket();
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const [callStatus, setCallStatus] = useState("idle");
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(callMode === "video");
  const [isVideoMode, setIsVideoMode] = useState(callMode === "video");
  const [voiceStreamStatus, setVoiceStreamStatus] = useState({
    rtt: null,
    jitter: null,
    loss: null,
    bitrate: null,
  })

  const lastStatsRef = useRef({
    bytesSent: 0,
    timestamp: 0
  });


  // 获取本地媒体流
  const getLocalVoiceStream = async () => {
    if (!localStreamRef.current) {
      try {
        console.log(isVideoMode)
        localStreamRef.current = await navigator.mediaDevices.getUserMedia(
          isVideoMode ?
            { video: true, audio: true } :
            { video: false, audio: true }
        );
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
          console.log('通话已断开1');
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
    await getLocalVoiceStream();
    handleOffer({ offer, senderId: remotePeerId });
  };

  // 发起呼叫
  const startCall = async () => {
    setCallStatus("calling");

    await getLocalVoiceStream();

    await createPeerConnection(contactId);
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call-request", { roomId, contactId, offer, callMode });
    } catch (error) {
      console.error('发起呼叫失败:', error);
      setCallStatus("idle");
    }
  };

  // 处理 ICE 候选
  const handleCandidate = async ({ candidate }) => {
    console.log('收到ICE候选:', candidate);
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
      setCallStatus("connecting");
    } catch (error) {
      console.error('处理answer失败:', error);
    }
  };

  // 处理 Offer
  const handleOffer = async ({ offer, senderId }) => {
    console.log('收到Offer:', offer);
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
  const handleCallRequest = ({ callerId, offer }) => {
    console.log('收到呼叫请求:', callerId);
    setRemotePeerId(callerId);
    setCallStatus("receiving");
    // 如果收到了offer，直接处理
    if (offer) {
      handleOffer({ offer, senderId: callerId });
    }
  };

  // 初始化
  useEffect(() => {
    if (!socket) return;

    getLocalVoiceStream();

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
  }, [socket]);

  const toggleVideoMode = async () => {
    const pc = peerConnectionRef.current;
    const localStream = localStreamRef.current;

    const newMode = !isVideoMode;
    setIsVideoMode(newMode);

    if (!pc || !localStream) return;

    if (newMode) {
      // 🔥 开视频
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      localStreamRef.current = videoStream
      const videoTrack = videoStream.getVideoTracks()[0];

      const sender = pc.getSenders().find(s => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(videoTrack);
      } else {
        localStream.addTrack(videoTrack);
        pc.addTrack(videoTrack, localStream);
      }

      setHasLocalVideo(true);

    } else {
      // 🔥 关视频
      const sender = pc.getSenders().find(s => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(null);
      }

      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      }

      setHasLocalVideo(false);
    }
  };


  // 音频流状态监控
  const monitorstatus = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const stats = await pc.getStats();
    let rtt = null;
    let jitter = null;
    let loss = null;
    let bitrate = null;

    if (stats) {
      stats.forEach(report => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          rtt = report.currentRoundTripTime * 1000;
        }

        // 入站视频（远端 -> 本地）
        if (report.type === "inbound-rtp" && report.kind === "video") {
          jitter = report.jitter;
          loss = report.packetsLost;
        }

        // 出站视频（本地 -> 远端）
        if (report.type === "outbound-rtp" && report.kind === "video") {
          const now = report.timestamp;
          const bytes = report.bytesSent;

          const last = lastStatsRef.current;

          if (last.timestamp) {
            bitrate = Math.floor(
              (bytes - last.bytesSent) * 8 / (now - last.timestamp)
            );
          }

          lastStatsRef.current = {
            bytesSent: bytes,
            timestamp: now
          };
        }
      })
    }

    setVoiceStreamStatus({ rtt, jitter, loss, bitrate });
  }


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
    toggleVideoMode,
    voiceStreamStatus,
    monitorstatus
  };
};
