import React from 'react';
import styles from './Caregiver.module.css';

const ActivityLog = () => {
    const activities = [
        { id: 1, time: '10:30 AM', title: 'Morning Greeting', desc: 'Patient responded positively to "Good Morning" prompt.' },
        { id: 2, time: '11:15 AM', title: 'Memory Lane', desc: 'Discussed childhood pet "Buster". Engagement level: High.' },
        { id: 3, time: '01:00 PM', title: 'Calming Session', desc: 'Played "Ocean Sounds" for 15 minutes to reduce agitation.' },
        { id: 4, time: '02:45 PM', title: 'Family Photo', desc: 'Viewed photo of grandchildren. Emotional response: Joy.' },
    ];

    return (
        <div className={styles.activityList}>
            {activities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                    <div className={styles.time}>{activity.time}</div>
                    <div className={styles.activityContent}>
                        <div className={styles.activityTitle}>{activity.title}</div>
                        <div className={styles.activityDesc}>{activity.desc}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ActivityLog;
