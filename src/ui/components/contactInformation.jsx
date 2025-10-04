import React from 'react';
import { Button,Dropdown,Menu } from 'antd';
import { DashOutlined } from '@ant-design/icons';
import '../css/contactInformation.css';
import { Modal } from 'antd';

const ContactInformation = ({ contactInformation, toSendMessage, deleteContact }) => {
    const [modal, modalContextHolder] = Modal.useModal();
    const handleDeleteContact = (contactId) => {
        modal.confirm({
            zIndex: 2000,
            title: '删除好友',
            content: '确定要删除该好友吗？',
            okText: '确定',
            cancelText: '取消',
            onOk: () => {
                deleteContact(contactId);
            },
        });
    }

    const MenuItem = (
        <Menu>
            <Menu.Item className='menu-item-delete' key="1">
                <Button type="link" style={{ color : "red"}} onClick={() => handleDeleteContact(contactInformation.id)}>删除好友</Button>
            </Menu.Item>
        </Menu>
    );


    return (
        <div className='contact-information-container'>
            {modalContextHolder}
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