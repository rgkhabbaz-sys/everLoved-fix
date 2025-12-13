'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import styles from './Patient.module.css';
import { Mic, AlertCircle } from 'lucide-react';

// ============================================
// EVERLOVED VOICE SESSION v5.0
// HANDS-FREE + INTERRUPTIBLE (VAD-POWERED)
// ============================================
// 
// Features:
// - Always-on listening via Voice Activity Detection
// - Automatic speech start/end detection
// - Barge-in: User can interrupt AI anytime
// - No button clicks required
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
    // ===== STATE =====
    const [status, setStatus] = useState<'idle' | 'listening' | 'user-speaking' | 'processing' | 'ai-speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);

    // ===== REFS =====
    const isActiveRef = useRef(false);
    const statusRef = useRef(status);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const transcriptRef = useRef('');

    useEffect(() => { statusRef.current = status; }, [status]);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        console.log(`[VAD] ${ts}: ${msg}`);
        setDebugLogs(prev => [...prev.slice(-4), `${ts}: ${msg}`]);
    };

    // ===== BARGE-IN: STOP AI AUDIO =====
    const stopAIAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
            addLog('⚡ Barge-in: AI stopped');
        }
        if (onSpeakingStateChange) onSpeakingStateChange(false);
    }, [onSpeakingStateChange]);

    // ===== PLAY AI RESPONSE =====
    const playAIResponse = useCallback(async (text: string) => {
        if (!isActiveRef.current) return;

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
                
                if (isActiveRef.current) {
                    setStatus('listening');
                    setTranscript('');
                    transcriptRef.current = '';
                }
            };

            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
                if (onSpeakingStateChange) onSpeakingStateChange(false);
                if (isActiveRef.current) setStatus('listening');
            };

            await audio.play();

        } catch (err) {
            console.error('TTS error:', err);
            addLog('TTS error');
            if (onSpeakingStateChange) onSpeakingStateChange(false);
            if (isActiveRef.current) setStatus('listening');
        }
    }, [activeProfile, onSpeakingStateChange]);

    // ===== PROCESS SPEECH =====
    const processUserSpeech = useCallback(async (text: string) => {
        if (!text.trim() || text.length < 2 || !isActiveRef.current) return;

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
            if (isActiveRef.current) setStatus('listening');
        }
    }, [activeProfile, playAIResponse]);

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
            if (!isActiveRef.current) return;

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

        recognition.onend = () => {
            // Will be restarted by VAD
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, []);

    // ===== VAD HOOK =====
    const vad = useMicVAD({
        startOnLoad: false, // We'll start it manually when session begins
        redemptionFrames: 20, // Wait ~20 frames to confirm speech ended
        onSpeechStart: () => {
            if (!isActiveRef.current) return;
            
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
            if (!isActiveRef.current) return;
            
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
            addLog('VAD misfire (noise)');
        },
    });

    // ===== START SESSION =====
    const handleStartSession = useCallback(async () => {
        try {
            // Request microphone permission
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
        setAiResponse('');
        transcriptRef.current = '';

        // Start VAD
        vad.start();
        
        addLog('🚀 Hands-free mode active');
    }, [vad]);

    // ===== END SESSION =====
    const handleEndSession = useCallback(() => {
        addLog('🛑 Session ended');
        
        isActiveRef.current = false;
        setIsSessionActive(false);
        setStatus('idle');

        // Stop everything
        vad.pause();
        
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) {}
        }
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        onEndSession();
    }, [vad, onEndSession]);

    // ===== STATUS INDICATOR COLOR =====
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

            {/* START BUTTON (only shown before session starts) */}
            {!isSessionActive && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', zIndex: 20 }}>
                    <button onClick={handleStartSession} className={styles.startButton}>
                        <Mic size={32} />
                    </button>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>Tap to start hands-free</p>
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

                    {/* End Button */}
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
