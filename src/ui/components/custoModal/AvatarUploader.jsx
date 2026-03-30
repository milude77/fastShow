import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './css/AvatarUploader.css';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js'
import { useTranslation } from 'react-i18next';
import { avatarUpload, groupAvatarUpload } from '../../utils/uploadAvatar.js'

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 200;
  canvas.height = 200;

  // Create a circular clipping path
  ctx.beginPath();
  ctx.arc(100, 100, 100, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  // Draw the image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    200,
    200
  );

  // As a blob
  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, 'image/png');
  });
}


const AvatarUploader = ({ onClose, imgSrc, isGroupAvatarUpload = false, groupId = null }) => {

  const { t } = useTranslation();

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const { refreshAvatar } = useUserAvatar();

  const { messageApi } = useGlobalMessage();


  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUpload = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedImageBlob = await getCroppedImg(
          imgSrc,
          croppedAreaPixels
        );
        let message;
        if (!isGroupAvatarUpload) {
          message = await avatarUpload(croppedImageBlob);
        }
        else {
          message = await groupAvatarUpload(croppedImageBlob, groupId)
        }
        if (message.status === 200) {
          messageApi.success(t('avatarUploader.uploadSuccess'))
          refreshAvatar()
          onClose()
        } else {
          messageApi.error(t('avatarUploader.uploadFailed'))
        }

      } catch (e) {
        console.error(e);
      }
    }
  };


  return (
    <div className="avatar-upload-content">
      <h2>{t('avatarUploader.moveAndZoom')}</h2>
      <div className="cropper-container">
        <Cropper
          image={imgSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="controls">
        <label>{t('avatarUploader.zoom')}</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => {
            setZoom(e.target.value);
          }}
          className="zoom-range"
        />
      </div>
      <div className="modal-actions">
        <button onClick={handleUpload}>{t('avatarUploader.save')}</button>
        <button onClick={onClose}>{t('avatarUploader.cancel')}</button>
      </div>
    </div>

  );
};

export default AvatarUploader;
