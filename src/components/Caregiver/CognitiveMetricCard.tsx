import React from 'react';
import { Info } from 'lucide-react';
import styles from './Caregiver.module.css';
import Sparkline from '../Wellness/Sparkline';

interface CognitiveMetricCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    trend?: string;
    insight: string;
    chartType: 'line' | 'bar-gauge' | 'sparkline' | 'scatter' | 'circle' | 'vertical-bar' | 'histogram' | 'trend-line';
    data?: any;
    color?: string;
}

const CognitiveMetricCard: React.FC<CognitiveMetricCardProps> = ({
    title,
    value,
    subValue,
    trend,
    insight,
    chartType,
    data,
    color = '#60a5fa' // Default blue
}) => {
    const renderChart = () => {
        switch (chartType) {
            case 'sparkline':
                return <Sparkline data={data} color={color} height={60} />;

            case 'line':
                return (
                    <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none">
                        <path
                            d={`M0,50 ${data.map((y: number, i: number) => `L${(i / (data.length - 1)) * 100},${50 - (y * 50)}`).join(' ')}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                        <path
                            d={`M0,50 ${data.map((y: number, i: number) => `L${(i / (data.length - 1)) * 100},${50 - (y * 50)}`).join(' ')} V50 H0`}
                            fill={color}
                            fillOpacity="0.1"
                        />
                    </svg>
                );

            case 'bar-gauge':
                return (
                    <div style={{ display: 'flex', gap: '4px', height: '100%', alignItems: 'flex-end' }}>
                        {[1, 2, 3].map((level) => (
                            <div
                                key={level}
                                style={{
                                    flex: 1,
                                    height: level === 1 ? '33%' : level === 2 ? '66%' : '100%',
                                    background: data >= level ? color : 'rgba(255,255,255,0.1)',
                                    borderRadius: '2px'
                                }}
                            />
                        ))}
                    </div>
                );

            case 'scatter':
                return (
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        {data.map((pt: { x: number, y: number }, i: number) => (
                            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={color} opacity="0.6" />
                        ))}
                        {/* Current State */}
                        <circle cx={data[data.length - 1].x} cy={data[data.length - 1].y} r="5" fill={color} stroke="#fff" strokeWidth="2" />
                    </svg>
                );

            case 'circle':
                const radius = 40;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (data / 100) * circumference;
                return (
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                        <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="50" textAnchor="middle" dy="0.3em" fill="#fff" fontSize="20" fontFamily="var(--font-mono)">{data}%</text>
                    </svg>
                );

            case 'vertical-bar':
                return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', height: '100%', alignItems: 'flex-end', gap: '8px' }}>
                        {data.map((val: number, i: number) => (
                            <div key={i} style={{ width: '100%', height: `${val}%`, background: color, borderRadius: '2px 2px 0 0', opacity: 0.8 }} />
                        ))}
                    </div>
                );

            case 'histogram':
                return (
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '2px' }}>
                        {data.map((val: number, i: number) => (
                            <div key={i} style={{ flex: 1, height: `${val}%`, background: color, opacity: 0.6 }} />
                        ))}
                    </div>
                );

            case 'trend-line':
                return (
                    <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none">
                        {/* Baseline */}
                        <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 2" />
                        <path
                            d={`M0,${50 - (data[0] * 50)} ${data.map((y: number, i: number) => `L${(i / (data.length - 1)) * 100},${50 - (y * 50)}`).join(' ')}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                        />
                    </svg>
                );

            default:
                return null;
        }
    };

    return (
        <div className={styles.cognitiveCard}>
            <div className={styles.cognitiveHeader}>
                <h3 className={styles.cognitiveTitle}>{title}</h3>
                <div className={styles.infoIcon} title={insight}>
                    <Info size={14} />
                </div>
            </div>

            <div className={styles.cognitiveContent}>
                <div className={styles.cognitiveData}>
                    <div className={styles.cognitiveValue}>{value}</div>
                    {subValue && <div className={styles.cognitiveSubValue}>{subValue}</div>}
                    {trend && (
                        <div className={styles.cognitiveTrend} style={{
                            color: trend.includes('↓') ? '#ef4444' : trend.includes('↑') ? '#f59e0b' : 'rgba(255,255,255,0.6)'
                        }}>
                            {trend}
                        </div>
                    )}
                </div>
                <div className={styles.cognitiveChart}>
                    {renderChart()}
                </div>
            </div>
        </div>
    );
};

export default CognitiveMetricCard;
