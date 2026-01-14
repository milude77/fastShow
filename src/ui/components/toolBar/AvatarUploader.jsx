import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './css/AvatarUploader.css';

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
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

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

  if (!imgSrc) {
    return (
      <div className="avatar-uploader-modal">
        <div className="modal-content">
          <h2>上传头像</h2>
          <input type="file" accept="image/*" onChange={onSelectFile} />
          <div className="modal-actions">
            <button onClick={onClose}>取消</button>
          </div>
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
