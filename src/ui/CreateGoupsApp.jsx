import { React, useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import AppHeaderBar from './components/appHeaderBar.jsx';
import './css/createGoupsApp.css';
import { Checkbox, Input, Select } from 'antd/lib/index.js';
import { useSocket } from './hooks/useSocket';

const CreateGoupsApp = () => {

    const [contacts, setContacts] = useState([]);
    const [checkedContacts, setCheckedContacts] = useState([]);
    const socket = useSocket();

    useEffect(() => {
        window.electronAPI.getFriendsList().then((friends) => {
            setContacts(friends);
        });
    }, []);



    useEffect(() => {
        const handleGropCreateSuccess = () => {
            console.log('群聊创建成功');
        }


        socket.on('grops-create-success',handleGropCreateSuccess);
        
        return () => {
            socket.off('grops-create-success',handleGropCreateSuccess);
        }
    }, []);


    return (
        <div className='create-groups-app-container'>
            <AppHeaderBar />
            <div className='create-groups-app-content'>
                <div className='friends-list'>
                    <span className='create-group-title'>选择好友创建</span>
                    {contacts && contacts.map((contact, index) => (
                        <div key={index} className='friend-item'
                            onClick={() => {
                                if (checkedContacts.some(c => c.id === contact.id)) {
                                    setCheckedContacts(checkedContacts.filter(c => c.id !== contact.id));
                                } else {
                                    setCheckedContacts([...checkedContacts, contact]);
                                }
                            }}
                        >
                            <Checkbox
                                className='friend-checkbox'
                                checked={checkedContacts.some(c => c.id === contact.id)}
                            />
                            {contact.userName}
                        </div>
                    ))}
                </div>
                <div className='create-group-form'>
                    <span className='create-group-title'>创建群聊</span>
                    {checkedContacts && checkedContacts.map((contact, index) => (
                        <div key={index} className='selected-contact-item'>
                            <div key={index} className='friend-item'>
                                <span>{contact.userName}</span>
                            </div>
                        </div>
                    ))}
                    <Button
                        className='create-group-button'
                        type='primary'
                        disabled={checkedContacts.length === 0}
                        onClick={() => {
                            socket.emit('create-group', {checkedContacts});
                        }}
                        style={{ marginTop: 12 }}
                    >
                        创建群聊
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default CreateGoupsApp;