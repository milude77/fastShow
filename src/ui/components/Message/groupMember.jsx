import React from 'react';
import './css/groupMember.css';
import Avatar from '../avatar.jsx';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../../hooks/useAvatar.js';

const GroupMember = React.memo(({ members }) => {
    const { t } = useTranslation();
    const { getAvatarUrl } = useUserAvatar();
    return (
        <div className="group-notice-bar group-member-list">
            <span>{`${t('group.members')} ${members.length}`}</span>
            {members.map((member, index) => {
                return (
                    <div className="group-member" key={index}>
                        <Avatar
                            size={20}
                            src={getAvatarUrl(member.member_id)}
                            alt={member.member_name} />
                        <div className="group-member-name">{member.member_name}</div>
                    </div>
                )
            })}
        </div>
    );
});

export default GroupMember;