import React from 'react';
import styles from './PageLayout.module.css';

interface PageLayoutProps {
    children: React.ReactNode;
    className?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, className }) => {
    return (
        <div className={`${styles.container} ${className || ''}`}>
            {children}
        </div>
    );
};

export default PageLayout;
