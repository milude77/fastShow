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
                            src={`${serverUrl}/api/avatar/${member.userId}/user?t=${member.userId === currentUser.userId ? currentUser.avatarVersion : ''}`}
                            alt={member.userName} />
                        <div className="group-member-name">{member.userName}</div>
                    </div>
                )
            })}
        </div>
    );
});

export default GroupMember;