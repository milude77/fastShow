import React, { useState, useEffect } from 'react';

function UserManagement() {
    const [userList, setUserList] = useState({});
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div>正在加载用户列表...</div>;
    }

    const userIds = Object.keys(userList);

    if (userIds.length === 0) {
        return <div>未找到用户信息</div>;
    }

    return (
        <div>
            <h3>用户列表</h3>
            <ul className='user-list'>
                {userIds.map((userId) => {
                    const user = userList[userId];
                    const userName = user && user.userName ? user.userName : '（无用户名）';
                    return (
                        <li key={userId}>
                            <span>ID: {userId}</span>
                            <span> - </span>
                            <span>用户名: {userName}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default UserManagement;
