import React from 'react';
import './css/groupMember.css';
import Avatar from '../avatar.jsx';
import { useTranslation } from 'react-i18next';

const GroupMember = React.memo(({ members, serverUrl, currentUser }) => {
    const { t } = useTranslation();
    return (
        <div className="group-notice-bar group-member-list">
            <span>{`${t('group.members')} ${members.length}`}</span>
            {members.map((member, index) => {
                return (
                    <div className="group-member" key={index}>
                        <Avatar
                            size={20}
                            src={`${serverUrl}/api/avatar/${member.member_id}/user?t=${member.member_id === currentUser.user_id ? currentUser.avatar_version : ''}`}
                            alt={member.member_name} />
                        <div className="group-member-name">{member.member_name}</div>
                    </div>
                )
            })}
        </div>
    );
});

export default GroupMember;