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

const VoiceSession: React.FC<VoiceSessionProps> = ({ onEndSession, onSpeakingStateChange, activeProfile }) => {
    // Session State
    const [isSessionActive, setIsSessionActive] = useState(false);

    // UI States
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isSessionActiveRef = useRef(false);

    const addLog = (msg: string) => {
        setDebugLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };

    // Initialize Speech Recognition
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

        recognition.onstart = () => {
            addLog('Listening started');
            setError(null);
        };

        recognition.onspeechstart = () => {
            setIsUserSpeaking(true);
            addLog('Speech detected');
        };

        recognition.onspeechend = () => {
            setIsUserSpeaking(false);
            addLog('Speech ended');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const lastResult = event.results[event.results.length - 1];
            const text = lastResult[0].transcript;
            setTranscript(text);

            if (lastResult.isFinal && text.trim()) {
                addLog(`Final: "${text.trim()}"`);
                handleUserSpeech(text.trim());
            }
        };

        recognition.onerror = (event: any) => {
            addLog(`Error: ${event.error}`);
            
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access and try again.');
            } else if (event.error === 'no-speech') {
                // Restart listening if session is active
                if (isSessionActiveRef.current && status !== 'processing' && status !== 'speaking') {
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (e) {
                            // Ignore if already started
                        }
                    }, 100);
                }
            } else if (event.error !== 'aborted') {
                console.error('Speech recognition error:', event.error);
            }
        };

        recognition.onend = () => {
            addLog('Recognition ended');
            // Auto-restart if session is still active and not processing/speaking
            if (isSessionActiveRef.current && status !== 'processing' && status !== 'speaking') {
                setTimeout(() => {
                    try {
                        recognition.start();
                        addLog('Auto-restarted listening');
                    } catch (e) {
                        // Ignore if already started
                    }
                }, 100);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, []);

    // Handle user speech - send to AI
    const handleUserSpeech = async (text: string) => {
        if (!text.trim() || !isSessionActiveRef.current) return;

        // Stop listening while processing
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore
            }
        }

        setStatus('processing');
        setIsThinking(true);
        addLog('Sending to AI...');

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

            // Speak the response
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

    // Speak the AI response
    const speakResponse = async (text: string) => {
        if (!isSessionActiveRef.current) return;

        setStatus('speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);

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

            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                if (isSessionActiveRef.current) {
                    setStatus('listening');
                    if (onSpeakingStateChange) onSpeakingStateChange(false);
                    // Resume listening
                    setTimeout(() => {
                        if (recognitionRef.current && isSessionActiveRef.current) {
                            try {
                                recognitionRef.current.start();
                                addLog('Resumed listening');
                            } catch (e) {
                                // Ignore
                            }
                        }
                    }, 200);
                }
            };

            audio.onerror = () => {
                console.warn('Audio playback failed, using fallback TTS');
                playFallbackTTS(text);
            };

            await audio.play();

        } catch (err) {
            console.error('TTS Error:', err);
            playFallbackTTS(text);
        }
    };

    // Fallback to browser TTS
    const playFallbackTTS = (text: string) => {
        if (!isSessionActiveRef.current) return;

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

        utterance.onend = () => {
            if (isSessionActiveRef.current) {
                setStatus('listening');
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                // Resume listening
                setTimeout(() => {
                    if (recognitionRef.current && isSessionActiveRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            // Ignore
                        }
                    }
                }, 200);
            }
        };

        utterance.onerror = () => {
            setStatus('listening');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            if (recognitionRef.current && isSessionActiveRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    // Ignore
                }
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    // Barge-in: Stop AI speech when user starts talking
    useEffect(() => {
        if (isUserSpeaking && status === 'speaking') {
            addLog('Barge-in detected');
            // Stop audio playback
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            // Stop browser TTS
            window.speechSynthesis.cancel();
            
            setStatus('listening');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
        }
    }, [isUserSpeaking, status, onSpeakingStateChange]);

    // Start session
    const handleStartSession = useCallback(async () => {
        setIsSessionActive(true);
        isSessionActiveRef.current = true;
        setStatus('listening');
        setError(null);
        setTranscript('');
        setAiResponse('');

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                addLog('Session started');
            } catch (e: any) {
                console.error('Recognition start error:', e);
                setError('Failed to start microphone. Please check permissions.');
                setIsSessionActive(false);
                isSessionActiveRef.current = false;
                setStatus('idle');
            }
        }
    }, []);

    // End session
    const handleEndSession = useCallback(() => {
        setIsSessionActive(false);
        isSessionActiveRef.current = false;
        setStatus('idle');

        // Stop recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
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

        addLog('Session ended');
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
                            {transcript && <p className={styles.transcriptText}>You: "{transcript}"</p>}
                            {aiResponse && <p className={styles.transcriptText} style={{ color: '#60a5fa', marginTop: '0.5rem' }}>AI: "{aiResponse}"</p>}
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
