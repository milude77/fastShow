import { BrowserWindow } from "electron";
import apiClient from './api.js';
import {
    userCredentialsManager,
} from './store.js';

import { getDb, getCurUserId, SOCKET_SERVER_URL } from './main.js'



export const handleContactsList = async (db, payload) => {
    const { friendsWithStatus, contactVersion, groupResult } = payload;
    const contactList = [...friendsWithStatus, ...groupResult]
    const currentUserId = getCurUserId();
    try {
        const contacts = Array.isArray(contactList) ? contactList : Object.values(contactList || {});

        let remoteFriend = new Array()
        let remoteGroups = new Array()

        for (const contact of contacts) {
            if (contact.type == 'friend') remoteFriend.push(contact);
            else remoteGroups.push(contact);
        }

        remoteGroups.map(async (g) => {
            await db('groups').where('id', g.id).update({
                my_role: g.myRole
            })
        })

        const localFriends = await db('friends').select('id');
        const localFriendIds = new Set(localFriends.map(f => String(f.id)));

        const localGroups = await db('groups').select('id');
        const localGroupIds = new Set(localGroups.map(g => String(g.id)));

        const groupsToAdd = remoteGroups.filter(g => !localGroupIds.has(String(g.id)));
        const friendsToAdd = remoteFriend.filter(f => !localFriendIds.has(String(f.id)));

        if (friendsToAdd.length > 0) {
            const rows = friendsToAdd.map(f => ({
                id: String(f.id),
                userName: String(f.username || f.userName || ''),
                addTime: f.created_at ? new Date(f.created_at) : new Date(),
                nickName: f.nickName ? String(f.nickName) : null,
                version: f.version,
            }));
            await db('friends').insert(rows).onConflict('id').ignore();
        }

        if (groupsToAdd.length > 0) {
            const rows = groupsToAdd.map(g => ({
                id: String(g.id),
                groupName: String(g.username),
                addTime: g.created_at ? new Date(g.joinedAt) : new Date(),
                version: g.version,
            }));
            await db('groups').insert(rows).onConflict('id').ignore();
        }

        userCredentialsManager.setUserContactListVersion(currentUserId, contactVersion);

        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('contacts-list-updated'));

    } catch (e) {
        console.error('Friends sync error:', e);
    }
}


export const handleContactCompareResult = async (payload) => {
    const { contactListChange, contactVersion } = payload;
    const db = getDb();
    const currentUserId = getCurUserId();
    try {
        contactListChange.forEach(async (change) => {
            const { event_data, action } = change;
            //处理新增好友
            if (action === 'friend_add') {
                const { friend_id, username, infoVersion } = event_data;

                await db('friends').insert({
                    id: friend_id,
                    userName: username,
                    version: infoVersion,
                }).onConflict('id').ignore();
            }
            //处理新增好友请求信息
            if (action === 'friend_request') {
                const { id, inviterId, inviterName, createdTime } = event_data;
                await db('invite_information')
                    .insert({
                        id,
                        inviter_id: inviterId,
                        inviter_name: inviterName,
                        status: 'pending',
                        create_time: createdTime,
                        is_group_invite: false,
                    })
                    .onConflict('id')
                    .merge(
                        {
                            inviter_id: inviterId,
                            inviter_name: inviterName,
                            status: 'pending',
                            create_time: createdTime,
                            is_group_invite: false,
                        }
                    )
                    ;
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('new-invite'));
            }
            //处理被好友删除
            if (action === 'friend_deleted') {
                const { friend_id: contact_id } = event_data;
                await db('friends').where('id', contact_id).update({
                    status: 'deleted'
                })
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('contacts-list-updated'));
            }
            //处理新的群聊
            if (action === 'group_added') {
                const { groupId, groupName, role, joinedAt } = event_data;
                await db('groups').insert({
                    id: groupId,
                    groupName,
                    my_role: role,
                    addTime: joinedAt ? new Date(joinedAt) : new Date(),
                }).onConflict('id').ignore();
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('new-invite'));
            }
            //处理新的群聊邀请
            if (action === 'group_invited') {
                const { id, groupId, groupName, inviterId, inviterName, createdTime } = event_data;
                await db('invite_information')
                    .insert({
                        id: id,
                        inviter_id: inviterId,
                        inviter_name: inviterName,
                        group_id: groupId,
                        group_name: groupName,
                        status: 'pending',
                        create_time: createdTime,
                        is_group_invite: true,
                    })
                    .onConflict('id')
                    .merge(
                        {
                            inviter_id: inviterId,
                            inviter_name: inviterName,
                            group_id: groupId,
                            group_name: groupName,
                            status: 'pending',
                            create_time: createdTime,
                            is_group_invite: true,
                        }
                    )
                    ;
            }
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('contacts-list-updated'));
        })
        userCredentialsManager.setUserContactListVersion(currentUserId, contactVersion);
    }
    catch (e) {
        console.error('Contact compare failed:', e);
    }
}

export const handleGroupCompareResult = async (payload) => {
    const { groupListChange, groupVersion } = payload;
    const db = getDb();
    const currentUserId = getCurUserId();
    try {
        groupListChange.forEach(change => {
            const { event_data, action } = change;
            const { group_id: group_id, status } = event_data;
            const group_info = apiClient.get(`${SOCKET_SERVER_URL}/api/group-info`, {
                groupId: group_id
            });
            const { id, groupName, infoVersion } = group_info;
            if (action === 'group_add') {
                db('groups').insert({
                    id,
                    groupName,
                    version: infoVersion,
                })
            }
            if (action === 'update') {
                db('groups').where('id', id).update({
                    status,
                    groupName,
                    version: infoVersion,
                })
            }
        })
        userCredentialsManager.setUserGroupListVersion(currentUserId, groupVersion);
    }
    catch (e) {
        console.error('Group compare failed:', e);
    }
} 