import React from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './Science.module.css';

interface ArticleCardProps {
    title: string;
    summary: string;
    date: string;
    category: string;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ title, summary, date, category }) => {
    return (
        <div className={`glass-panel ${styles.card}`}>
            <div className={styles.cardDate}>{category} • {date}</div>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardSummary}>{summary}</p>
            <div className={styles.readMore}>
                Read Article <ArrowRight size={16} className={styles.arrow} />
            </div>
        </div>
    );
};

export default ArticleCard;
