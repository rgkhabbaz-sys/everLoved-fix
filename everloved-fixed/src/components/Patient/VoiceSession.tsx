'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Patient.module.css';
import { Mic, AlertCircle } from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
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

// ============================================
// EVERLOVED VOICE SESSION v4.0
// STABILITY FIRST - NO SELF-INTERRUPTION
// ============================================
// 
// Key principle: Recognition is COMPLETELY OFF while AI speaks.
// No barge-in. No echo detection issues. Rock solid.
//
// Flow:
// 1. LISTENING: Recognition ON, waiting for user
// 2. PROCESSING: Recognition OFF, calling API
// 3. SPEAKING: Recognition OFF, playing audio
// 4. Audio ends -> Back to LISTENING (Recognition ON)
// ============================================

const VoiceSession: React.FC<VoiceSessionProps> = ({ 
    onEndSession, 
    onSpeakingStateChange, 
    activeProfile 
}) => {
    const CONFIG = {
        SILENCE_THRESHOLD_MS: 800,  // Reduced to 800ms for faster response
        MIN_TRANSCRIPT_LENGTH: 2,
    };

    // ===== STATE =====
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);

    // ===== REFS =====
    const isActiveRef = useRef(false);
    const statusRef = useRef(status);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const accumulatedTextRef = useRef('');

    useEffect(() => { statusRef.current = status; }, [status]);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        console.log(`[Voice] ${ts}: ${msg}`);
        setDebugLogs(prev => [...prev.slice(-4), `${ts}: ${msg}`]);
    };

    // ===== START LISTENING =====
    const startListening = useCallback(() => {
        if (!isActiveRef.current || !recognitionRef.current) return;
        if (statusRef.current !== 'listening') return;

        try {
            recognitionRef.current.start();
            addLog('🎤 Listening...');
        } catch (e: any) {
            if (!e.message?.includes('already started')) {
                setTimeout(() => startListening(), 200);
            }
        }
    }, []);

    // ===== STOP LISTENING =====
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) {}
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    // ===== PLAY AI AUDIO - BROWSER TTS FOR SPEED =====
    const playAudio = useCallback(async (text: string) => {
        if (!isActiveRef.current) return;

        // CRITICAL: Stop recognition completely before speaking
        stopListening();
        
        setStatus('speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);
        addLog('🔊 Speaking...');

        // Use browser TTS for instant response (no network latency)
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to get a good voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.name.includes('Google') || 
            v.name.includes('Samantha') || 
            v.name.includes('Microsoft')
        );
        if (preferredVoice) utterance.voice = preferredVoice;
        
        utterance.rate = 0.95;
        utterance.pitch = 1;

        utterance.onend = () => {
            addLog('✓ Speech complete');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            
            if (isActiveRef.current) {
                setStatus('listening');
                setTranscript('');
                setInterimTranscript('');
                accumulatedTextRef.current = '';
                setTimeout(() => {
                    if (isActiveRef.current) {
                        startListening();
                    }
                }, 200);
            }
        };

        utterance.onerror = () => {
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            if (isActiveRef.current) {
                setStatus('listening');
                setTimeout(() => startListening(), 200);
            }
        };

        window.speechSynthesis.speak(utterance);
    }, [onSpeakingStateChange, stopListening, startListening]);

    // ===== PROCESS USER SPEECH =====
    const processUserSpeech = useCallback(async (text: string) => {
        if (!text.trim() || text.length < CONFIG.MIN_TRANSCRIPT_LENGTH || !isActiveRef.current) {
            return;
        }

        // Stop listening during processing
        stopListening();

        setStatus('processing');
        setIsThinking(true);
        accumulatedTextRef.current = '';
        addLog(`🤔 Processing: "${text.substring(0, 40)}..."`);

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
            setIsThinking(false);
            addLog(`AI: "${responseText.substring(0, 30)}..."`);

            // Play the response
            await playAudio(responseText);

        } catch (err: any) {
            console.error('Process error:', err);
            setIsThinking(false);
            addLog(`Error: ${err.message}`);
            
            const fallback = "I'm here with you.";
            setAiResponse(fallback);
            await playAudio(fallback);
        }
    }, [activeProfile, CONFIG.MIN_TRANSCRIPT_LENGTH, stopListening, playAudio]);

    // ===== INITIALIZE SPEECH RECOGNITION =====
    useEffect(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setError('Speech recognition not supported. Use Chrome, Edge, or Safari.');
            return;
        }

        const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setError(null);
        };

        recognition.onspeechstart = () => {
            setIsUserSpeaking(true);
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        };

        recognition.onspeechend = () => {
            setIsUserSpeaking(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            if (!isActiveRef.current || statusRef.current !== 'listening') return;

            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            setInterimTranscript(interim);

            if (final) {
                accumulatedTextRef.current += ' ' + final;
                const accumulated = accumulatedTextRef.current.trim();
                setTranscript(accumulated);

                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                silenceTimerRef.current = setTimeout(() => {
                    if (isActiveRef.current && statusRef.current === 'listening') {
                        processUserSpeech(accumulated);
                    }
                }, CONFIG.SILENCE_THRESHOLD_MS);
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed') {
                setError('Microphone access denied.');
                isActiveRef.current = false;
                setIsSessionActive(false);
                setStatus('idle');
            } else if ((event.error === 'no-speech' || event.error === 'aborted') && 
                       isActiveRef.current && statusRef.current === 'listening') {
                setTimeout(() => startListening(), 200);
            }
        };

        recognition.onend = () => {
            // Only auto-restart if we're supposed to be listening
            if (isActiveRef.current && statusRef.current === 'listening') {
                setTimeout(() => startListening(), 200);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            isActiveRef.current = false;
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            recognition.abort();
        };
    }, [processUserSpeech, startListening, CONFIG.SILENCE_THRESHOLD_MS]);

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

        isActiveRef.current = true;
        setIsSessionActive(true);
        setStatus('listening');
        setError(null);
        setTranscript('');
        setInterimTranscript('');
        setAiResponse('');
        accumulatedTextRef.current = '';

        addLog('🚀 Session started');
        startListening();
    }, [startListening]);

    // ===== END SESSION =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Session ended');
        
        isActiveRef.current = false;
        setIsSessionActive(false);
        setStatus('idle');

        stopListening();
        window.speechSynthesis.cancel();
        onEndSession();
    }, [onEndSession, stopListening]);

    // ===== RENDER =====
    return (
        <div className={styles.voiceSessionContainer}>
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

            {!isSessionActive && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', zIndex: 20 }}>
                    <button onClick={handleStartSession} className={styles.startButton}>
                        <Mic size={32} />
                    </button>
                </div>
            )}

            {isSessionActive && (
                <>
                    <div className={styles.rippleContainer}>
                        {status === 'speaking' && (
                            <motion.div className={styles.rippleSpeaking}
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }} />
                        )}
                        {isThinking && (
                            <motion.div className={styles.rippleProcessing}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                        )}
                        {isUserSpeaking && !isThinking && (
                            <motion.div className={styles.rippleListening}
                                style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                                transition={{ duration: 0.8, repeat: Infinity }} />
                        )}
                        {!isUserSpeaking && !isThinking && status === 'listening' && (
                            <motion.div className={styles.rippleListening}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity }} />
                        )}
                    </div>

                    <p className={styles.statusText}>
                        <span className={styles.statusLabel}>
                            {isUserSpeaking ? "Listening..." :
                                isThinking ? "Thinking..." :
                                    status === 'speaking' ? "Speaking..." : "Listening..."}
                        </span>
                    </p>

                    {!error && (
                        <div className={styles.transcriptContainer}>
                            {(transcript || interimTranscript) && (
                                <p className={styles.transcriptText}>
                                    You: "{transcript}<span style={{ opacity: 0.5 }}>{interimTranscript}</span>"
                                </p>
                            )}
                            {aiResponse && (
                                <p className={styles.transcriptText} style={{ color: '#60a5fa', marginTop: '0.5rem' }}>
                                    AI: "{aiResponse}"
                                </p>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: '1rem', width: '100%', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
                        <button className={styles.endButton} onClick={handleEndSession}
                            style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)' }}>
                            End Conversation
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VoiceSession;

