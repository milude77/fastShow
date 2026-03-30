import React, { useRef, useState, useEffect } from "react";
import { useVoiceCall } from './hooks/useVoiceCall';
import AppHeaderBar from './components/appHeaderBar';
import '../ui/css/voiceApp.css';
import { LocalVideoView } from './components/LocalVideoView';
import { RemoteVideoView } from './components/RemoteVideoView';
import { CallControlBar } from './components/CallControlBar';

const VoiceApp = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('contactId');
  const userId = urlParams.get('userId');
  const callerId = urlParams.get('callerId');
  const callMode = urlParams.get('callMode') || "audio";
  const roomId = `room_${[userId, contactId].sort().join('_')}`;

  const [showHeaderBar, setShowHeaderBar] = useState(false);
  const [openMicrophone, setOpenMicrophone] = useState(true);

  const {
    callStatus,
    hasLocalVideo,
    isVideoMode,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    closeCall,
    toggleVideoMode
  } = useVoiceCall({ userId, contactId, callerId, callMode, roomId });

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
