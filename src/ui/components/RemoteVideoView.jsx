import React from "react";
import Avatar from "./avatar";
import { useUserAvatar } from "../hooks/useAvatar";

export const RemoteVideoView = ({ remoteStream, contactId }) => {
  const { getAvatarUrl } = useUserAvatar();

  const hasRemoteVideo = remoteStream?.getVideoTracks().length > 0;

  if (hasRemoteVideo) {
    return (
      <video
        className="local-voice-stream"
        ref={(el) => {
          if (el) el.srcObject = remoteStream;
        }}
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