import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Modal } from 'antd';
import './css/generalManagement.css';

function GeneralManagement() {
    const { t } = useTranslation();
    const { i18n } = useTranslation();

    const [modalApi, contextHolder] = Modal.useModal();
    const [curLanguage, setCurLanguage] = useState(i18n.language);

    // 语言选项配置
    const languageOptions = [
        { value: 'en', label: 'English' },
        { value: 'zh', label: '简体中文' },
        { value: 'ru', label: 'Русский' }
    ];

    const handleLanguageChange = (value) => {
        // 根据 value 查找对应的语言显示名称
        const selectedOption = languageOptions.find(opt => opt.value === value);
        const languageName = selectedOption ? selectedOption.label : value;

        modalApi.confirm({
            title: t('languageChange.title', { language: languageName }),
            content: t('languageChange.content'),
            onOk() {
                i18n.changeLanguage(value);
                window.electronAPI.updateLanguage(value);
                setCurLanguage(value);
            },
            onCancel() {
                setCurLanguage(i18n.language);
            },
        });
    }

    return (
        <div className='language-management' >
            {contextHolder}
            {t('settings.language')}
            <Select value={curLanguage} onChange={(value) => handleLanguageChange(value)}>
                {languageOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                        {option.label}
                    </Select.Option>
                ))}
            </Select>
        </div>
    );
}

export default GeneralManagement;