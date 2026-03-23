import { db } from './chatServer.js';

export async function compareContactInformation(userId, currentVersion) {
    // 获取用户的最新联系人版本
    const user = await db('users').where({ id: userId }).first();

    if (!user || user.contact_list_version <= currentVersion) {
        return null;
    }

    // 获取自上次同步以来的所有事件
    const events = await db('user_event')
        .where('user_id', userId)
        .select('*')
        .orderBy('created_at', 'asc');

    // 解析 event_data 字段
    const parsedEvents = events.map(event => {
        try {
            // 只有当 event_data 是字符串时才解析
            if (typeof event.event_data === 'string') {
                return {
                    ...event,
                    event_data: JSON.parse(event.event_data)
                };
            }
            return event;
        } catch (error) {
            console.error('解析 event_data 失败:', error);
            return event;
        }
    });

    return {
        contactListChange: parsedEvents,
        contactVersion: user.contact_list_version
    };
}

export const compareGroupMemberVersion = async (groupId, currentVersion) => {
    const group = await db('groups').where({ id: groupId }).first();
    if (!group || group.member_version <= currentVersion) {
        return null;
    }
    else {
        const membersUpdate = await db('group_member_event')
            .where('group_id', groupId)
            .andWhere('id', '>', currentVersion) // 只获取版本号大于当前版本的事件
            .select('event_data', 'action', 'user_id')

        const parsedEvents = membersUpdate.map(event => {
            try {
                // 只有当 event_data 是字符串时才解析
                if (typeof event.event_data === 'string') {
                    return {
                        ...event,
                        event_data: JSON.parse(event.event_data)
                    };
                }
                return event;
            } catch (error) {
                console.error('解析 event_data 失败:', error);
                return event;
            }
        });

        return {
            memberListChange: parsedEvents,
            memberVersion: group.member_version
        }
    }
}