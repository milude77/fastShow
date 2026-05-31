import { useCallback, useEffect } from "react"
import { useState } from "react"
import { List, Divider, Empty, Typography, Button } from 'antd'
import { UserOutlined, TeamOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons'
import Avatar from './avatar.jsx'
import { formatTime } from '../utils/timeFormatter.js'
import styles from '../css/searchList.module.css'
import { useUserAvatar } from '../hooks/useAvatar.js';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography

export default function SearchList({ ref, searchMessage }) {
    const [searchResults, setSearchResults] = useState({
        friends: [],
        groups: [],
        messages: [],
        groupMembers: []
    })
    const [loading, setLoading] = useState(false)
    const { getAvatarUrl } = useUserAvatar();
    const { t } = useTranslation();

    const handleSearch = useCallback(async () => {
        if (!searchMessage || searchMessage.trim() === '') {
            setSearchResults({
                friends: [],
                groups: [],
                messages: [],
                groupMembers: []
            })
            return
        }

        setLoading(true)
        try {
            const response = await window.electronAPI.searchLocalHistory(searchMessage);
            setSearchResults(response || {
                friends: [],
                groups: [],
                messages: [],
                groupMembers: []
            })
        } catch (error) {
            console.error('搜索失败:', error)
        } finally {
            setLoading(false)
        }
    }, [searchMessage])

    useEffect(() => {
        handleSearch()
    }, [searchMessage, handleSearch])

    // 渲染好友列表
    const renderFriends = () => {
        if (searchResults.friends.length === 0) {
            return null
        }

        return (
            <div className="search-section">
                <div className="section-header">
                    <UserOutlined className="section-icon" />
                    <Title level={5} className="section-title">好友 ({searchResults.friends.length})</Title>
                </div>
                <List
                    dataSource={searchResults.friends}
                    renderItem={(friend) => (
                        <List.Item className={styles.searchListItem}>
                            <List.Item.Meta
                                avatar={<Avatar size={40} src={getAvatarUrl(friend.id)} icon={<UserOutlined />} />}
                                title={<Text strong>{friend.username}</Text>}
                                description={<Text type="secondary">ID: {friend.id}</Text>}
                            />
                        </List.Item>
                    )}
                />
            </div>
        )
    }

    // 渲染群组列表
    const renderGroups = () => {
        if (searchResults.groups.length === 0) {
            return null
        }

        return (
            <div className="search-section">
                <div className="section-header">
                    <TeamOutlined className="section-icon" />
                    <Title level={5} className="section-title">群组 ({searchResults.groups.length})</Title>
                </div>
                <List
                    dataSource={searchResults.groups}
                    renderItem={(group) => (
                        <List.Item className={styles.searchListItem}>
                            <List.Item.Meta
                                avatar={<Avatar size={40} src={getAvatarUrl(group.id, 'group')} icon={<TeamOutlined />} />}
                                title={<Text strong>{group.username}</Text>}
                                description={<Text type="secondary">ID: {group.id}</Text>}
                            />
                        </List.Item>
                    )}
                />
            </div>
        )
    }

    // 渲染消息列表
    const renderMessages = () => {
        if (searchResults.messages.length === 0) {
            return null
        }

        return (
            <div className="search-section">
                <div className="section-header">
                    <MessageOutlined className="section-icon" />
                    <Title level={5} className="section-title">消息 ({searchResults.messages.length})</Title>
                </div>
                <List
                    dataSource={searchResults.messages}
                    renderItem={(message) => (
                        <List.Item className={styles.searchListItem}>
                            <div className="message-content">
                                <div className="message-header">
                                    <Text type="secondary" className="message-time">
                                        {formatTime(message.timestamp)}
                                    </Text>
                                </div>
                                <Text className="message-text">{message.text}</Text>
                                {message.sender_id && (
                                    <Text type="secondary" className="message-sender">
                                        发送者ID: {message.sender_id}
                                    </Text>
                                )}
                            </div>
                        </List.Item>
                    )}
                />
            </div>
        )
    }

    // 渲染群组成员列表
    const renderGroupMembers = () => {
        if (searchResults.groupMembers.length === 0) {
            return null
        }

        return (
            <div className="search-section">
                <div className="section-header">
                    <UserOutlined className="section-icon" />
                    <Title level={5} className="section-title">群组成员 ({searchResults.groupMembers.length})</Title>
                </div>
                <List
                    dataSource={searchResults.groupMembers}
                    renderItem={(member) => (
                        <List.Item className={styles.searchListItem}>
                            <List.Item.Meta
                                avatar={<Avatar size={40} src={getAvatarUrl(member.member_id)} icon={<UserOutlined />} />}
                                title={<Text strong>{member.member_name}</Text>}
                                description={
                                    <>
                                        <Text type="secondary">成员ID: {member.member_id}</Text>
                                        <br />
                                        <Text type="secondary">群组ID: {member.group_id}</Text>
                                    </>
                                }
                            />
                        </List.Item>
                    )}
                />
            </div>
        )
    }


    return (
        <div ref={ref} className={styles.searchListContainerVertical}>
            {!searchMessage || searchMessage.trim() === '' ? (
                <div className={styles.searchEmptyState}>
                    <SearchOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <Title level={4}>输入关键词开始搜索</Title>
                    <Text type="secondary">可以搜索好友、群组、消息和群组成员</Text>
                </div>
            ) : loading ? (
                <div className={styles.searchLoadingState}>
                    <Text type="secondary">搜索中...</Text>
                </div>
            ) : (
                <div className={styles.searchResultsVertical}>
                    {renderFriends()}
                    {(searchResults.friends.length > 0 && (searchResults.groups.length > 0 || searchResults.messages.length > 0 || searchResults.groupMembers.length > 0)) && <Divider />}

                    {renderGroups()}
                    {(searchResults.groups.length > 0 && (searchResults.messages.length > 0 || searchResults.groupMembers.length > 0)) && <Divider />}

                    {renderMessages()}
                    {(searchResults.messages.length > 0 && searchResults.groupMembers.length > 0) && <Divider />}

                    {renderGroupMembers()}
                </div>
            )}
            <Button onClick={ async() => window.electronAPI.openSearchWindow(searchMessage) } type="primary" className="search-button" icon={<SearchOutlined />}>
                {t('search.searchButtonLabel', { searchContent: searchMessage  })}
            </Button>
        </div>
    )
}
