import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Modal } from 'antd';
import './css/generalManagement.css';

function GeneralManagement() {
    const { t } = useTranslation();
    const { i18n } = useTranslation();

    const [modalApi, contextHolder] = Modal.useModal();
    const [curLanguage, setCurLanguage] = useState(i18n.language);
    const [curTheme, setCurTheme] = useState(null);

    useEffect(() => {
        window.electronAPI.getSettingsValue('theme').then(setCurTheme)
    }, []);



    // 语言选项配置
    const languageOptions = [
        { value: 'en', label: 'English' },
        { value: 'zh', label: '简体中文' },
        { value: 'ru', label: 'Русский' }
    ];

    //主题选项配置
    const themeOptions = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
    ]

    const handleLanguageChange = async (value) => {
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

    const handleThemeChange = async (value) => {
        await window.electronAPI.updateTheme(value);
        setCurTheme(value);
    }

    return (
        <div className='general-settings-managerment' >
            {contextHolder}
            <div className='general-settings-item' >
                <span>{t('settings.language')}</span>
                <Select className='select-bar' value={curLanguage} onChange={(value) => handleLanguageChange(value)}>
                    {languageOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                            {option.label}
                        </Select.Option>
                    ))}
                </Select>
            </div>
            <div className='general-settings-item'>
                <span>{t('settings.theme')}</span>
                <Select className='select-bar' value={curTheme} onChange={(value) => handleThemeChange(value)}>
                    {themeOptions.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                            {option.label}
                        </Select.Option>
                    ))}
                </Select>
            </div>
        </div>
    );
}

export default GeneralManagement;