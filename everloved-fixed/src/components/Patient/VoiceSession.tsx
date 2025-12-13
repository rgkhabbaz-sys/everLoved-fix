'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import styles from './Patient.module.css';
import { Mic, AlertCircle, PhoneOff } from 'lucide-react';

// ============================================
// EVERLOVED VOICE SESSION v6.0
// FOREVER LOOP + SMART VAD PAUSING
// ============================================
// 
// Features:
// - Conversation stays live until user clicks "End"
// - VAD pauses during AI speech (no self-hearing)
// - VAD resumes immediately after AI finishes
// - Barge-in still works
// ============================================

interface VoiceSessionProps {
    onEndSession: () => void;
    onSpeakingStateChange?: (isSpeaking: boolean) => void;
    activeProfile: any;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: () => void;
    onspeechstart: () => void;
    onspeechend: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

const VoiceSession: React.FC<VoiceSessionProps> = ({ 
    onEndSession, 
    onSpeakingStateChange, 
    activeProfile 
}) => {
    // ===== SESSION STATE =====
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState<'idle' | 'listening' | 'user-speaking' | 'processing' | 'ai-speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // ===== REFS =====
    const isSessionActiveRef = useRef(false);
    const statusRef = useRef(status);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const transcriptRef = useRef('');

    // Keep refs in sync
    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        console.log(`[VAD] ${ts}: ${msg}`);
        setDebugLogs(prev => [...prev.slice(-4), `${ts}: ${msg}`]);
    };

    // ===== STOP AI AUDIO (BARGE-IN) =====
    const stopAIAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
            addLog('⚡ Barge-in: AI stopped');
        }
        if (onSpeakingStateChange) onSpeakingStateChange(false);
    }, [onSpeakingStateChange]);

    // ===== VAD HOOK (configured for forever loop) =====
    const vad = useMicVAD({
        startOnLoad: false, // Manual control only
        redemptionFrames: 15,
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.4,
        minSpeechFrames: 5,
        onSpeechStart: () => {
            if (!isSessionActiveRef.current) return;
            
            addLog('🎤 User speaking...');
            
            // BARGE-IN: Stop AI if speaking
            if (statusRef.current === 'ai-speaking') {
                stopAIAudio();
            }
            
            setStatus('user-speaking');
            transcriptRef.current = '';
            setTranscript('');
            
            // Start speech recognition
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    // May already be running
                }
            }
        },
        onSpeechEnd: () => {
            if (!isSessionActiveRef.current) return;
            
            addLog('🔇 User stopped');
            
            // Stop speech recognition
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
            
            // Process the accumulated transcript
            const finalText = transcriptRef.current.trim();
            if (finalText.length > 2) {
                processUserSpeech(finalText);
            } else {
                setStatus('listening');
            }
        },
        onVADMisfire: () => {
            // Noise detected, not speech - just ignore
        },
    });

    // ===== PLAY AI RESPONSE (with VAD pause/resume) =====
    const playAIResponse = useCallback(async (text: string) => {
        if (!isSessionActiveRef.current) return;

        // PAUSE VAD while AI speaks (prevent self-hearing)
        vad.pause();
        addLog('🔇 VAD paused');

        setStatus('ai-speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);
        addLog('🔊 AI speaking...');

        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, gender: activeProfile?.gender || 'female' }),
            });

            if (!response.ok) throw new Error('TTS failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                addLog('✓ AI done');
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                
                if (isSessionActiveRef.current) {
                    setStatus('listening');
                    setTranscript('');
                    transcriptRef.current = '';
                    
                    // RESUME VAD after AI finishes
                    vad.start();
                    addLog('👂 VAD resumed');
                }
            };

            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                
                if (isSessionActiveRef.current) {
                    setStatus('listening');
                    vad.start(); // Resume VAD even on error
                    addLog('👂 VAD resumed (after error)');
                }
            };

            await audio.play();

        } catch (err) {
            console.error('TTS error:', err);
            addLog('TTS error');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            
            if (isSessionActiveRef.current) {
                setStatus('listening');
                vad.start(); // Resume VAD even on error
            }
        }
    }, [activeProfile, onSpeakingStateChange, vad]);

    // ===== PROCESS SPEECH =====
    const processUserSpeech = useCallback(async (text: string) => {
        if (!text.trim() || text.length < 2 || !isSessionActiveRef.current) return;

        // Pause VAD during processing
        vad.pause();
        
        setStatus('processing');
        addLog(`🤔 Processing: "${text.substring(0, 30)}..."`);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, profile: activeProfile }),
            });

            if (!response.ok) throw new Error(`API: ${response.status}`);

            const { text: aiText } = await response.json();
            const responseText = aiText || "I'm here with you.";
            
            setAiResponse(responseText);
            addLog(`AI: "${responseText.substring(0, 25)}..."`);

            await playAIResponse(responseText);

        } catch (err: any) {
            console.error('Error:', err);
            addLog(`Error: ${err.message}`);
            
            if (isSessionActiveRef.current) {
                setStatus('listening');
                vad.start(); // Resume VAD on error
            }
        }
    }, [activeProfile, playAIResponse, vad]);

    // ===== SPEECH RECOGNITION SETUP =====
    useEffect(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setError('Speech recognition not supported.');
            return;
        }

        const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            if (!isSessionActiveRef.current) return;

            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            if (finalTranscript) {
                transcriptRef.current += ' ' + finalTranscript;
            }
            
            setTranscript(transcriptRef.current.trim() + (interimTranscript ? ' ' + interimTranscript : ''));
        };

        recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('Recognition error:', event.error);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, []);

    // ===== START SESSION =====
    const handleStartSession = useCallback(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
        } catch (e) {
            setError('Microphone access denied.');
            return;
        }

        setIsSessionActive(true);
        setStatus('listening');
        setError(null);
        setTranscript('');
        setAiResponse('');
        transcriptRef.current = '';

        // Start VAD - it will run forever until we stop it
        vad.start();
        
        addLog('🚀 Conversation started (hands-free)');
    }, [vad]);

    // ===== END SESSION =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Conversation ended');
        
        setIsSessionActive(false);
        setStatus('idle');

        // Stop VAD completely
        vad.pause();
        
        // Stop speech recognition
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) {}
        }
        
        // Stop any playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (onSpeakingStateChange) onSpeakingStateChange(false);
        onEndSession();
    }, [vad, onEndSession, onSpeakingStateChange]);

    // ===== STATUS INDICATOR =====
    const getStatusColor = () => {
        switch (status) {
            case 'listening': return '#22c55e'; // Green
            case 'user-speaking': return '#ef4444'; // Red
            case 'processing': return '#3b82f6'; // Blue
            case 'ai-speaking': return '#8b5cf6'; // Purple
            default: return '#6b7280'; // Gray
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'listening': return 'Listening...';
            case 'user-speaking': return 'I hear you...';
            case 'processing': return 'Thinking...';
            case 'ai-speaking': return 'Speaking...';
            default: return 'Ready';
        }
    };

    // ===== RENDER =====
    return (
        <div className={styles.voiceSessionContainer}>
            {/* Error Alert */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white',
                        padding: '0.75rem 1.5rem', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        zIndex: 50, maxWidth: '90%',
                    }}
                >
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                </motion.div>
            )}

            {/* IDLE STATE: Start Button */}
            {!isSessionActive && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', zIndex: 20 }}>
                    <button onClick={handleStartSession} className={styles.startButton}>
                        <Mic size={32} />
                    </button>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                        Tap to start<br/>hands-free conversation
                    </p>
                </div>
            )}

            {/* ACTIVE SESSION */}
            {isSessionActive && (
                <>
                    {/* Animated Status Indicator */}
                    <div className={styles.rippleContainer}>
                        <motion.div
                            style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                backgroundColor: getStatusColor(),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            animate={status === 'user-speaking' ? {
                                scale: [1, 1.2, 1],
                                opacity: [1, 0.8, 1],
                            } : status === 'processing' ? {
                                rotate: 360,
                            } : status === 'ai-speaking' ? {
                                scale: [1, 1.1, 1],
                            } : {
                                scale: [1, 1.05, 1],
                                opacity: [0.8, 1, 0.8],
                            }}
                            transition={{
                                duration: status === 'processing' ? 1 : 1.5,
                                repeat: Infinity,
                                ease: status === 'processing' ? 'linear' : 'easeInOut',
                            }}
                        >
                            <Mic size={32} color="white" />
                        </motion.div>
                    </div>

                    {/* Status Text */}
                    <p className={styles.statusText}>
                        <span className={styles.statusLabel} style={{ color: getStatusColor() }}>
                            {getStatusText()}
                        </span>
                    </p>

                    {/* Transcript Display */}
                    <div className={styles.transcriptContainer}>
                        {transcript && (
                            <p className={styles.transcriptText}>
                                You: "{transcript}"
                            </p>
                        )}
                        {aiResponse && (
                            <p className={styles.transcriptText} style={{ color: '#60a5fa', marginTop: '0.5rem' }}>
                                AI: "{aiResponse}"
                            </p>
                        )}
                    </div>

                    {/* Debug Logs */}
                    <div style={{ marginTop: '1rem', width: '100%', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>

                    {/* END CONVERSATION BUTTON */}
                    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                        <button 
                            onClick={handleEndSession}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '12px',
                                color: '#fca5a5',
                                fontSize: '1rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                            }}
                        >
                            <PhoneOff size={20} />
                            End Conversation
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VoiceSession;
