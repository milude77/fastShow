import React, { useEffect, useRef} from "react";
import Avatar from "../avatar";
import { useUserAvatar } from "../../hooks/useAvatar";

export const LocalVideoView = ({ localStream, hasLocalVideo, userId }) => {
  const { getAvatarUrl } = useUserAvatar();
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (hasLocalVideo && localStream) {
    return (
      <div className="remote-voice-stream">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="remote-voice-stream no-remote-video">
      <Avatar src={getAvatarUrl(userId)} size={64} />
    </div>
  );
};