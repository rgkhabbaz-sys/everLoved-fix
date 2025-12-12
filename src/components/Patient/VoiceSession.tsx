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
// CONTINUOUS VOICE SESSION - "PHONE CALL" MODE
// ============================================
// State Machine:
// IDLE -> (start) -> LISTENING
// LISTENING -> (user speaks) -> PROCESSING  
// PROCESSING -> (AI responds) -> SPEAKING
// SPEAKING -> (audio ends) -> LISTENING (auto-restart!)
// ANY STATE -> (end button) -> IDLE (kill switch)
// ============================================

const VoiceSession: React.FC<VoiceSessionProps> = ({ onEndSession, onSpeakingStateChange, activeProfile }) => {
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
    
    // Debounce timer for handling pauses in speech
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSpeechTimeRef = useRef<number>(Date.now());
    
    // Configuration
    const SILENCE_THRESHOLD_MS = 1500; // Wait 1.5 seconds of silence before processing
    const RESTART_DELAY_MS = 100; // Quick restart after speaking ends

    // Keep statusRef in sync
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    const addLog = (msg: string) => {
        setDebugLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    // ===== IMMEDIATE LISTENING RESTART =====
    const startListening = useCallback(() => {
        // Check kill switch first
        if (!isConversationActiveRef.current) {
            addLog('Kill switch active - not restarting');
            return;
        }
        
        if (!recognitionRef.current) {
            addLog('No recognition available');
            return;
        }

        // Don't start if already processing or speaking
        if (statusRef.current === 'processing' || statusRef.current === 'speaking') {
            addLog(`Skipping start - status is ${statusRef.current}`);
            return;
        }

        try {
            recognitionRef.current.start();
            setStatus('listening');
            addLog('🎤 Listening...');
        } catch (e: any) {
            // Already started - that's fine
            if (e.message?.includes('already started')) {
                setStatus('listening');
            } else {
                console.error('Start listening error:', e);
                // Try again shortly
                setTimeout(() => {
                    if (isConversationActiveRef.current) {
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
        // Clear any pending silence timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    // ===== INITIALIZE SPEECH RECOGNITION =====
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognitionAPI) {
            setError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let accumulatedTranscript = '';

        recognition.onstart = () => {
            addLog('Recognition started');
            setError(null);
            accumulatedTranscript = '';
        };

        recognition.onspeechstart = () => {
            setIsUserSpeaking(true);
            lastSpeechTimeRef.current = Date.now();
            
            // Clear any pending silence timer - user is speaking again
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        };

        recognition.onspeechend = () => {
            setIsUserSpeaking(false);
            lastSpeechTimeRef.current = Date.now();
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            // Check kill switch
            if (!isConversationActiveRef.current) return;
            
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

            // Update UI with what user is saying
            setInterimTranscript(interim);
            
            if (final) {
                accumulatedTranscript += ' ' + final;
                setTranscript(accumulatedTranscript.trim());
                lastSpeechTimeRef.current = Date.now();
                
                // Reset silence timer - wait for more speech or silence
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }
                
                // Start silence timer - if no more speech for SILENCE_THRESHOLD_MS, process
                silenceTimerRef.current = setTimeout(() => {
                    if (isConversationActiveRef.current && 
                        statusRef.current === 'listening' && 
                        accumulatedTranscript.trim()) {
                        addLog(`Processing after ${SILENCE_THRESHOLD_MS}ms silence`);
                        handleUserSpeech(accumulatedTranscript.trim());
                        accumulatedTranscript = '';
                    }
                }, SILENCE_THRESHOLD_MS);
            }
        };

        recognition.onerror = (event: any) => {
            addLog(`Error: ${event.error}`);
            
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access and try again.');
                isConversationActiveRef.current = false;
                setIsSessionActive(false);
                setStatus('idle');
            } else if (event.error === 'no-speech') {
                // No speech detected - just restart if active
                if (isConversationActiveRef.current && statusRef.current === 'listening') {
                    setTimeout(startListening, RESTART_DELAY_MS);
                }
            } else if (event.error === 'aborted') {
                // Intentionally stopped - check if we should restart
                if (isConversationActiveRef.current && 
                    statusRef.current !== 'processing' && 
                    statusRef.current !== 'speaking') {
                    setTimeout(startListening, RESTART_DELAY_MS);
                }
            }
        };

        recognition.onend = () => {
            addLog('Recognition ended');
            
            // THE FOREVER LOOP: Auto-restart if conversation is active
            // Only restart if not processing/speaking (those states restart after completion)
            if (isConversationActiveRef.current && 
                statusRef.current !== 'processing' && 
                statusRef.current !== 'speaking') {
                addLog('Auto-restarting listener...');
                setTimeout(startListening, RESTART_DELAY_MS);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            isConversationActiveRef.current = false;
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            recognition.abort();
        };
    }, [startListening]);

    // ===== HANDLE USER SPEECH - SEND TO AI =====
    const handleUserSpeech = async (text: string) => {
        if (!text.trim() || !isConversationActiveRef.current) return;

        // Transition: LISTENING -> PROCESSING
        stopListening();
        setStatus('processing');
        setIsThinking(true);
        setInterimTranscript('');
        addLog('🤔 Processing...');

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
            addLog(`AI: "${aiText.substring(0, 30)}..."`);

            // Transition: PROCESSING -> SPEAKING
            await speakResponse(aiText);

        } catch (err: any) {
            console.error('Chat Error:', err);
            setIsThinking(false);
            addLog(`Error: ${err.message}`);
            
            // Fallback response
            const fallbackText = "I'm having a little trouble right now, but I'm here with you.";
            setAiResponse(fallbackText);
            await speakResponse(fallbackText);
        }
    };

    // ===== SPEAK AI RESPONSE =====
    const speakResponse = async (text: string) => {
        if (!isConversationActiveRef.current) {
            // Conversation ended while processing - go back to listening anyway in case
            return;
        }

        // Transition: PROCESSING -> SPEAKING
        setStatus('speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);
        addLog('🔊 Speaking...');

        // Determine gender from profile
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

            // ===== CRITICAL: SPEAKING -> LISTENING TRANSITION =====
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                addLog('Audio finished');
                
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                
                // THE FOREVER LOOP: Immediately restart listening
                if (isConversationActiveRef.current) {
                    setStatus('listening');
                    setTranscript(''); // Clear old transcript for new input
                    setTimeout(startListening, RESTART_DELAY_MS);
                }
            };

            audio.onerror = () => {
                console.warn('Audio playback failed, using fallback TTS');
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
        
        // Try to find a good voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') ||
            v.name.includes('Microsoft')
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 0.9;
        utterance.pitch = 1;

        utterance.onstart = () => {
            setStatus('speaking');
            if (onSpeakingStateChange) onSpeakingStateChange(true);
        };

        // ===== CRITICAL: SPEAKING -> LISTENING TRANSITION =====
        utterance.onend = () => {
            addLog('Fallback TTS finished');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            
            // THE FOREVER LOOP: Immediately restart listening
            if (isConversationActiveRef.current) {
                setStatus('listening');
                setTranscript(''); // Clear old transcript for new input
                setTimeout(startListening, RESTART_DELAY_MS);
            }
        };

        utterance.onerror = () => {
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            // Still try to restart listening
            if (isConversationActiveRef.current) {
                setStatus('listening');
                setTimeout(startListening, RESTART_DELAY_MS);
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    // ===== BARGE-IN: INTERRUPT AI WHEN USER SPEAKS =====
    useEffect(() => {
        if (isUserSpeaking && status === 'speaking') {
            addLog('⚡ Barge-in! Stopping AI...');
            
            // Stop ElevenLabs audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            
            // Stop browser TTS
            window.speechSynthesis.cancel();
            
            // Transition immediately to listening
            setStatus('listening');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            
            // Recognition should already be running from the barge-in detection
        }
    }, [isUserSpeaking, status, onSpeakingStateChange]);

    // ===== START SESSION =====
    const handleStartSession = useCallback(async () => {
        // Activate the conversation
        isConversationActiveRef.current = true;
        setIsSessionActive(true);
        setStatus('listening');
        setError(null);
        setTranscript('');
        setInterimTranscript('');
        setAiResponse('');

        addLog('🚀 Session started - continuous mode');
        
        // Start the forever loop
        startListening();
    }, [startListening]);

    // ===== END SESSION (KILL SWITCH) =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Kill switch activated');
        
        // KILL SWITCH: Stop everything
        isConversationActiveRef.current = false;
        setIsSessionActive(false);
        setStatus('idle');

        // Clear silence timer
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // Stop recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                // Ignore
            }
        }

        // Stop audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        // Stop browser TTS
        window.speechSynthesis.cancel();

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
                            {isUserSpeaking ? "I'm listening..." :
                                isThinking ? "Thinking..." :
                                    status === 'speaking' ? "Speaking..." :
                                        "Listening..."}
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
