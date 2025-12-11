'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import PageTransition from '../UI/PageTransition';
import PageLayout from '../UI/PageLayout';
import AvatarCreation from './AvatarCreation';
import CaregiverMonitoring from './CaregiverMonitoring';
import CognitiveAnalytics from './CognitiveAnalytics';
import { motion } from 'framer-motion';
import styles from './Caregiver.module.css';

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('configuration');

    return (
        <div className={styles.container}>
            <div className={styles.backgroundWrapper}>
                <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.3 }}
                    transition={{
                        duration: 35,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                    }}
                    style={{ width: '100%', height: '100%', position: 'absolute' }}
                >
                    <Image
                        src="/thailand-bg.png"
                        alt="Serene Thailand Landscape"
                        fill
                        className={styles.backgroundImage}
                        priority
                    />
                </motion.div>
                <div className={styles.overlay} />
            </div>

            <PageTransition className={styles.dashboard}>
                <PageLayout>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Caregiver Command Center</h1>
                        <p className={styles.subtitle}>Configure avatar, monitor interactions, and analyze well-being.</p>
                    </header>

                    <div className={styles.tabsContainer}>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'configuration' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('configuration')}
                        >
                            Avatar Configuration
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'monitoring' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('monitoring')}
                        >
                            Monitoring Dashboard
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'analytics' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('analytics')}
                        >
                            Cognitive Analytics
                        </button>
                    </div>

                    {activeTab === 'configuration' && <AvatarCreation />}
                    {activeTab === 'monitoring' && <CaregiverMonitoring />}
                    {activeTab === 'analytics' && <CognitiveAnalytics />}
                </PageLayout>
            </PageTransition>
        </div>
    );
};

export default Dashboard;
