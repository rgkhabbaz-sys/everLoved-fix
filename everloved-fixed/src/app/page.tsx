'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import VoiceSession from '../components/Patient/VoiceSession';
import VideoPlayer from '../components/Patient/VideoPlayer';
import TherapyModes from '../components/Patient/TherapyModes';
import styles from './page.module.css';

import { motion } from 'framer-motion';

export default function Home() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<'clinical' | 'video' | 'music' | 'meditation'>('clinical');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  useEffect(() => {
    // Load avatar image
    const savedAvatar = localStorage.getItem('everloved_avatar');
    if (savedAvatar) {
      setAvatar(savedAvatar);
    }

    // Load active persona profile
    const savedProfile = localStorage.getItem('everloved_active_profile');
    if (savedProfile) {
      try {
        setActiveProfile(JSON.parse(savedProfile));
        console.log("Loaded active persona profile");
      } catch (e) {
        console.error("Failed to parse active profile", e);
      }
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundWrapper}>
        <motion.div
          initial={{ scale: 1.0, x: 0 }}
          animate={{
            scale: 1.15,
            x: -20,
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        >
          <Image
            src="/swiss-alps-bg.png"
            alt="Cheery Swiss Alps Landscape"
            fill
            priority
            className={styles.backgroundImage}
            quality={100}
          />
        </motion.div>
        <div className={styles.overlay} />
      </div>

      {/* ANIMATED LOGO for Landing Page */
        <motion.div
          className={styles.logo}
          initial={{
            top: "50%",
            left: "50%",
            x: "-50%",
            y: "-50%",
            scale: 1.5,
          }}
          animate={{
            top: "auto",
            bottom: "40px",
            left: "40px",
            x: "0%",
            y: "0%",
            scale: 1,
          }}
          transition={{
            duration: 2.5,
            ease: "easeInOut",
            delay: 0.5
          }}
          style={{ position: 'absolute', zIndex: 50 }}
        >
          everLoved
        </motion.div>}

      {/* Floating Avatar Box - hide when in video mode */}
      {avatar && mode !== 'video' && (
        <motion.div
          className={styles.avatarBox}
          initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
          animate={{
            opacity: 1,
            x: "-50%",
            y: "-50%",
            scale: [1, 1.05, 1]
          }}
          transition={{
            opacity: { duration: 2.0, ease: "easeOut" },
            scale: {
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
        >
          <img
            src={avatar}
            alt="Loved One"
            className={`${styles.avatarImage} ${isSpeaking ? styles.avatarSpeaking : ''}`}
          />
        </motion.div>
      )}

      <div className={styles.content}>
        <div className={styles.frame}>

          {/* Show VoiceSession for clinical mode */}
          {mode === 'clinical' && (
            <VoiceSession
              activeProfile={activeProfile}
              onSpeakingStateChange={setIsSpeaking}
              onEndSession={() => setIsSpeaking(false)}
            />
          )}

          {/* Show VideoPlayer for video mode */}
          {mode === 'video' && (
            <VideoPlayer onClose={() => setMode('clinical')} />
          )}

          {/* Placeholder for other modes */}
          {mode === 'music' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <p>Music therapy coming soon...</p>
            </div>
          )}

          {mode === 'meditation' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <p>Calm meditation coming soon...</p>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}
          >
            <TherapyModes currentMode={mode} onModeSelect={setMode} />
          </motion.div>

        </div>
      </div>
    </div>
  );
}
