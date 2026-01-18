import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './css/AvatarUploader.css';
import { Input } from 'antd';
import Avatar from '../avatar.jsx'
import { useUserAvatar } from '../../hooks/useAvatar.js';

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


const AvatarUploader = ({ currentUser, onAvatarUpload, onClose }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const { avatarSrc } = useUserAvatar(currentUser?.userId);


  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result.toString() || '')
      );
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUpload = async () => {
    if (croppedAreaPixels && imgSrc) {
      try {
        const croppedImageBlob = await getCroppedImg(
          imgSrc,
          croppedAreaPixels
        );
        onAvatarUpload(croppedImageBlob);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const userName = e.target.elements.userName.value;
    onAvatarUpload(imgSrc, userName);
  };


  if (!imgSrc) {
    return (
      <div className="avatar-uploader-modal">
        <div className="modal-content">
          <Avatar size={120}
            src={avatarSrc}
            alt=""
          />
          <input type="file" accept="image/*" onChange={onSelectFile} />
          <form onSubmit={handleSubmit}>
            <div className='user-name' style={{ display: 'flex' }}>
              <label htmlFor="file-upload">昵称</label>
              <Input style={{ flex: '1' }} type="text" id="user-name" name="userName" />
            </div>
            <div className="modal-actions">
              <button type='submit'>保存</button>
              <button onClick={onClose}>取消</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="avatar-uploader-modal">
      <div className="modal-content">
        <h2>移动和缩放图片</h2>
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
          <label>缩放</label>
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
          <button onClick={handleUpload}>保存</button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
};

export default AvatarUploader;
