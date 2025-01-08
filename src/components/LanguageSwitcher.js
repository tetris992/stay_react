// src/components/LanguageSwitcher.js

import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css'; // 스타일링 추가

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const currentLanguage = i18n.language;

    const languages = [
        { code: 'ko', label: '한국어' },
        { code: 'en', label: 'English' },
        { code: 'zh', label: '中文' },
        { code: 'ja', label: '日本語' },
    ];

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="language-switcher">
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`lang-button ${currentLanguage === lang.code ? 'active' : ''}`}
                    aria-label={`Change language to ${lang.label}`}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitcher;
