import React from'react';
import { Avatar as AntdAvatar } from 'antd';

const Avatar = ({ src, size = 48, className = '',...rest }) => (
  <AntdAvatar src={src} size={size} className={className} {...rest} />
);

export default Avatar;