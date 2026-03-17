export const handleContactsList = async (db, payload) => {
            try {
                const contacts = Array.isArray(payload) ? payload : Object.values(payload || {});

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

                const remoteFriendIds = new Set(remoteFriend.map(f => String(f.id)));
                const remoteGroupIds = new Set(remoteGroups.map(g => String(g.id)));

                const localFriends = await db('friends').select('id', 'isFriend');
                const localFriendIds = new Set(localFriends.map(f => String(f.id)));

                const localGroups = await db('groups').select('id', 'isMember');
                const localGroupIds = new Set(localGroups.map(g => String(g.id)));

                const groupsToAdd = remoteGroups.filter(g => !localGroupIds.has(String(g.id) && !g.isMember))
                const friendsToAdd = remoteFriend.filter(f => !localFriendIds.has(String(f.id) && !f.isFriend));

                if (friendsToAdd.length > 0) {
                    const rows = friendsToAdd.map(f => ({
                        id: String(f.id),
                        userName: String(f.username || f.userName || ''),
                        addTime: f.created_at ? new Date(f.created_at) : new Date(),
                        nickName: f.nickName ? String(f.nickName) : null,
                    }));
                    await db('friends').insert(rows).onConflict('id').ignore();

                    if (friendsToAdd.length > 0) {
                        await db('friends').whereIn('id', friendsToAdd.map(f => String(f.id))).update({ isFriend: true, is_deleted: false });
                    }
                }

                if (groupsToAdd.length > 0) {
                    const rows = groupsToAdd.map(g => ({
                        id: String(g.id),
                        groupName: String(g.username),
                        addTime: g.created_at ? new Date(g.joinedAt) : new Date(),
                    }));
                    await db('groups').insert(rows).onConflict('id').ignore();
                    if (groupsToAdd.length > 0) {
                        await db('groups').whereIn('id', groupsToAdd.map(g => String(g.id))).update({ isMember: true, is_deleted: false });
                    }
                }

                const friendsToDelete = [...localFriendIds].filter(id => !remoteFriendIds.has(id));
                const groupsToDelete = [...localGroupIds].filter(id => !remoteGroupIds.has(id));

                if (groupsToDelete.length > 0) {
                    await db('groups').whereIn('id', groupsToDelete).update({ isMember: false });
                }
                if (friendsToDelete.length > 0) {
                    await db('friends').whereIn('id', friendsToDelete).update({ isFriend: false });
                }

                event.sender.send('contacts-list-updated');

            } catch (e) {
                console.error('Friends sync error:', e);
            }
        }