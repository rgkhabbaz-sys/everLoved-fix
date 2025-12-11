'use client';

import React from 'react';
import { MessageCircle, Music, Wind, Video } from 'lucide-react';
import styles from './Patient.module.css';

interface TherapyModesProps {
    currentMode: 'clinical' | 'video' | 'music' | 'meditation';
    onModeSelect: (mode: 'clinical' | 'video' | 'music' | 'meditation') => void;
}

const TherapyModes: React.FC<TherapyModesProps> = ({ currentMode, onModeSelect }) => {
    const modes = [
        { id: 'clinical' as const, label: 'Conversation', icon: MessageCircle },
        { id: 'video' as const, label: 'Video', icon: Video },
        { id: 'music' as const, label: 'Music', icon: Music },
        { id: 'meditation' as const, label: 'Calm', icon: Wind },
    ];

    return (
        <div className={styles.modesContainer}>
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    className={`${styles.modeButton} ${currentMode === mode.id ? styles.activeMode : ''}`}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering parent click events
                        onModeSelect(mode.id);
                    }}
                >
                    <mode.icon size={16} />
                    {mode.label}
                </button>
            ))}
        </div>
    );
};

export default TherapyModes;
