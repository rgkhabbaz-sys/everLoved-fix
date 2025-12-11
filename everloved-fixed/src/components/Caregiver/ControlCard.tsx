import React from 'react';
import { LucideIcon } from 'lucide-react';
import styles from './Caregiver.module.css';

interface ControlCardProps {
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
    className?: string;
}

const ControlCard: React.FC<ControlCardProps> = ({ title, icon: Icon, children, className = '' }) => {
    return (
        <div className={`glass-panel ${styles.card} ${className}`}>
            <div className={styles.cardHeader}>
                <Icon className={styles.cardIcon} size={24} />
                <h3 className={styles.cardTitle}>{title}</h3>
            </div>
            <div className={styles.cardContent}>
                {children}
            </div>
        </div>
    );
};

export default ControlCard;
