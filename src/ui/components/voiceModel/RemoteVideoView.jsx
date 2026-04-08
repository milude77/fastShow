import React, { useRef, useEffect } from "react";
import Avatar from "../avatar";
import { useUserAvatar } from "../../hooks/useAvatar";

export const RemoteVideoView = ({ remoteStream, contactId }) => {
  const { getAvatarUrl } = useUserAvatar();
  const videoRef = useRef(null);

  const hasRemoteVideo = remoteStream?.getVideoTracks().length > 0;

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (hasRemoteVideo) {
    return (
      <video
        className="local-voice-stream"
        ref={videoRef}
        autoPlay
        playsInline
        style={{ border: "1px solid #ccc" }}
      />
    );
  }

  return (
    <div className="no-video-stream">
      <Avatar src={getAvatarUrl(contactId)} size={120} />
    </div>
  );
};