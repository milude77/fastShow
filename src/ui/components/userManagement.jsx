import React, { useState, useEffect } from 'react';
import { Popconfirm, Button } from "antd"
import { CheckOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

function UserManagement() {
    const { t } = useTranslation();
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
        return <div>{t('user.loadingList')}</div>;
    }

    const userIds = Object.keys(userList);

    if (userIds.length === 0) {
        return <div>{t('user.noUserInfo')}</div>;
    }

    return (
        <div>
            <ul className='user-list' style={{ listStyleType: 'none', padding: 0 }}>
                {userIds.map((userId) => {
                    const user = userList[userId];
                    const userName = user && user.userName ? user.userName : t('user.noUsername');
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
                                        title={t('user.confirmRemove')}
                                        onConfirm={() => handleDeleteContact(userId)}
                                        okText={t('common.confirm')}
                                        cancelText={t('common.cancel')}
                                    > 
                                        <MinusCircleOutlined style={{ color: 'red', marginRight: '8px', width: '20px' }} />
                                    </Popconfirm>
                                    <Popconfirm
                                        title={`${t('user.confirmSwitch')} ${userName} ${t('common.confirm')}？`}
                                        onConfirm={() => handleSwichCurrentUser(userId)}
                                        okText={t('common.yes')}
                                        cancelText={t('common.no')}
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
