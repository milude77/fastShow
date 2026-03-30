import React from "react";
import Avatar from "./avatar";
import { useUserAvatar } from "../hooks/useAvatar";

export const LocalVideoView = ({ localStream, hasLocalVideo, userId }) => {
  const { getAvatarUrl } = useUserAvatar();

  if (hasLocalVideo && localStream) {
    return (
      <div className="remote-voice-stream">
        <video
          ref={(el) => {
            if (el) el.srcObject = localStream;
          }}
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