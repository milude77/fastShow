import { BrowserWindow } from "electron";
import { handleContactsList, handleContactCompareResult } from '../userOptions/userContactDataOptions.js';
import { getCurUserId } from '../main.js'

import {
    userCredentialsManager,
} from '../userOptions/store.js';

const revicedContactList = async (db, socket, payload) => {
    await handleContactsList(db, payload);
    const groupList = await db('groups').select('id', 'message_version')
    groupList.forEach(group => {
        socket.emit('sync-group-messages', {
            groupId: group.id,
            messageVersion: group.message_version || 0,
        })
    })
}

const handleContactUpdate = async (socket) => {
    const currentUserId = getCurUserId();
    const userContactListVersion = userCredentialsManager.getUserContactListVersion(currentUserId);
    socket.emit('sync-contacts-list', {
        version: userContactListVersion,
    });
}

const contactCompare = async (db, payload, socket) => {
    await handleContactCompareResult(payload)
    const groupList = await db('groups').select('id', 'message_version')
    groupList.forEach(group => {
        socket.emit('sync-group-messages', {
            groupId: group.id,
            messageVersion: group.message_version || 0,
        })
    })
}

const handleContactDeleted = async (db, payload) => {
    await db('friends')
        .where('id', payload.friendId)
        .del();
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('contact-deleted', { contactId: payload.friendId });
    });
}

const handleDisconnectMessageSendComple = async (userId) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('disconnect-message-send-comple', userId);
    });
}


export async function registerContactListeners(socket, db) {
    socket.on('const-list', async (payload) => await revicedContactList(db, socket, payload));
    socket.on('contact-update', async () => await handleContactUpdate(socket));

    socket.on('contact-compare-result', async (payload) => await contactCompare(db, payload, socket));
    socket.on('contact-deleted', async (payload) => await handleContactDeleted(db, payload));
    socket.on('disconnect-message-send-comple', async (userId) => await handleDisconnectMessageSendComple(userId))
}