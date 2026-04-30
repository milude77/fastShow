import React from 'react';
import './css/groupMember.css';
import Avatar from '../avatar.jsx';
import { Virtuoso } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import { useUserAvatar } from '../../hooks/useAvatar.js';

const GroupMember = React.memo(({ members }) => {
    const { t } = useTranslation();
    const { getAvatarUrl } = useUserAvatar();
    return (
        <div className="group-notice-bar group-member-list">
            <span>{`${t('group.members')} ${members.length}`}</span>
            {members && members.length > 0 && (
                <Virtuoso
                    style={{ height: '100%' }}
                    data={members}
                    itemContent={(index, member) => (
                        <div className="group-member" key={member.member_id}>
                            <Avatar src={getAvatarUrl(member.member_id)} size={20} />
                            <span>{member.member_name}</span>
                        </div>
                    )}
                />

            )}
        </div>
    );
});

export default GroupMember;