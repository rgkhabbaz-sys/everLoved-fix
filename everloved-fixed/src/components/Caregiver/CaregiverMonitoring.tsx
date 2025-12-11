'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Clock, AlertCircle } from 'lucide-react';
import styles from './Caregiver.module.css';

interface TranscriptMessage {
    sender: 'patient' | 'avatar';
    text: string;
    timestamp: string;
}

const CaregiverMonitoring = () => {
    const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load transcript and poll for updates
    useEffect(() => {
        const loadTranscript = () => {
            const saved = localStorage.getItem('everloved_transcript');
            if (saved) {
                setTranscript(JSON.parse(saved));
            }
        };

        loadTranscript();
        const interval = setInterval(loadTranscript, 1000); // Poll every second

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    return (
        <div className={styles.grid}>
            {/* Real-Time Transcripts */}
            <div className={styles.card} style={{ gridColumn: 'span 2' }}>
                <div className={styles.cardHeader}>
                    <MessageSquare className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Live Transcript</h2>
                </div>
                <div className={styles.transcriptContainer} ref={scrollRef}>
                    {transcript.length === 0 ? (
                        <p style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>No active conversation yet.</p>
                    ) : (
                        transcript.map((msg, index) => (
                            <div
                                key={index}
                                className={`${styles.message} ${msg.sender === 'patient' ? styles.messagePatient : styles.messageAvatar}`}
                            >
                                {msg.text}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Intervention Tools */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <AlertCircle className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Intervention</h2>
                </div>

                <div className={styles.formGroup}>
                    <button className={styles.emergencyButton}>
                        <AlertCircle size={20} />
                        Emergency Pause
                    </button>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Schedule Manager</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Clock size={16} color="var(--secondary)" />
                        <span style={{ color: 'var(--foreground)' }}>Active Hours: 9:00 AM - 8:00 PM</span>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Core Memory Input</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="text" className={styles.input} placeholder="e.g. Wedding 1960" />
                        <button className={styles.tabButton} style={{ background: 'rgba(255,255,255,0.1)' }}>Add</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CaregiverMonitoring;
