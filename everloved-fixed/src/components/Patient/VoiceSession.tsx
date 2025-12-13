'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Patient.module.css';
import { Mic, AlertCircle } from 'lucide-react';

interface VoiceSessionProps {
    onEndSession: () => void;
    onSpeakingStateChange?: (isSpeaking: boolean) => void;
    activeProfile: any;
}

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: () => void;
    onaudiostart: () => void;
    onsoundstart: () => void;
    onspeechstart: () => void;
    onspeechend: () => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

declare global {
    interface Window {
        webkitSpeechRecognition: {
            new(): SpeechRecognition;
        };
        SpeechRecognition: {
            new(): SpeechRecognition;
        };
    }
}

// ============================================
// EVERLOVED VOICE SESSION v2.0
// "PATIENT LISTENER" MODE FOR ALZHEIMER'S CARE
// ============================================
// 
// PROTOCOL 1: Echo Cancellation & "Deaf" Periods
// - 1000ms safety buffer when AI starts speaking
// - Ignore all speech detection during playback start
//
// PROTOCOL 2: Patient Listener VAD
// - 2000ms silence threshold (wait for slow speakers)
// - 300ms minimum speech duration (ignore coughs/clicks)
//
// PROTOCOL 3: Stability over Speed
// - Never interrupt patient mid-thought
// - Graceful degradation on errors
// ============================================

const VoiceSession: React.FC<VoiceSessionProps> = ({ onEndSession, onSpeakingStateChange, activeProfile }) => {
    // ===== CONFIGURATION =====
    const CONFIG = {
        // PROTOCOL 2: Patient Listener Settings
        SILENCE_THRESHOLD_MS: 2000,      // Wait 2 seconds of silence before processing
        MIN_SPEECH_DURATION_MS: 300,     // Ignore sounds shorter than 300ms
        
        // PROTOCOL 1: Echo Cancellation Settings
        DEAF_PERIOD_MS: 1000,            // Ignore speech detection for 1s after AI starts speaking
        RESTART_DELAY_MS: 150,           // Delay before restarting listener
        
        // Confidence threshold
        MIN_TRANSCRIPT_LENGTH: 2,        // Minimum characters to process
    };

    // ===== GLOBAL KILL SWITCH =====
    const isConversationActiveRef = useRef(false);
    
    // Session State
    const [isSessionActive, setIsSessionActive] = useState(false);

    // UI States
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    
    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const statusRef = useRef<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    // PROTOCOL 1: Deaf Period Tracking
    const isInDeafPeriodRef = useRef(false);
    const deafPeriodTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // PROTOCOL 2: Speech Timing
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const speechStartTimeRef = useRef<number | null>(null);
    const accumulatedTranscriptRef = useRef<string>('');

    // Keep statusRef in sync
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[EverLoved] ${timestamp}: ${msg}`);
        setDebugLogs(prev => [...prev.slice(-4), `${timestamp}: ${msg}`]);
    };

    // ===== PROTOCOL 1: START DEAF PERIOD =====
    const startDeafPeriod = useCallback(() => {
        isInDeafPeriodRef.current = true;
        addLog(`🔇 Deaf period started (${CONFIG.DEAF_PERIOD_MS}ms)`);
        
        if (deafPeriodTimerRef.current) {
            clearTimeout(deafPeriodTimerRef.current);
        }
        
        deafPeriodTimerRef.current = setTimeout(() => {
            isInDeafPeriodRef.current = false;
            addLog('👂 Deaf period ended - listening for user');
        }, CONFIG.DEAF_PERIOD_MS);
    }, [CONFIG.DEAF_PERIOD_MS]);

    // ===== INITIALIZE MEDIA WITH ECHO CANCELLATION =====
    const initializeMedia = useCallback(async () => {
        try {
            // PROTOCOL 1: Aggressive echo cancellation
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // Additional constraints for cleaner audio
                    channelCount: 1,
                    sampleRate: 16000,
                }
            });
            mediaStreamRef.current = stream;
            addLog('🎙️ Microphone initialized with echo cancellation');
            return true;
        } catch (err) {
            console.error('Media initialization error:', err);
            setError('Microphone access denied. Please allow microphone access.');
            return false;
        }
    }, []);

    // ===== START LISTENING =====
    const startListening = useCallback(() => {
        // Check kill switch
        if (!isConversationActiveRef.current) {
            addLog('Kill switch active - not starting');
            return;
        }
        
        if (!recognitionRef.current) {
            addLog('No recognition available');
            return;
        }

        // Don't start if processing or speaking
        if (statusRef.current === 'processing' || statusRef.current === 'speaking') {
            addLog(`Skipping start - status is ${statusRef.current}`);
            return;
        }

        try {
            recognitionRef.current.start();
            setStatus('listening');
            addLog('🎤 Listening (Patient Mode)...');
        } catch (e: any) {
            if (e.message?.includes('already started')) {
                setStatus('listening');
            } else {
                console.error('Start listening error:', e);
                setTimeout(() => {
                    if (isConversationActiveRef.current && statusRef.current === 'idle') {
                        startListening();
                    }
                }, 500);
            }
        }
    }, []);

    // ===== STOP LISTENING =====
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore
            }
        }
        
        // Clear timers
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    // ===== PROCESS USER SPEECH =====
    const processUserSpeech = useCallback(async (text: string) => {
        if (!text.trim() || text.length < CONFIG.MIN_TRANSCRIPT_LENGTH) {
            addLog('Ignoring too-short transcript');
            return;
        }
        
        if (!isConversationActiveRef.current) return;

        // Transition: LISTENING -> PROCESSING
        stopListening();
        setStatus('processing');
        setIsThinking(true);
        setInterimTranscript('');
        accumulatedTranscriptRef.current = '';
        addLog(`🤔 Processing: "${text.substring(0, 50)}..."`);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text, 
                    profile: activeProfile 
                }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.text || "I'm here with you.";
            
            setAiResponse(aiText);
            setIsThinking(false);
            addLog(`AI: "${aiText.substring(0, 40)}..."`);

            // Transition: PROCESSING -> SPEAKING
            await speakResponse(aiText);

        } catch (err: any) {
            console.error('Chat Error:', err);
            setIsThinking(false);
            addLog(`Error: ${err.message}`);
            
            const fallbackText = "I'm here with you. Take your time.";
            setAiResponse(fallbackText);
            await speakResponse(fallbackText);
        }
    }, [activeProfile, stopListening]);

    // ===== INITIALIZE SPEECH RECOGNITION =====
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognitionAPI) {
            setError('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            addLog('Recognition started');
            setError(null);
            accumulatedTranscriptRef.current = '';
            speechStartTimeRef.current = null;
        };

        recognition.onspeechstart = () => {
            // PROTOCOL 1: Ignore during deaf period
            if (isInDeafPeriodRef.current) {
                addLog('Speech detected but in deaf period - ignoring');
                return;
            }
            
            // PROTOCOL 2: Track speech start time
            speechStartTimeRef.current = Date.now();
            setIsUserSpeaking(true);
            addLog('🗣️ User speaking...');
            
            // Clear silence timer - user is speaking
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        };

        recognition.onspeechend = () => {
            setIsUserSpeaking(false);
            
            // PROTOCOL 2: Check minimum speech duration
            if (speechStartTimeRef.current) {
                const speechDuration = Date.now() - speechStartTimeRef.current;
                if (speechDuration < CONFIG.MIN_SPEECH_DURATION_MS) {
                    addLog(`Speech too short (${speechDuration}ms) - ignoring`);
                    speechStartTimeRef.current = null;
                    return;
                }
            }
            
            addLog('User stopped speaking');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            // Check kill switch
            if (!isConversationActiveRef.current) return;
            
            // PROTOCOL 1: Ignore during deaf period
            if (isInDeafPeriodRef.current) {
                return;
            }
            
            let interim = '';
            let finalText = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            // Update UI
            setInterimTranscript(interim);
            
            if (finalText) {
                accumulatedTranscriptRef.current += ' ' + finalText;
                const accumulated = accumulatedTranscriptRef.current.trim();
                setTranscript(accumulated);
                
                // PROTOCOL 2: Reset silence timer with 2-second patience
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }
                
                addLog(`Waiting ${CONFIG.SILENCE_THRESHOLD_MS}ms for more speech...`);
                
                silenceTimerRef.current = setTimeout(() => {
                    if (isConversationActiveRef.current && 
                        statusRef.current === 'listening' && 
                        accumulated.length >= CONFIG.MIN_TRANSCRIPT_LENGTH) {
                        addLog(`✓ 2s silence - processing speech`);
                        processUserSpeech(accumulated);
                    }
                }, CONFIG.SILENCE_THRESHOLD_MS);
            }
        };

        recognition.onerror = (event: any) => {
            addLog(`Recognition error: ${event.error}`);
            
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access.');
                isConversationActiveRef.current = false;
                setIsSessionActive(false);
                setStatus('idle');
            } else if (event.error === 'no-speech') {
                // No speech - restart if active and listening
                if (isConversationActiveRef.current && statusRef.current === 'listening') {
                    setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
                }
            } else if (event.error === 'aborted') {
                // Intentionally stopped
                if (isConversationActiveRef.current && 
                    statusRef.current !== 'processing' && 
                    statusRef.current !== 'speaking') {
                    setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
                }
            }
        };

        recognition.onend = () => {
            addLog('Recognition ended');
            
            // Auto-restart for continuous listening
            if (isConversationActiveRef.current && 
                statusRef.current !== 'processing' && 
                statusRef.current !== 'speaking') {
                setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            isConversationActiveRef.current = false;
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (deafPeriodTimerRef.current) clearTimeout(deafPeriodTimerRef.current);
            recognition.abort();
        };
    }, [startListening, processUserSpeech, CONFIG]);

    // ===== SPEAK AI RESPONSE =====
    const speakResponse = async (text: string) => {
        if (!isConversationActiveRef.current) return;

        // Transition to speaking
        setStatus('speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);
        
        // PROTOCOL 1: Start deaf period to prevent self-interruption
        startDeafPeriod();
        
        addLog('🔊 Speaking...');

        const gender = activeProfile?.gender || 'female';

        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, gender }),
            });

            if (!response.ok) {
                throw new Error('TTS Failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            // When audio finishes -> restart listening
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                addLog('Audio finished');
                
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                
                if (isConversationActiveRef.current) {
                    setStatus('listening');
                    setTranscript('');
                    setInterimTranscript('');
                    setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
                }
            };

            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                playFallbackTTS(text);
            };

            await audio.play();

        } catch (err) {
            console.error('TTS Error:', err);
            playFallbackTTS(text);
        }
    };

    // ===== FALLBACK BROWSER TTS =====
    const playFallbackTTS = (text: string) => {
        if (!isConversationActiveRef.current) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') ||
            v.name.includes('Microsoft')
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 0.85; // Slightly slower for clarity
        utterance.pitch = 1;

        utterance.onstart = () => {
            setStatus('speaking');
            if (onSpeakingStateChange) onSpeakingStateChange(true);
            startDeafPeriod(); // PROTOCOL 1
        };

        utterance.onend = () => {
            addLog('Fallback TTS finished');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            
            if (isConversationActiveRef.current) {
                setStatus('listening');
                setTranscript('');
                setInterimTranscript('');
                setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
            }
        };

        utterance.onerror = () => {
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            if (isConversationActiveRef.current) {
                setStatus('listening');
                setTimeout(startListening, CONFIG.RESTART_DELAY_MS);
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    // ===== BARGE-IN (Only after deaf period) =====
    useEffect(() => {
        // PROTOCOL 1: Only allow barge-in AFTER deaf period
        if (isUserSpeaking && status === 'speaking' && !isInDeafPeriodRef.current) {
            addLog('⚡ Barge-in detected - stopping AI');
            
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            
            window.speechSynthesis.cancel();
            
            setStatus('listening');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
        }
    }, [isUserSpeaking, status, onSpeakingStateChange]);

    // ===== START SESSION =====
    const handleStartSession = useCallback(async () => {
        // Initialize media first
        const mediaOk = await initializeMedia();
        if (!mediaOk) return;

        isConversationActiveRef.current = true;
        setIsSessionActive(true);
        setStatus('listening');
        setError(null);
        setTranscript('');
        setInterimTranscript('');
        setAiResponse('');
        accumulatedTranscriptRef.current = '';

        addLog('🚀 Session started - Patient Listener Mode');
        addLog(`⏱️ Silence threshold: ${CONFIG.SILENCE_THRESHOLD_MS}ms`);
        
        startListening();
    }, [initializeMedia, startListening, CONFIG.SILENCE_THRESHOLD_MS]);

    // ===== END SESSION =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Session ended');
        
        isConversationActiveRef.current = false;
        setIsSessionActive(false);
        setStatus('idle');

        // Clear all timers
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (deafPeriodTimerRef.current) {
            clearTimeout(deafPeriodTimerRef.current);
            deafPeriodTimerRef.current = null;
        }

        // Stop recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {}
        }

        // Stop audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        // Stop TTS
        window.speechSynthesis.cancel();

        // Release media stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        onEndSession();
    }, [onEndSession]);

    return (
        <div className={styles.voiceSessionContainer}>
            {/* Error Alert */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        zIndex: 50,
                        maxWidth: '90%',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}
                    >
                        ✕
                    </button>
                </motion.div>
            )}

            {/* IDLE STATE: Start Button */}
            {!isSessionActive && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', zIndex: 20 }}>
                    <button
                        onClick={handleStartSession}
                        className={styles.startButton}
                    >
                        <Mic size={32} />
                    </button>
                </div>
            )}

            {/* ACTIVE SESSION UI */}
            {isSessionActive && (
                <>
                    {/* Ripple Animations */}
                    <div className={styles.rippleContainer}>
                        {status === 'speaking' && (
                            <motion.div
                                className={styles.rippleSpeaking}
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                        )}
                        {isThinking && (
                            <motion.div
                                className={styles.rippleProcessing}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                        )}
                        {isUserSpeaking && !isThinking && (
                            <motion.div
                                className={styles.rippleListening}
                                style={{ borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                            />
                        )}
                        {!isUserSpeaking && !isThinking && status === 'listening' && (
                            <motion.div
                                className={styles.rippleListening}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />
                        )}
                    </div>

                    {/* Status Text */}
                    <p className={styles.statusText}>
                        <span className={styles.statusLabel}>
                            {isUserSpeaking ? "I'm listening... take your time" :
                                isThinking ? "Thinking..." :
                                    status === 'speaking' ? "Speaking..." :
                                        "Listening... take your time"}
                        </span>
                    </p>

                    {/* Transcript Feedback */}
                    {!error && (
                        <div className={styles.transcriptContainer}>
                            {(transcript || interimTranscript) && (
                                <p className={styles.transcriptText}>
                                    You: "{transcript}{interimTranscript && <span style={{ opacity: 0.5 }}>{interimTranscript}</span>}"
                                </p>
                            )}
                            {aiResponse && (
                                <p className={styles.transcriptText} style={{ color: '#60a5fa', marginTop: '0.5rem' }}>
                                    AI: "{aiResponse}"
                                </p>
                            )}
                        </div>
                    )}

                    {/* DEBUG LOGS */}
                    <div style={{ marginTop: '1rem', width: '100%', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        {debugLogs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>

                    {/* Controls */}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className={styles.endButton}
                            onClick={handleEndSession}
                            style={{
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                color: '#fca5a5',
                                background: 'rgba(239, 68, 68, 0.1)'
                            }}
                        >
                            End Conversation
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VoiceSession;
