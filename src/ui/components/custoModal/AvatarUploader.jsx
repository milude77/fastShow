import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './css/AvatarUploader.css';
import { Input } from 'antd';
import Avatar from '../avatar.jsx'
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js'
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

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


const AvatarUploader = ({ onAvatarUpload, onClose }) => {

  const currentUser = JSON.parse(localStorage.getItem('currentUser'))
  const { t } = useTranslation();

  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const { avatarSrc, refreshAvatar } = useUserAvatar();

  const socket = useSocket();
  const { messageApi } = useGlobalMessage();


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
        const message = await onAvatarUpload(croppedImageBlob);
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

  const handleSubmitInfo = async (e) => {
    e.preventDefault();
    const userName = e.target.elements.userName.value;
    socket.emit('update-user-info', { username: userName });

    let curUserCredentials = await window.electronAPI.getCurrentUserCredentials()
    curUserCredentials = Object.assign(curUserCredentials, { userName });
    await window.electronAPI.saveCurrentUserCredentials(curUserCredentials);
    await window.electronAPI.saveUserListCredentials(curUserCredentials)
    messageApi.success(t('avatarUploader.updateSuccess'))
  };


  if (!imgSrc) {
    return (
      <div className="avatar-modal-content">
        <label htmlFor="file-upload">
          <Avatar className='file-upload' size={120} src={avatarSrc} alt="头像" />
        </label>
        <input
          type="file"
          id="file-upload"
          accept="image/*"
          onChange={onSelectFile}
          style={{ display: 'none' }}
        />
        <form onSubmit={handleSubmitInfo}>
          <div className='id-info'>
            <label className='info-lable'>{t('avatarUploader.idLabel')}</label>
            <div className="id-content">
              <label>{currentUser.userId}</label>
            </div>
          </div>
          <div className='name-info'>
            <label className='info-lable' htmlFor="user-name">{t('avatarUploader.nicknameLabel')}</label>
            <Input
              type="text"
              id="user-name"
              name="userName"
              defaultValue={currentUser?.username || ''}
            />
          </div>
          <div className='email-info'>
            <label className='info-lable' htmlFor="user-email">{t('avatarUploader.emailLabel')}</label>
            <label style={{ color: `${currentUser?.email ? '' : 'red'}` }} >{currentUser?.email ? currentUser.email : t('avatarUploader.notBound')}</label>
            <Button>{t('avatarUploader.bindEmail')}</Button>
          </div>
          <div className="modal-actions">
            <button type='submit'>{t('avatarUploader.save')}</button>
            <button onClick={onClose}>{t('avatarUploader.cancel')}</button>
          </div>
        </form>
      </div>
    );
  }

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
