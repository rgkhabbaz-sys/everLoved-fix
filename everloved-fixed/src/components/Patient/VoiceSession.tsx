'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Patient.module.css';
import { Mic, AlertCircle } from 'lucide-react';

// ============================================
// AUDIO QUEUE CLASS - STRICT FIFO, NO LOOPS
// ============================================
class AudioQueue {
    private queue: Blob[] = [];
    private isPlaying: boolean = false;
    private currentAudio: HTMLAudioElement | null = null;
    private onPlaybackStart: () => void;
    private onPlaybackEnd: () => void;
    private isFadingOut: boolean = false;

    constructor(onStart: () => void, onEnd: () => void) {
        this.onPlaybackStart = onStart;
        this.onPlaybackEnd = onEnd;
    }

    // Push audio to queue and start playing if idle
    push(audioBlob: Blob): void {
        this.queue.push(audioBlob);
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    // Play next item in queue - ONE WAY, NO LOOPS
    private async playNext(): Promise<void> {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            this.currentAudio = null;
            this.onPlaybackEnd();
            return;
        }

        this.isPlaying = true;
        this.onPlaybackStart();

        // POP and DESTROY - this chunk can never be played twice
        const audioBlob = this.queue.shift()!;
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
            // Clean up THIS chunk completely
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            // Immediately check for next - no delay
            this.playNext();
        };

        audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            this.playNext();
        };

        try {
            await audio.play();
        } catch (e) {
            console.error('Audio play error:', e);
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            this.playNext();
        }
    }

    // SMART BARGE-IN: Fade out over 200ms, then stop
    async fadeOutAndClear(): Promise<void> {
        if (!this.currentAudio || this.isFadingOut) return;
        
        this.isFadingOut = true;
        const audio = this.currentAudio;
        const startVolume = audio.volume;
        const fadeSteps = 10;
        const fadeInterval = 20; // 200ms total

        for (let i = fadeSteps; i >= 0; i--) {
            if (!this.currentAudio) break;
            audio.volume = (i / fadeSteps) * startVolume;
            await new Promise(r => setTimeout(r, fadeInterval));
        }

        this.stop();
        this.isFadingOut = false;
    }

    // Hard stop - clear everything
    stop(): void {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        // Clear the entire queue - no leftovers
        this.queue = [];
        this.isPlaying = false;
        this.onPlaybackEnd();
    }

    get playing(): boolean {
        return this.isPlaying;
    }
}

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

interface SpeechRecognition extends EventTarget {
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

declare global {
    interface Window {
        webkitSpeechRecognition: { new(): SpeechRecognition };
        SpeechRecognition: { new(): SpeechRecognition };
    }
}

// ============================================
// EVERLOVED VOICE SESSION v3.0
// LINEAR AUDIO QUEUE + SMART INTERRUPT
// ============================================

const VoiceSession: React.FC<VoiceSessionProps> = ({ 
    onEndSession, 
    onSpeakingStateChange, 
    activeProfile 
}) => {
    // ===== TUNED CONFIGURATION =====
    const CONFIG = {
        SILENCE_THRESHOLD_MS: 1000,    // Back to 1 second for lower latency
        DEAF_PERIOD_MS: 800,           // Ignore echo for 800ms
        MIN_TRANSCRIPT_LENGTH: 2,
        RESTART_DELAY_MS: 100,
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
    const statusRef = useRef<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioQueueRef = useRef<AudioQueue | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const deafUntilRef = useRef<number>(0);
    const accumulatedTextRef = useRef<string>('');

    // Sync status ref
    useEffect(() => { statusRef.current = status; }, [status]);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        console.log(`[Voice] ${ts}: ${msg}`);
        setDebugLogs(prev => [...prev.slice(-4), `${ts}: ${msg}`]);
    };

    // ===== AUDIO QUEUE CALLBACKS =====
    const handlePlaybackStart = useCallback(() => {
        setStatus('speaking');
        if (onSpeakingStateChange) onSpeakingStateChange(true);
        // Set deaf period - ignore all input for next 800ms
        deafUntilRef.current = Date.now() + CONFIG.DEAF_PERIOD_MS;
        addLog('🔊 Playing audio...');
    }, [onSpeakingStateChange, CONFIG.DEAF_PERIOD_MS]);

    const handlePlaybackEnd = useCallback(() => {
        if (!isActiveRef.current) return;
        
        if (onSpeakingStateChange) onSpeakingStateChange(false);
        setStatus('listening');
        setTranscript('');
        setInterimTranscript('');
        accumulatedTextRef.current = '';
        addLog('🎤 Ready to listen');
        
        // Restart recognition
        setTimeout(() => {
            if (isActiveRef.current && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {}
            }
        }, CONFIG.RESTART_DELAY_MS);
    }, [onSpeakingStateChange, CONFIG.RESTART_DELAY_MS]);

    // Initialize AudioQueue once
    useEffect(() => {
        audioQueueRef.current = new AudioQueue(handlePlaybackStart, handlePlaybackEnd);
        return () => {
            audioQueueRef.current?.stop();
        };
    }, [handlePlaybackStart, handlePlaybackEnd]);

    // ===== PROCESS USER SPEECH =====
    const processUserSpeech = useCallback(async (text: string) => {
        if (!text.trim() || text.length < CONFIG.MIN_TRANSCRIPT_LENGTH || !isActiveRef.current) {
            return;
        }

        // Stop listening during processing
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) {}
        }

        setStatus('processing');
        setIsThinking(true);
        accumulatedTextRef.current = '';
        addLog(`🤔 Processing: "${text.substring(0, 40)}..."`);

        try {
            // Get AI response
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, profile: activeProfile }),
            });

            if (!chatResponse.ok) throw new Error(`Chat API: ${chatResponse.status}`);

            const { text: aiText } = await chatResponse.json();
            const responseText = aiText || "I'm here with you.";
            
            setAiResponse(responseText);
            setIsThinking(false);
            addLog(`AI: "${responseText.substring(0, 30)}..."`);

            // Get TTS audio - INSTANT START
            const ttsResponse = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: responseText, 
                    gender: activeProfile?.gender || 'female' 
                }),
            });

            if (!ttsResponse.ok) throw new Error('TTS failed');

            // Push to queue immediately - plays instantly
            const audioBlob = await ttsResponse.blob();
            audioQueueRef.current?.push(audioBlob);

        } catch (err: any) {
            console.error('Process error:', err);
            setIsThinking(false);
            addLog(`Error: ${err.message}`);
            
            // Fallback with browser TTS
            const fallback = "I'm here with you. Take your time.";
            setAiResponse(fallback);
            playBrowserTTS(fallback);
        }
    }, [activeProfile, CONFIG.MIN_TRANSCRIPT_LENGTH]);

    // ===== BROWSER TTS FALLBACK =====
    const playBrowserTTS = useCallback((text: string) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        
        utterance.onstart = () => {
            setStatus('speaking');
            if (onSpeakingStateChange) onSpeakingStateChange(true);
            deafUntilRef.current = Date.now() + CONFIG.DEAF_PERIOD_MS;
        };
        
        utterance.onend = () => {
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            if (isActiveRef.current) {
                setStatus('listening');
                setTranscript('');
                accumulatedTextRef.current = '';
                setTimeout(() => {
                    if (isActiveRef.current && recognitionRef.current) {
                        try { recognitionRef.current.start(); } catch (e) {}
                    }
                }, CONFIG.RESTART_DELAY_MS);
            }
        };
        
        window.speechSynthesis.speak(utterance);
    }, [onSpeakingStateChange, CONFIG.DEAF_PERIOD_MS, CONFIG.RESTART_DELAY_MS]);

    // ===== SMART BARGE-IN =====
    useEffect(() => {
        // Only trigger if user speaks while AI is playing AND deaf period is over
        if (isUserSpeaking && status === 'speaking' && Date.now() > deafUntilRef.current) {
            addLog('⚡ Barge-in - fading out');
            audioQueueRef.current?.fadeOutAndClear();
            window.speechSynthesis.cancel();
        }
    }, [isUserSpeaking, status]);

    // ===== INITIALIZE SPEECH RECOGNITION =====
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setError('Speech recognition not supported. Use Chrome, Edge, or Safari.');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            addLog('Recognition started');
            setError(null);
        };

        recognition.onspeechstart = () => {
            // Ignore if in deaf period
            if (Date.now() < deafUntilRef.current) return;
            
            setIsUserSpeaking(true);
            // Clear silence timer - user is speaking
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        };

        recognition.onspeechend = () => {
            setIsUserSpeaking(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            if (!isActiveRef.current) return;
            // Ignore during deaf period
            if (Date.now() < deafUntilRef.current) return;

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

                // Reset silence timer - 1 second
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                silenceTimerRef.current = setTimeout(() => {
                    if (isActiveRef.current && 
                        statusRef.current === 'listening' && 
                        accumulated.length >= CONFIG.MIN_TRANSCRIPT_LENGTH) {
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
            } else if (event.error === 'no-speech' || event.error === 'aborted') {
                // Restart if still active and in listening mode
                if (isActiveRef.current && statusRef.current === 'listening') {
                    setTimeout(() => {
                        try { recognition.start(); } catch (e) {}
                    }, CONFIG.RESTART_DELAY_MS);
                }
            }
        };

        recognition.onend = () => {
            // Auto-restart if active and listening
            if (isActiveRef.current && statusRef.current === 'listening') {
                setTimeout(() => {
                    try { recognition.start(); } catch (e) {}
                }, CONFIG.RESTART_DELAY_MS);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            isActiveRef.current = false;
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            recognition.abort();
        };
    }, [processUserSpeech, CONFIG]);

    // ===== START SESSION =====
    const handleStartSession = useCallback(async () => {
        try {
            // Request mic with echo cancellation
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

        if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (e) {}
        }
    }, []);

    // ===== END SESSION =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Session ended');
        
        isActiveRef.current = false;
        setIsSessionActive(false);
        setStatus('idle');

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        recognitionRef.current?.abort();
        audioQueueRef.current?.stop();
        window.speechSynthesis.cancel();

        onEndSession();
    }, [onEndSession]);

    // ===== RENDER =====
    return (
        <div className={styles.voiceSessionContainer}>
            {/* Error Alert */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
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
                    }}
                >
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        style={{ marginLeft: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </motion.div>
            )}

            {/* START BUTTON */}
            {!isSessionActive && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', zIndex: 20 }}>
                    <button onClick={handleStartSession} className={styles.startButton}>
                        <Mic size={32} />
                    </button>
                </div>
            )}

            {/* ACTIVE SESSION */}
            {isSessionActive && (
                <>
                    {/* Ripples */}
                    <div className={styles.rippleContainer}>
                        {status === 'speaking' && (
                            <motion.div
                                className={styles.rippleSpeaking}
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
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
                                transition={{ duration: 0.8, repeat: Infinity }}
                            />
                        )}
                        {!isUserSpeaking && !isThinking && status === 'listening' && (
                            <motion.div
                                className={styles.rippleListening}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                        )}
                    </div>

                    {/* Status */}
                    <p className={styles.statusText}>
                        <span className={styles.statusLabel}>
                            {isUserSpeaking ? "Listening..." :
                                isThinking ? "Thinking..." :
                                    status === 'speaking' ? "Speaking..." :
                                        "Listening..."}
                        </span>
                    </p>

                    {/* Transcript */}
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

                    {/* Debug */}
                    <div style={{ marginTop: '1rem', width: '100%', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>

                    {/* End Button */}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
                        <button
                            className={styles.endButton}
                            onClick={handleEndSession}
                            style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)' }}
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
