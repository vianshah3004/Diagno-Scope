import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    User, Activity, Brain, Monitor, Settings as SettingsIcon,
    LogOut, Trash2
} from 'lucide-react';
import { getSettings, saveSettings } from '../utils/storage';
import './Settings.css';

const Settings = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const [settings, setSettings] = useState(getSettings());
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
        }
    }, [currentUser, navigate]);

    useEffect(() => {
        setSettings(prev => ({ ...prev, theme: theme }));
    }, [theme]);

    const handleSettingChange = (key, value) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };

            if (key === 'defaultModality') {
                if (value === 'MRI') {
                    newSettings.defaultDisease = 'Tumor';
                } else if (value === 'X-Ray') {
                    newSettings.defaultDisease = 'Pneumonia';
                }
            }

            saveSettings(newSettings);
            return newSettings;
        });

        if (key === 'theme' && value !== theme) {
            toggleTheme();
        }
    };

    const handleProfileSave = () => {
        saveSettings(settings);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch {
            console.error("Failed to log out");
        }
    };

    const clearCache = () => {
        if (window.confirm('Are you sure you want to clear local cache? This will reset recent history.')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    if (!currentUser) return null;

    return (
        <div className="settings-page page-transition container">
            <div className="settings-header">
                <h1 className="settings-title">Settings</h1>
                <p className="settings-subtitle">Manage your preferences, diagnostic tools, and account.</p>
            </div>

            <div className="settings-grid">

                {/* 1. Professional Profile */}
                <section className="settings-section glass-panel profile-highlight">
                    <div className="section-title">
                        <User size={20} />
                        <h3>Professional Profile</h3>
                    </div>

                    <div className="live-profile-card">
                        <div className="profile-avatar-circle">
                            {(currentUser.doctor_name || 'D').charAt(0).toUpperCase()}
                        </div>
                        <div className="profile-info-text">
                            <h4>{currentUser.doctor_name || 'Dr. User'}</h4>
                            {/* <span className="badge">Active Session</span> */}
                        </div>
                    </div>

                    <div className="setting-form-group">
                        <label className="setting-label">Full Name</label>
                        <input type="text" className="form-input disabled" value={currentUser.doctor_name || 'Dr. User'} readOnly />
                    </div>
                    {/* Associated Hospital removed per user request */}

                    <div className="action-row">
                        <button className="btn-primary" onClick={handleProfileSave}>
                            {isSaved ? "✓ Profile Saved" : "Save Profile Details"}
                        </button>
                        <button className="btn-danger small" onClick={handleLogout}>
                            <LogOut size={14} style={{ marginRight: 5 }} /> Logout
                        </button>
                    </div>
                </section>

                {/* 2. Interface Settings (Theme) */}
                <section className="settings-section glass-panel">
                    <div className="section-title">
                        <Monitor size={20} />
                        <h3>Interface</h3>
                    </div>
                    <div className="setting-item">
                        <span className="setting-label">Theme Mode</span>
                        <div className="radio-group">
                            <button
                                className={`radio-btn ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => handleSettingChange('theme', 'dark')}
                            >Dark</button>
                            <button
                                className={`radio-btn ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => handleSettingChange('theme', 'light')}
                            >Light</button>
                        </div>
                    </div>
                    <SettingToggle
                        label="Keyboard Shortcuts"
                        checked={settings.shortcuts}
                        onChange={() => handleSettingChange('shortcuts', !settings.shortcuts)}
                        description="Enable hotkeys like 'Ctrl+S' for quick saving case data and 'Ctrl+U' for uploading new scans instantly."
                    />
                    <SettingToggle
                        label="Auto-Save Form Inputs"
                        checked={settings.autoSave}
                        onChange={() => handleSettingChange('autoSave', !settings.autoSave)}
                        description="Automatically saves your case ID and report choices locally every 5 seconds to prevent data loss."
                    />
                </section>

                {/* 3. Diagnostic Preferences */}
                <section className="settings-section glass-panel">
                    <div className="section-title">
                        <Activity size={20} />
                        <h3>Diagnostic Preferences</h3>
                    </div>

                    <div className="setting-item">
                        <span className="setting-label">Default Imaging Modality</span>
                        <div className="radio-group">
                            {['X-Ray', 'MRI'].map(m => (
                                <button
                                    key={m}
                                    className={`radio-btn ${settings.defaultModality === m ? 'active' : ''}`}
                                    onClick={() => handleSettingChange('defaultModality', m)}
                                >{m}</button>
                            ))}
                        </div>
                    </div>

                    <div className="setting-item animate-slide-down">
                        <span className="setting-label">Default Disease Type</span>
                        {settings.defaultModality === 'MRI' ? (
                            <input type="text" className="form-input disabled" style={{ width: '120px', textAlign: 'center' }} value="Tumor" readOnly disabled />
                        ) : (
                            <div className="radio-group">
                                {['Pneumonia', 'Fracture'].map(d => (
                                    <button
                                        key={d}
                                        className={`radio-btn ${settings.defaultDisease === d ? 'active' : ''}`}
                                        onClick={() => handleSettingChange('defaultDisease', d)}
                                    >{d}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Auto-generate Case ID removed per user request */}
                </section>

                {/* 4. AI & Analysis */}
                <section className="settings-section glass-panel">
                    <div className="section-title">
                        <Brain size={20} />
                        <h3>AI & Analysis</h3>
                    </div>
                    <SettingToggle
                        label="Enable AI-Assisted Analysis"
                        checked={settings.aiAssisted}
                        onChange={() => handleSettingChange('aiAssisted', !settings.aiAssisted)}
                        description="Toggles the deep learning engine. If disabled, the system acts as a standard DICOM viewer without predictions."
                    />
                    <SettingToggle
                        label="Show Confidence Scores"
                        checked={settings.showConfidence}
                        onChange={() => handleSettingChange('showConfidence', !settings.showConfidence)}
                        description="Displays model certainty (e.g., 92.8%) next to the result. Hover for more details on reliability."
                    />
                    <SettingToggle
                        label="Require Manual Review"
                        checked={settings.manualReview}
                        onChange={() => handleSettingChange('manualReview', !settings.manualReview)}
                        description="Forces a 'Pending' status until a physician explicitly clicks Accept/Reject. Vital for compliance."
                    />
                </section>

                {/* 5. System */}
                <section className="settings-section glass-panel">
                    <div className="section-title">
                        <SettingsIcon size={20} />
                        <h3>System</h3>
                    </div>
                    <div className="setting-item clickable" onClick={clearCache}>
                        <span className="setting-label text-danger">Clear Local Cache</span>
                        <Trash2 size={16} className="text-danger" />
                    </div>
                </section>

            </div>
        </div>
    );
};

const SettingToggle = ({ label, checked, onChange, description }) => (
    <div className="setting-item">
        <div className="tooltip-container">
            <span className="setting-label" style={{ borderBottom: '1px dotted var(--text-muted)' }}>{label}</span>
            {description && <span className="tooltip-text">{description}</span>}
        </div>
        <Toggle checked={checked} onChange={onChange} />
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <label className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider round"></span>
    </label>
);

export default Settings;