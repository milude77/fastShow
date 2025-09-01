import React, { useState, useEffect } from 'react';
import { Popconfirm, Button } from "antd"

function UserManagement() {
    const [userList, setUserList] = useState({});
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);


    useEffect(() => {
        window.electronAPI.getCurrentUserCredentials().then(setCurrentUser)
    }, []);

    useEffect(() => {
        const fetchUserList = async () => {
            try {
                const list = await window.electronAPI.getUserListCredentials();
                setUserList(list);
            } catch (error) {
                console.error("Failed to fetch user list:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserList();
    }, []);

    const handleSwichCurrentUser = (switchUserId) => {
        window.electronAPI.switchUser(switchUserId)
    }

    if (loading) {
        return <div>正在加载用户列表...</div>;
    }

    const userIds = Object.keys(userList);

    if (userIds.length === 0) {
        return <div>未找到用户信息</div>;
    }

    return (
        <div>
            <ul className='user-list' style={{ listStyleType: 'none', padding: 0 }}>
                {userIds.map((userId) => {
                    const user = userList[userId];
                    const userName = user && user.userName ? user.userName : '（无用户名）';
                    const isCurrentUser = currentUser?.userId == userId;

                    const userInfo = (
                        <div className='user-infomation-list' style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                            <span style={{ visibility: isCurrentUser ? 'visible' : 'hidden' ,color: 'green',width: '40px' }}>√</span>
                            <span style={{ flex:1}}>{userId}</span>
                            <span style={{ flex:1, textAlign: 'right' }}>{userName}</span>
                        </div>
                    );

                    return (
                        <li key={userId} style={{ marginBottom: '10px' ,borderBottom: '1px solid #ccc'}}>
                            {isCurrentUser ? (
                                userInfo
                            ) : (
                                <Popconfirm
                                    title={`确定切换到用户 ${userName} 吗？`}
                                    onConfirm={() => handleSwichCurrentUser(userId)}
                                    okText="是"
                                    cancelText="否"
                                >
                                    {userInfo}
                                </Popconfirm>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default UserManagement;
