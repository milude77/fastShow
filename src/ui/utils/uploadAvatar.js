import apiClient from './api.js'
import axios from 'axios';

export const avatarUpload = async (blob) => {
    try {
        const arrayBuffer = await blob.arrayBuffer();

        // 先保存到本地
        await window.electronAPI.saveAvatarLocally(arrayBuffer);

        const serverUrl = await window.electronAPI.getServerUrl();
        const initiateResponse = await apiClient.post(`${serverUrl}/api/avatar/initiate`, {
            isGroupAvatar: false
        });
        const { presignedUrl, objectName } = initiateResponse.data;

        await axios.put(presignedUrl, blob, {
            headers: {
                'Content-Type': 'image/jpg',
            },
        });

        const result = await apiClient.post(`${serverUrl}/api/avatar/complete`, {
            objectName,
        });

        return result;

    } catch (error) {
        console.error('Error uploading avatar:', error);
    }
};

export const groupAvatarUpload = async (blob, groupId) => {
    try {
        const serverUrl = await window.electronAPI.getServerUrl();
        const initiateResponse = await apiClient.post(`${serverUrl}/api/avatar/initiate`, {
            isGroupAvatar: true,
            groupId: groupId
        });
        const { presignedUrl, objectName } = initiateResponse.data;

        await axios.put(presignedUrl, blob, {
            headers: {
                'Content-Type': 'image/jpg',
            },
        });

        const result = await apiClient.post(`${serverUrl}/api/avatar/complete`, {
            objectName,
        });

        return result;
    }
    catch (e) {
        console.error(e)
    }
}

