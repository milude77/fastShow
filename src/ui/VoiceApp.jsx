import React, { useRef, useState, useEffect } from "react";
import { useVoiceCall } from './hooks/useVoiceCall';
import AppHeaderBar from './components/appHeaderBar';
import '../ui/css/voiceApp.css';
import { LocalVideoView } from './components/voiceModel/LocalVideoView';
import { RemoteVideoView } from './components/voiceModel/RemoteVideoView';
import { CallControlBar } from './components/voiceModel/CallControlBar';
import { WifiOutlined } from '@ant-design/icons';

const VoiceApp = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('contactId');
  const userId = urlParams.get('userId');
  const callerId = urlParams.get('callerId');
  const callMode = urlParams.get('callMode') || "audio";
  let offer = urlParams.get('offer');
  if (offer) {
    offer = JSON.parse(offer);
  }

  let roomId = urlParams.get('roomId');
  if (roomId === 'null' || roomId === 'undefined') {
    roomId = `room_${[userId, contactId].sort().join('_')}`;
  }

  const [showHeaderBar, setShowHeaderBar] = useState(false);
  const [openMicrophone, setOpenMicrophone] = useState(true);
  const [voiceStreamStatusBarOpen, setVoiceStreamStatusBarOpen] = useState(false);


  const {
    callStatus,
    hasLocalVideo,
    isVideoMode,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    closeCall,
    toggleVideoMode,
    voiceStreamStatus,
    monitorstatus
  } = useVoiceCall({ userId, contactId, callerId, callMode, roomId, offer });

  const [wifiStatusStyle, setWifiStatusStyle] = useState({
    color: voiceStreamStatus?.rtt > 100 ? "red" : "green"
  })

  // 音视频流状态监听
  useEffect(() => {
    let voiceStreamListener;
    if (callStatus === "connecting" || callStatus === "connected") {
      voiceStreamListener = setInterval(() => {
        monitorstatus();
        setWifiStatusStyle({
          color: voiceStreamStatus.rtt > 200 ? "red" : "green"
        })
      }, 2000);
    }
    return () => {
      clearInterval(voiceStreamListener);
    };
  }, [callStatus, monitorstatus, voiceStreamStatus]);

  const VoiceStreamStatusBarOpenList = () => {
    return (
      <ui onClick={() => setVoiceStreamStatusBarOpen(false)} className="voice-stream-status">
        <li>
          <span>{`延迟 : ${voiceStreamStatus.rtt} ms`}</span>
        </li>
        <li>
          <span>{`抖动 : ${voiceStreamStatus.jitter}`}</span>
        </li>
        <li>
          <span>{`丢包率:  ${voiceStreamStatus.loss}`}</span>
        </li>
        <li>
          <span>{`码率: ${voiceStreamStatus.bitrate} kbps `}</span>
        </li>
      </ui>
    )
  }

  const VoiceStreamStatusBarCloseList = () => {
    return (
      <span onClick={() => setVoiceStreamStatusBarOpen(true)} className="voice-stream-status">
        <WifiOutlined style={wifiStatusStyle} />
        {`延迟 : ${voiceStreamStatus?.rtt} ms`}
      </span>
    )
  }

  const headerBarRef = useRef(null);

  useEffect(() => {
    const headerElement = headerBarRef.current;
    if (!headerElement) return;

    headerElement.style.width = "100%";
    const handleMouseEnter = () => setShowHeaderBar(true);
    const handleMouseLeave = () => setShowHeaderBar(false);

    headerElement.addEventListener("mouseenter", handleMouseEnter);
    headerElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      headerElement.removeEventListener("mouseenter", handleMouseEnter);
      headerElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div>
      <AppHeaderBar
        ref={headerBarRef}
        style={{ background: showHeaderBar ? 'rgba(200, 200, 200, 0.3)' : 'transparent' }}
      />
      <div className="voice-container">
        {voiceStreamStatusBarOpen ? <VoiceStreamStatusBarOpenList /> : <VoiceStreamStatusBarCloseList />}
        <RemoteVideoView remoteStream={remoteStream} contactId={contactId} />
        <LocalVideoView localStream={localStream} hasLocalVideo={hasLocalVideo} userId={userId} />
      </div>

      <CallControlBar
        callStatus={callStatus}
        isVideoMode={isVideoMode}
        openMicrophone={openMicrophone}
        onToggleMicrophone={() => setOpenMicrophone(!openMicrophone)}
        onHangup={closeCall}
        onAccept={acceptCall}
        onReject={closeCall}
        onStartCall={startCall}
        onToggleVideo={toggleVideoMode}
      />
    </div>
  );
};

export default VoiceApp;
