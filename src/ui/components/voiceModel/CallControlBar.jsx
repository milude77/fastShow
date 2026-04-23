import React from "react";
import { CloseCircleOutlined, PhoneOutlined, AudioOutlined, AudioMutedOutlined, VideoCameraOutlined, VideoCameraAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export const CallControlBar = ({
  callStatus,
  isVideoMode,
  openMicrophone,
  onToggleMicrophone,
  onHangup,
  onAccept,
  onReject,
  onStartCall,
  onToggleVideo
}) => {
  const { t } = useTranslation();

  return (
    <div className="voice-tool-btn">
      <div>
        {callStatus === "idle" && (
          <button className="call-start-btn round-btn" onClick={onStartCall}>
            {t('voiceApp.call')}
          </button>
        )}
        {callStatus === "calling" && (
          <p>{t('voiceApp.waitingForAnswer')}</p>
        )}
        {callStatus === "receiving" && (
          <div className="call-actions">
            <button className="accept-call-btn round-btn" onClick={onAccept}>
              <PhoneOutlined /> {t('voiceApp.answer')}
            </button>
            <button className="reject-call-btn round-btn" onClick={onReject}>
              <CloseCircleOutlined /> {t('voiceApp.reject')}
            </button>
          </div>
        )}
        {(callStatus === "connecting" || callStatus === "connected") && (
          <div className="call-actions">
            <button
              className={`open-microphone-btn round-btn ${openMicrophone ? 'voice-open' : 'voice-close'}`}
              onClick={onToggleMicrophone}
            >
              {openMicrophone ? <AudioOutlined /> : <AudioMutedOutlined />}
            </button>
            <button className={`reject-call-btn round-btn`} onClick={onHangup}>
              <CloseCircleOutlined />{t('voiceApp.hangup')}
            </button>
            <button
              className={`open-video-btn round-btn ${isVideoMode ? 'voice-open' : 'voice-close'}`}
              onClick={onToggleVideo}
            >
              {isVideoMode ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};