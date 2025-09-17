import React from 'react';
import { Button,Dropdown,Menu } from 'antd';
import { DashOutlined } from '@ant-design/icons';
import '../css/contactInformation.css';

const ContactInformation = ({ contactInformation, toSendMessage }) => {
    const MenuItem = (
        <Menu>
            <Menu.Item className='menu-item-delete' key="1">
                删除好友
            </Menu.Item>
        </Menu>
    );


    return (
        <div className='contact-information-container'>
            <Dropdown className='contact-information-dropdown' overlay={MenuItem} trigger={['click']}>
                <DashOutlined />
            </Dropdown>
            <p style={{textAlign:'center'}}>id: {contactInformation?.id}</p>
            <p style={{textAlign:'center'}}>Name: {contactInformation?.username}</p>
            <Button className='contact-information-button' type="primary" onClick={() => toSendMessage(contactInformation)} >发消息</Button>
        </div>
    );

}


export default ContactInformation;