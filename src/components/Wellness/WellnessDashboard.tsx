'use client';

import React from 'react';
import Image from 'next/image';
import {
    MessageSquare,
    Mic,
    Sun,
    Smile,
    Compass,
    Moon,
    Activity,
    Droplets
} from 'lucide-react';
import { motion } from 'framer-motion';
import MetricCard from './MetricCard';
import PageLayout from '../UI/PageLayout';
import styles from './Wellness.module.css';

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

const WellnessDashboard = () => {
    return (
        <div className={styles.container}>
            <div className={styles.backgroundWrapper}>
                <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.1 }}
                    transition={{
                        duration: 40,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                    }}
                    style={{ width: '100%', height: '100%', position: 'absolute' }}
                >
                    <Image
                        src="/wellness-bg-final-v2.jpg"
                        alt="Grand Canyon Landscape V2"
                        fill
                        className={styles.backgroundImage}
                        priority
                    />
                </motion.div>
                <div className={styles.overlay} />
            </div>

            <motion.div
                className={styles.dashboard}
                variants={container}
                initial="hidden"
                animate="show"
            >
                <PageLayout>
                    <header className={styles.header}>
                        <h1 className={styles.title}>Digital Biomarkers</h1>
                        <p className={styles.subtitle}>
                            Longitudinal monitoring of cognitive, behavioral, and physiological indicators.
                        </p>
                    </header>

                    <div className={styles.grid}>
                        {/* Card 1: Verbal Perseveration */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Verbal Perseveration"
                                value="12"
                                unit="events/hr"
                                icon={MessageSquare}
                                status="good"
                                trend="↓ 10%"
                                context="Tracks repetitive questioning frequency via NLP."
                                data={[18, 16, 15, 14, 12, 13, 12]}
                            />
                        </motion.div>

                        {/* Card 2: Semantic Density */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Aphasia Risk"
                                value="0.8"
                                unit="Noun/Verb Ratio"
                                icon={Mic}
                                status="neutral"
                                trend="Stable"
                                context="Monitors vocabulary richness and speech latency."
                                data={[0.78, 0.79, 0.8, 0.81, 0.8, 0.79, 0.8]}
                            />
                        </motion.div>

                        {/* Card 3: Circadian Agitation */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Sundowning Onset"
                                value="16:30"
                                unit="PM"
                                icon={Sun}
                                status="warning"
                                trend="Earlier"
                                context="Maps high-arousal voice tones to time-of-day."
                                data={[17.0, 17.2, 16.8, 16.5, 16.5, 16.2, 16.5]} // Decimal hours
                            />
                        </motion.div>

                        {/* Card 4: Affective State */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Emotional Range"
                                value="40%"
                                unit="Positive Valence"
                                icon={Smile}
                                status="neutral"
                                trend="Flat Affect: 15%"
                                context="Tracks facial micro-expressions and vocal prosody."
                                data={[35, 38, 42, 40, 39, 41, 40]}
                            />
                        </motion.div>

                        {/* Card 5: Spatiotemporal Awareness */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Orientation"
                                value="28"
                                unit="/ 30"
                                icon={Compass}
                                status="good"
                                trend="Stable"
                                context="Accuracy of responses to daily orientation checks."
                                data={[27, 28, 28, 29, 28, 28, 28]}
                            />
                        </motion.div>

                        {/* Card 6: Sleep Fragmentation */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Sleep Quality (WASO)"
                                value="4x"
                                unit="Wakes/night"
                                icon={Moon}
                                status="warning"
                                trend="↑ 1x"
                                context="Wake After Sleep Onset events (wearable data)."
                                data={[2, 3, 2, 3, 4, 3, 4]}
                            />
                        </motion.div>

                        {/* Card 7: Gait Velocity */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Gait Velocity"
                                value="0.8"
                                unit="m/s"
                                icon={Activity}
                                status="neutral"
                                trend="Stable"
                                context="Walking speed and steadiness (Fall risk indicator)."
                                data={[0.82, 0.81, 0.8, 0.79, 0.8, 0.81, 0.8]}
                            />
                        </motion.div>

                        {/* Card 8: Hydration */}
                        <motion.div variants={item}>
                            <MetricCard
                                title="Hydration Adherence"
                                value="1.2"
                                unit="L / day"
                                icon={Droplets}
                                status="warning"
                                trend="↓ Low Warning"
                                context="Logged fluid intake frequency."
                                data={[1.5, 1.4, 1.3, 1.3, 1.2, 1.1, 1.2]}
                            />
                        </motion.div>
                    </div>
                </PageLayout>
            </motion.div>
        </div>
    );
};

export default WellnessDashboard;
