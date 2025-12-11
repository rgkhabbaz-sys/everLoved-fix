'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Settings, BookOpen, Activity } from 'lucide-react';
import styles from './NavBar.module.css';

const NavBar = () => {
    const pathname = usePathname();

    const navItems = [
        { name: 'Patient Comfort', path: '/', icon: Heart },
        { name: 'Caregiver Control', path: '/caregiver', icon: Settings },
        { name: 'New Science', path: '/science', icon: BookOpen },
        { name: 'Health & Wellness', path: '/wellness', icon: Activity },
    ];

    // if (pathname === '/') return null;

    return (
        <nav className={styles.nav}>
            <div className={styles.container}>
                <div className={styles.logo}>EverLoved</div>
                <div className={styles.links}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`${styles.link} ${isActive ? styles.active : ''}`}
                            >
                                <motion.div
                                    whileTap={{ scale: 0.95 }}
                                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}
                                >
                                    <Icon size={18} />
                                    <span>{item.name}</span>
                                </motion.div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default NavBar;
