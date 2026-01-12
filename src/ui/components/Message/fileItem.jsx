import React, { useState, useEffect } from 'react';
import { Button, Progress } from 'antd';
import { ExclamationCircleOutlined, FolderOpenOutlined, DownloadOutlined } from '@ant-design/icons';

export default function FileItem({ msg, handleResendFile, handleOpenFileLocation, handleDownloadFile, isGroup, convertFileSize }) {
    // 添加进度状态
    const [fileExt, setFileExt] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(msg.uploadProgress || 0);
    const [downloadProgress, setDownloadProgress] = useState(msg.downloadProgress || 0);
    const [isUploading, setIsUploading] = useState(msg.status === 'uploading');
    const [isDownloading, setIsDownloading] = useState(false);

    // 处理上传进度更新
    const handleFileUploadProgress = (event, { messageId, percentCompleted }) => {
        if (messageId === msg.id) {
            setUploadProgress(percentCompleted);
        }
    };

    const handleUploadComplete = ( event, { messageId } ) => {
        if (messageId === msg.id) {
            setIsUploading(false);
        }
    };

    const handleFileDownloadStart = (event, { messageId }) => {
        if (messageId === msg.id) {
            setIsDownloading(true);
        }
    };

    const handleFileDownloadProgress = (event, { messageId, progress, loaded, total }) => { 
        if (messageId === msg.id) {
            setDownloadProgress(progress);
        }
    };

    const handleFileDownloadCompletet = (event, { messageId }) => {
        if (messageId === msg.id) {
            setIsDownloading(false);
            setFileExt(true)
        }
    };

    // 监听上传进度事件
    useEffect(() => {
        // 修复：添加事件监听器
        window.electronAPI.ipcRenderer.on('upload-progress', handleFileUploadProgress);
        window.electronAPI.ipcRenderer.on('file-upload-complete', handleUploadComplete );
        window.electronAPI.ipcRenderer.on('download-progress', handleFileDownloadProgress);
        window.electronAPI.ipcRenderer.on('file-download-start', handleFileDownloadStart);
        window.electronAPI.ipcRenderer.on('file-download-complete', handleFileDownloadCompletet);

        // 清理：移除事件监听器
        return () => {
            window.electronAPI.ipcRenderer.removeListener('upload-progress', handleFileUploadProgress);
            window.electronAPI.ipcRenderer.removeListener('file-upload-complete', handleUploadComplete );
            window.electronAPI.ipcRenderer.removeListener('download-progress', handleFileDownloadProgress);
            window.electronAPI.ipcRenderer.removeListener('file-download-start', handleFileDownloadStart);
            window.electronAPI.ipcRenderer.removeListener('file-download-complete', handleFileDownloadCompletet);
        }
    }, [msg.id]); // 依赖项：当 msg.id 改变时重新绑定

    // 根据状态显示不同的按钮和进度条
    const renderFileAction = () => {
        if (msg.status === 'uploading' || isUploading) {
            // 上传中：显示进度条
            return (
                <div style={{ width: '100%', marginTop: '8px' }}>
                    <Progress
                        percent={uploadProgress}
                        size="small"
                        status="active"
                        showInfo={false}
                    />
                    <div style={{ fontSize: '12px', color: '#888', textAlign: 'right', marginTop: '-5px' }}>
                        {uploadProgress}%
                    </div>
                </div>
            );
        }

        if (msg.status === 'downloading' || isDownloading) {
            // 下载中：显示进度条
            return (
                <div style={{ width: '100%', marginTop: '8px' }}>
                    <Progress
                        percent={downloadProgress}
                        size="small"
                        status="active"
                        showInfo={false}
                    />
                    <div style={{ fontSize: '12px', color: '#888', textAlign: 'right', marginTop: '-5px' }}>
                        {downloadProgress}%
                    </div>
                </div>
            )
        }

        if (msg.fileExt || fileExt) {
            // 文件已存在本地：显示打开位置按钮
            return (
                <Button
                    style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#52c41a',
                        color: 'white',
                        marginLeft: '8px'
                    }}
                    type="primary"
                    onClick={() => handleOpenFileLocation(msg.id, isGroup)}
                    title="打开文件位置"
                >
                    <FolderOpenOutlined />
                </Button>
            );
        } else {
            // 文件未下载：显示下载按钮
            return (
                <Button
                    style={{
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#1890ff',
                        color: 'white',
                        marginLeft: '8px'
                    }}
                    type="primary"
                    onClick={() => handleDownloadFile(msg.id, msg.fileUrl, msg.fileName, isGroup)}
                    title="下载文件"
                >
                    <DownloadOutlined />
                </Button>
            );
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%' }}>
            {msg.sender === 'user' && (() => {
                switch (msg.status) {
                    case 'fail':
                        return (
                            <span
                                className="message-status"
                                style={{ color: 'red', marginRight: '8px' }}
                                onClick={() => handleResendFile(msg)}
                            >
                                <ExclamationCircleOutlined />
                            </span>
                        );
                    default:
                        return null;
                }
            })()}

            <div className={`file-message-content ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                <div
                    style={{
                        display: "flex",
                        flexDirection: 'column',
                        flex: '1',
                        justifyContent: 'space-between',
                        margin: '5px'
                    }}
                    className="file-information"
                >
                    <span className="message-text">{msg.fileName}</span>
                    <span style={{ color: 'gray' }}>
                        {msg.fileSize ? convertFileSize(msg.fileSize) : '上传中...'}
                    </span>
                </div>

                {/* 渲染文件操作按钮或进度条 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderFileAction()}
                </div>
            </div>
        </div>
    );
}