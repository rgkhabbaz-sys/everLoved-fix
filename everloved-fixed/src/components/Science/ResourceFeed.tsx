'use client';

import React from 'react';
import Image from 'next/image';
import PageLayout from '../UI/PageLayout';
import ArticleCard from './ArticleCard';
import { motion } from 'framer-motion';
import styles from './Science.module.css';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.5
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 2.0,
            ease: "easeInOut" as const
        }
    }
};

const ResourceFeed = () => {
    const articles = [
        {
            id: 1,
            category: 'Research',
            date: 'Nov 28, 2025',
            title: 'Breakthrough in Non-Invasive Memory Stimulation',
            summary: 'New study shows promising results using 40Hz gamma frequency light and sound therapy to reduce amyloid plaques.'
        },
        {
            id: 2,
            category: 'Caregiving',
            date: 'Nov 25, 2025',
            title: 'The Power of Personalized Music Therapy',
            summary: 'How curated playlists from a patient\'s youth can significantly reduce agitation and improve mood.'
        },
        {
            id: 3,
            category: 'Clinical Trials',
            date: 'Nov 20, 2025',
            title: 'Phase 3 Trial Results for Leqembi',
            summary: 'Detailed analysis of the latest clinical data on the efficacy and safety profile of the new antibody treatment.'
        },
        {
            id: 4,
            category: 'Wellness',
            date: 'Nov 18, 2025',
            title: 'Circadian Rhythms and Dementia',
            summary: 'Understanding the importance of light exposure and sleep hygiene in managing sundowning symptoms.'
        },
        {
            id: 5,
            category: 'Technology',
            date: 'Nov 15, 2025',
            title: 'AI Companions in Elderly Care',
            summary: 'Ethical considerations and practical benefits of using AI avatars for social engagement.'
        },
        {
            id: 6,
            category: 'Nutrition',
            date: 'Nov 10, 2025',
            title: 'The MIND Diet: Updated Guidelines',
            summary: 'Recent findings on specific nutrients that may slow cognitive decline in early-stage Alzheimer\'s.'
        }
    ];

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
                        src="/science-bg-new.png"
                        alt="Dramatic Cliffside Landscape"
                        fill
                        className={styles.backgroundImage}
                        priority
                    />
                </motion.div>
                <div className={styles.overlay} />
            </div>

            <motion.div
                className={styles.feedContainer}
                variants={container}
                initial="hidden"
                animate="show"
            >
                <PageLayout>
                    <header className={styles.header}>
                        <h1 className={styles.title}>New Science</h1>
                        <p className={styles.subtitle}>
                            Curated research, clinical updates, and therapeutic resources for the modern caregiver.
                        </p>
                    </header>

                    <div className={styles.grid}>
                        {articles.map((article) => (
                            <motion.div key={article.id} variants={item}>
                                <ArticleCard
                                    title={article.title}
                                    summary={article.summary}
                                    date={article.date}
                                    category={article.category}
                                />
                            </motion.div>
                        ))}
                    </div>
                </PageLayout>
            </motion.div>
        </div>
    );
};

export default ResourceFeed;
