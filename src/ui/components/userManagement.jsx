import React, { useState, useEffect } from 'react';
import { Popconfirm, Button } from "antd"
import { CheckOutlined, MinusCircleOutlined } from '@ant-design/icons';

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

    const handleDeleteContact = async (removeUserId) => {
        await window.electronAPI.deleteUser(removeUserId)
        window.electronAPI.getUserListCredentials().then(setUserList)
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
                        <div className='user-infomation-list' style={{ flex:1,display: 'flex' ,justifyContent: 'space-between', padding: '5px 0' }}>
                            <span>{userId}</span>
                            <span style={{ textAlign: 'right' }}>{userName}</span>
                        </div>
                    );

                    return (
                        <li key={userId} style={{ marginBottom: '10px' ,borderBottom: '1px solid #ccc'}}>
                            {isCurrentUser ? (
                                <div style = {{display:"flex", justifyContent: 'space-between'}} >
                                    <CheckOutlined style={{ color: 'green', marginRight: '8px', width: '20px' }} />
                                    {userInfo}
                                </div>
                            ) : (
                                <div style = {{display:"flex", justifyContent: 'space-between'}} >
                                    <Popconfirm
                                        title="确定要移除该账号吗？"
                                        onConfirm={() => handleDeleteContact(userId)}
                                        okText="确定"
                                        cancelText="取消"
                                    > 
                                        <MinusCircleOutlined style={{ color: 'red', marginRight: '8px', width: '20px' }} />
                                    </Popconfirm>
                                    <Popconfirm
                                        title={`确定切换到用户 ${userName} 吗？`}
                                        onConfirm={() => handleSwichCurrentUser(userId)}
                                        okText="是"
                                        cancelText="否"
                                    >
                                        {userInfo}
                                    </Popconfirm>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default UserManagement;
