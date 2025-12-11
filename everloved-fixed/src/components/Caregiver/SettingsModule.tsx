'use client';

import React, { useState } from 'react';
import styles from './Caregiver.module.css';

const SettingsModule = () => {
    const [calmness, setCalmness] = useState(70);
    const [memoryAnchor, setMemoryAnchor] = useState(50);
    const [mode, setMode] = useState<'passive' | 'active'>('active');

    return (
        <div className={styles.settingsContainer}>
            <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Voice Calmness ({calmness}%)</label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={calmness}
                        onChange={(e) => setCalmness(Number(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Memory Anchor Level ({memoryAnchor}%)</label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={memoryAnchor}
                        onChange={(e) => setMemoryAnchor(Number(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Conversation Mode</label>
                <div className={styles.toggleContainer}>
                    <button
                        className={`${styles.toggleBtn} ${mode === 'passive' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setMode('passive')}
                    >
                        Passive
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${mode === 'active' ? styles.toggleBtnActive : ''}`}
                        onClick={() => setMode('active')}
                    >
                        Active
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModule;
