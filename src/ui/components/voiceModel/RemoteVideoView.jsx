import React, { useRef, useEffect, useCallback } from "react";
import Avatar from "../avatar";
import { useUserAvatar } from "../../hooks/useAvatar";

export const RemoteVideoView = ({ remoteStream, contactId }) => {
  const { getAvatarUrl } = useUserAvatar();
  const videoRef = useRef(null);

  const audioRef = useRef(new Audio());  // 用 ref 管理音频对象

  const hasRemoteVideo = remoteStream?.getVideoTracks().length > 0;
  console.log("RemoteVideoView: hasRemoteVideo", hasRemoteVideo);

  // 处理音频播放
  const handlePlayAudio = useCallback(async () => {
    try {
      audioRef.current.srcObject = remoteStream;  // 设置音频流
      await audioRef.current.play();
    } catch (error) {
      console.error("音频播放失败:", error);
    }
  }, [remoteStream]);

  useEffect(() => {
    // 设置远程视频流到 videoRef
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      console.log("RemoteVideoView: set remote stream");
    }
    handlePlayAudio();  // 开始播放音频
  }, [remoteStream, handlePlayAudio]);

  return (
    <div>
      {hasRemoteVideo ? (
        <video
          className="local-voice-stream"
          ref={videoRef}
          autoPlay
          playsInline
          style={{ border: "1px solid #ccc" }}
        />
      ) : (
        <div className="no-video-stream">
          <Avatar src={getAvatarUrl(contactId)} size={120} />
        </div>
      )}

    </div>
  );
};