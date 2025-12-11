import React from 'react';
import { LucideIcon } from 'lucide-react';
import styles from './Wellness.module.css';
import Sparkline from './Sparkline';

interface MetricCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon: LucideIcon;
    status: 'good' | 'warning' | 'neutral';
    trend?: string;
    context?: string;
    data?: number[];
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    unit,
    icon: Icon,
    status,
    trend,
    context,
    data = []
}) => {
    const statusColor = status === 'good' ? '#4ade80' : status === 'warning' ? '#fbbf24' : '#94a3b8';

    return (
        <div className={styles.card} style={{ borderColor: status === 'warning' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(255, 255, 255, 0.1)' }}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{title}</h3>
                <div className={styles.iconWrapper} style={{ color: statusColor, borderColor: `rgba(${status === 'good' ? '74, 222, 128' : status === 'warning' ? '251, 191, 36' : '148, 163, 184'}, 0.2)` }}>
                    <Icon size={18} />
                </div>
            </div>

            <div className={styles.mainContent}>
                <div className={styles.valueGroup}>
                    <div className={styles.valueContainer}>
                        <span className={styles.value}>{value}</span>
                        {unit && <span className={styles.unit}>{unit}</span>}
                    </div>
                    {trend && (
                        <div className={styles.trend} style={{ color: trend.includes('↓') && status === 'good' ? '#4ade80' : trend.includes('↑') && status === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}>
                            {trend}
                        </div>
                    )}
                </div>

                <div className={styles.sparklineContainer}>
                    <Sparkline data={data} color={statusColor} />
                </div>
            </div>

            {context && (
                <div className={styles.context}>
                    {context}
                </div>
            )}

            <div className={styles.statusBar} style={{ background: statusColor }} />
        </div>
    );
};

export default MetricCard;
