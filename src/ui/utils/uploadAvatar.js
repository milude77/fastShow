import apiClient from './api.js'
import axios from 'axios';

const handleAvatarUpload = async (blob) => {
    try {
        const arrayBuffer = await blob.arrayBuffer();

        // 先保存到本地
        await window.electronAPI.saveAvatarLocally(arrayBuffer);

        const serverUrl = await window.electronAPI.getServerUrl();
        const initiateResponse = await apiClient.post(`${serverUrl}/api/avatar/initiate`);
        const { presignedUrl, objectName } = initiateResponse.data;

        await axios.put(presignedUrl, blob, {
            headers: {
                'Content-Type': 'image/jpg',
            },
        });

        await apiClient.post(`${serverUrl}/api/avatar/complete`, {
            objectName,
        });

    } catch (error) {
        console.error('Error uploading avatar:', error);
    }
};

export default handleAvatarUpload;
