import React, { useRef, useEffect, useCallback, useState } from "react";
import Avatar from "../avatar";
import { useUserAvatar } from "../../hooks/useAvatar";
import { useSocket } from "../../hooks/useSocket";

export const RemoteVideoView = ({ remoteStream, contactId, remoteVideoTrackId }) => {
  const { getAvatarUrl } = useUserAvatar();
  const socket = useSocket();
  const videoRef = useRef(null);
  const audioRef = useRef(new Audio());  // 用 ref 管理音频对象

  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  // 检查视频轨道状态
  const checkVideoStatus = useCallback(() => {
    if (!remoteStream) {
      setHasRemoteVideo(false);
      console.log('没有远程视频流');
      return;
    }

    const videoTracks = remoteStream.getVideoTracks();
    const activeVideoTrack = videoTracks.find(
      track => track.readyState === 'live' && track.enabled && !track.muted
    );

    const isActive = !!activeVideoTrack;

    setHasRemoteVideo(isActive);
  }, [remoteStream]);

  // 监听 MediaStream 和 Track 的变化
  useEffect(() => {
    checkVideoStatus(); // 初始检查


    if (!remoteStream) return;

    // 绑定事件：监听流级别的轨道增减
    remoteStream.addEventListener("addtrack", checkVideoStatus);
    remoteStream.addEventListener("removetrack", checkVideoStatus);

    // 绑定事件：监听现有轨道级别的状态变化
    const bindTrackEvents = () => {
      remoteStream.getVideoTracks().forEach(track => {
        // 当远端用 replaceTrack 替换为 null 时，轨道通常会触发 mute
        track.addEventListener("mute", checkVideoStatus);
        track.addEventListener("unmute", checkVideoStatus);
        track.addEventListener("ended", checkVideoStatus);
      });
    };

    bindTrackEvents();

    // 如果添加了新轨道，需要为新轨道也绑定事件
    const handleAddTrack = () => {
      checkVideoStatus();
      bindTrackEvents();
    };
    remoteStream.addEventListener("addtrack", handleAddTrack);

    socket.on('close-video', () => {
      setHasRemoteVideo(false);
    })

    return () => {
      remoteStream.removeEventListener("addtrack", checkVideoStatus);
      remoteStream.removeEventListener("addtrack", handleAddTrack);
      remoteStream.removeEventListener("removetrack", checkVideoStatus);
      remoteStream.getVideoTracks().forEach(track => {
        track.removeEventListener("mute", checkVideoStatus);
        track.removeEventListener("unmute", checkVideoStatus);
        track.removeEventListener("ended", checkVideoStatus);
      });
      socket.off('close-video');
    };
  }, [remoteStream, checkVideoStatus]);

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
    // 当确认有视频且 video 元素存在时，强制重新赋值并 play
    if (videoRef.current && remoteStream && hasRemoteVideo) {
      if (videoRef.current.srcObject !== remoteStream) {
        videoRef.current.srcObject = remoteStream;
      }
      // 某些浏览器在 DOM 切换后需要手动调用 play()
      videoRef.current.play().catch(e => console.error("视频播放失败:", e));
    }
    handlePlayAudio()
  }, [remoteStream, hasRemoteVideo, handlePlayAudio]);

  useEffect(() => {
    checkVideoStatus();
  }, [remoteVideoTrackId, checkVideoStatus]);

  return (
    <div>
      {hasRemoteVideo ? (
        <video
          className="local-voice-stream"
          ref={videoRef}
          autoPlay
          playsInline
          style={{ border: "1px solid #ccc", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div className="no-video-stream" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
          <Avatar src={getAvatarUrl(contactId)} size={120} />
        </div>
      )}
    </div>
  );
};