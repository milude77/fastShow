import { BrowserWindow } from "electron";
import { handleGroupCompareResult } from '../userOptions/userContactDataOptions.js';

export async function registerGroupListeners(socket, db) {

    socket.on('group-info-update', async ({ groupId, newGroupName }) => {
        await db('groups').update({ groupName: newGroupName }).where('id', groupId);
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('group-info-update', { groupId, newGroupName });
        });
    });

    socket.on('group-compare-result', handleGroupCompareResult)
    socket.on('sync-group-messages-complete', async (groupId, messageVersion) => {
        await db('groups').update({ message_version: messageVersion }).where('id', groupId);
    });
}