import React, { useRef, useEffect, useState, useCallback } from "react";
import { useSocket } from './hooks/useSocket';
import AppHeaderBar from './components/appHeaderBar';
import '../ui/css/voiceApp.css'
import { CloseCircleOutlined, PhoneOutlined, AudioOutlined, AudioMutedOutlined, VideoCameraOutlined, VideoCameraAddOutlined } from '@ant-design/icons';
import Avatar from './components/avatar'
import { useUserAvatar } from './hooks/useAvatar';
import { useTranslation } from 'react-i18next';

const VoiceApp = () => {
  const { t } = useTranslation();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const [callStatus, setCallStatus] = useState("idle");
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [showHeaderBar, setShowHeaderBar] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('contactId');
  const userId = urlParams.get('userId');
  const callerId = urlParams.get('callerId');
  //通信模式 分为 视频/音频 video/audio
  const callMode = urlParams.get('callMode');
  const [isVideoMode, setIsVideoMode] = useState(callMode === "video");
  const [openMicrophone, setOpenMicrophone] = useState(true);
  const roomId = `room_${[userId, contactId].sort().join('_')}`;
  const { getAvatarUrl } = useUserAvatar();

  const socket = useSocket();

  // 初始化PC（无stream，延迟addTrack）
  const createPeerConnection = useCallback(async (targetId = null) => {
    try {
      const voiceServerUrl = await window.electronAPI.getVoiceChatServerUrl();

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
          // TURN配置
          {
            urls: `turn:${voiceServerUrl}`,
            username: "testuser",
            credential: "testpassword"
          }
        ]
      });

      const pc = peerConnectionRef.current;
      remoteStreamRef.current = new MediaStream();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('发送', roomId,
            targetId,
            event.candidate)
          // 指定targetId避免广播自收
          socket.emit("ice-candidate", {
            roomId,
            targetId,
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('接收到远程轨道:', event.track.kind, event.track.id);
        if (!remoteStreamRef.current.getTracks().find(t => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
        }
        setCallStatus("connected");
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE状态:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('连接状态:', pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setCallStatus("idle");
        }
      };

      pc.onsignalingstatechange = () => {
        console.log('信令状态:', pc.signalingState);
      };

      // 添加本地轨道
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
        console.log('添加本地轨道:', track.kind, track.id);
      });

      return pc;
    } catch (error) {
      console.error('PC初始化失败:', error);
    }
  }, [socket, roomId]);

  const getLocalVoiceStream = async () => {
    if (!localStreamRef.current) {
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: isVideoMode ? true : false,
          audio: true
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setHasLocalVideo(localStreamRef.current.getVideoTracks().length > 0);
      } catch (error) {
        console.error('获取摄像头失败:', error);
        setHasLocalVideo(false);
      }
    }
  };


  useEffect(() => {
    if (!socket) return;

    getLocalVoiceStream();

    if (callerId && callerId !== 'null' && callerId !== 'undefined') {
      console.log('接听呼叫:', callerId);
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

  // 发起呼叫：只发通知，等待对端accept
  const startCall = () => {
    setCallStatus("calling");
    console.log('发起呼叫:', roomId, contactId);
    socket.emit("call-request", { roomId, contactId });
  };

  // 处理呼叫请求（接收方）
  const handleCallRequest = ({ callerId }) => {
    console.log('收到呼叫请求:', callerId);
    setRemotePeerId(callerId);
    setCallStatus("receiving");
  };

  // 接受呼叫：接收方创建offer
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

  // 处理offer（发起方收到）
  const handleOffer = async ({ offer, senderId }) => {
    console.log('收到offer:', senderId);
    setRemotePeerId(senderId);
    await createPeerConnection(senderId); // 懒init

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

  // 处理answer
  const handleAnswer = async ({ answer }) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    console.log('收到answer');
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('处理answer失败:', error);
    }
  };

  // 处理ICE
  const handleCandidate = async ({ candidate }) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error("ICE失败:", e);
    }
  };

  // 挂断/拒绝
  const closeCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    localStreamRef.current = null;
    remoteStreamRef.current = new MediaStream();
    setCallStatus("idle");
    setRemotePeerId(null);
  };

  const headerBarRef = useRef(null);
  useEffect(() => {
    const headerElement = headerBarRef.current;
    if (!headerElement) return;

    headerElement.style.width = "100%";
    const handleMouseEnter = () => {
      setShowHeaderBar(true);
    };

    const handleMouseLeave = () => {
      setShowHeaderBar(false);
    };

    headerElement.addEventListener("mouseenter", handleMouseEnter);
    headerElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      headerElement.removeEventListener("mouseenter", handleMouseEnter);
      headerElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [])



  return (
    <div>
      <AppHeaderBar ref={headerBarRef} style={{ background: showHeaderBar ? 'rgba(200, 200, 200, 0.3)' : 'transparent' }} />
      <div className="voice-container">
        {remoteVideoRef.current && remoteVideoRef.current.getTracks().length > 0 ? (<video className="local-voice-stream"
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ border: "1px solid #ccc" }}
        />) : (
          <div className="no-video-stream">
            <Avatar src={getAvatarUrl(contactId)} size={120} />
          </div>
        )}
        {hasLocalVideo ? (
          <div className="remote-voice-stream">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />
          </div>
        ) : (
          <div className="remote-voice-stream no-remote-video">
            <Avatar src={getAvatarUrl(userId)} size={64} />
          </div>
        )}
      </div>

      <div className="voice-tool-btn">
        <div >
          {callStatus === "idle" && (
            <button className="call-start-btn round-btn" onClick={startCall}>{t('voiceApp.call')}</button>
          )}
          {callStatus === "calling" && (
            <p>{t('voiceApp.waitingForAnswer')}</p>
          )}
          {callStatus === "receiving" && (
            <div className="call-actions" >
              <button className="accept-call-btn round-btn" onClick={acceptCall}><PhoneOutlined /> {t('voiceApp.answer')}</button>
              <button className="reject-call-btn round-btn" onClick={closeCall}><CloseCircleOutlined /> {t('voiceApp.reject')}</button>
            </div>
          )}
          {(callStatus === "connecting" || callStatus === "connected") && (
            <div className="call-actions" >
              <button className={`open-microphone-btn round-btn ${openMicrophone ? 'voice-open' : 'voice-close'}`} onClick={() => setOpenMicrophone(!openMicrophone)}>{openMicrophone ? <AudioOutlined /> : <AudioMutedOutlined />}</button>
              <button className="reject-call-btn round-btn" onClick={closeCall}><CloseCircleOutlined />{t('voiceApp.hangup')}</button>
              <button className={`open-video-btn round-btn ${isVideoMode ? 'voice-open' : 'voice-close'}`} onClick={() => setIsVideoMode(!isVideoMode)}>{isVideoMode ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}</button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
};

export default VoiceApp;
