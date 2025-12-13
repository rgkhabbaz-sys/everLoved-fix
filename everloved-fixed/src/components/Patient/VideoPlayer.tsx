'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Video } from 'lucide-react';
import { getAllVideos, createVideoURL, revokeVideoURL } from '../../utils/videoStorage';
import styles from './Patient.module.css';

interface StoredVideo {
    id: string;
    name: string;
    blob: Blob;
    type: string;
    size: number;
    uploadedAt: number;
    thumbnail?: string;
}

interface VideoPlayerProps {
    onClose?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onClose }) => {
    const [videos, setVideos] = useState<StoredVideo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [videoURL, setVideoURL] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load videos from storage
    useEffect(() => {
        const loadVideos = async () => {
            try {
                const storedVideos = await getAllVideos();
                setVideos(storedVideos);
                setIsLoading(false);
            } catch (err) {
                console.error('Failed to load videos:', err);
                setIsLoading(false);
            }
        };
        loadVideos();
    }, []);

    // Update video URL when current video changes
    useEffect(() => {
        if (videos.length > 0 && videos[currentIndex]) {
            // Revoke old URL
            if (videoURL) {
                revokeVideoURL(videoURL);
            }
            // Create new URL
            const newURL = createVideoURL(videos[currentIndex]);
            setVideoURL(newURL);
        }

        return () => {
            if (videoURL) {
                revokeVideoURL(videoURL);
            }
        };
    }, [currentIndex, videos]);

    // Auto-play when video loads
    useEffect(() => {
        if (videoRef.current && videoURL) {
            videoRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(err => {
                console.log('Auto-play prevented:', err);
            });
        }
    }, [videoURL]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const playNext = () => {
        if (videos.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % videos.length);
        }
    };

    const playPrevious = () => {
        if (videos.length > 1) {
            setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
        }
    };

    const handleVideoEnd = () => {
        // Auto-loop: play next or restart current
        if (videos.length > 1) {
            playNext();
        } else if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };

    // No videos state
    if (!isLoading && videos.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.videoPlayerContainer}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center',
                    padding: '2rem',
                }}
            >
                <Video size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3 style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No Videos Yet</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '300px' }}>
                    Upload comfort videos in the Caregiver Dashboard under "Avatar Configuration"
                </p>
            </motion.div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.videoPlayerContainer}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                }}
            >
                <p style={{ color: '#94a3b8' }}>Loading videos...</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={styles.videoPlayerContainer}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '16px',
                overflow: 'hidden',
            }}
        >
            {/* Video Display */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {videoURL && (
                    <video
                        ref={videoRef}
                        src={videoURL}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            background: '#000',
                        }}
                        playsInline
                        onEnded={handleVideoEnd}
                        onClick={togglePlay}
                    />
                )}

                {/* Close button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                        }}
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Video title overlay */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '1rem',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                    }}
                >
                    <p style={{ color: 'white', fontSize: '0.9rem', margin: 0 }}>
                        {videos[currentIndex]?.name || 'Video'}
                    </p>
                    {videos.length > 1 && (
                        <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                            {currentIndex + 1} of {videos.length}
                        </p>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.5)',
                }}
            >
                {/* Previous */}
                <button
                    onClick={playPrevious}
                    disabled={videos.length <= 1}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: videos.length > 1 ? 'white' : '#4b5563',
                        cursor: videos.length > 1 ? 'pointer' : 'not-allowed',
                        padding: '0.5rem',
                    }}
                >
                    <SkipBack size={24} />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '56px',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                    }}
                >
                    {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
                </button>

                {/* Next */}
                <button
                    onClick={playNext}
                    disabled={videos.length <= 1}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: videos.length > 1 ? 'white' : '#4b5563',
                        cursor: videos.length > 1 ? 'pointer' : 'not-allowed',
                        padding: '0.5rem',
                    }}
                >
                    <SkipForward size={24} />
                </button>

                {/* Mute */}
                <button
                    onClick={toggleMute}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        marginLeft: '1rem',
                    }}
                >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
            </div>

            {/* Video Thumbnails (if multiple) */}
            {videos.length > 1 && (
                <div
                    style={{
                        display: 'flex',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        overflowX: 'auto',
                        background: 'rgba(0, 0, 0, 0.3)',
                    }}
                >
                    {videos.map((video, index) => (
                        <button
                            key={video.id}
                            onClick={() => setCurrentIndex(index)}
                            style={{
                                flexShrink: 0,
                                width: '80px',
                                height: '45px',
                                border: index === currentIndex ? '2px solid #4ade80' : '2px solid transparent',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                padding: 0,
                                background: '#1f2937',
                            }}
                        >
                            {video.thumbnail ? (
                                <img
                                    src={video.thumbnail}
                                    alt={video.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Video size={16} style={{ opacity: 0.5 }} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default VideoPlayer;
