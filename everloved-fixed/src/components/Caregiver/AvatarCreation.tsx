'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Upload, Mic, Shield, Check, X, Video, Trash2 } from 'lucide-react';
import styles from './Caregiver.module.css';
import { motion } from 'framer-motion';
import { useAvatar } from '../../hooks/useAvatar';
import { saveVideo, getAllVideos, deleteVideo } from '../../utils/videoStorage';

interface StoredVideo {
    id: string;
    name: string;
    blob: Blob;
    type: string;
    size: number;
    uploadedAt: number;
    thumbnail?: string;
}

const AvatarCreation = () => {
    const {
        photos,
        selectedPhotoIndex,
        setSelectedPhotoIndex,
        voiceStyle,
        setVoiceStyle,
        tones,
        toggleTone,
        identity,
        setIdentity,
        boundaries,
        toggleBoundary,
        isSaving,
        saveMessage,
        handlePhotoUpload,
        handleSave,
        removePhoto
    } = useAvatar();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textFileRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    // Video state
    const [videos, setVideos] = useState<StoredVideo[]>([]);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [videoUploadMessage, setVideoUploadMessage] = useState<string | null>(null);

    // Load existing videos on mount
    useEffect(() => {
        const loadVideos = async () => {
            try {
                const storedVideos = await getAllVideos();
                setVideos(storedVideos);
            } catch (err) {
                console.error('Failed to load videos:', err);
            }
        };
        loadVideos();
    }, []);

    const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                setIdentity(prev => ({ ...prev, lifeStory: text }));
            }
        };
        reader.readAsText(file);
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            setVideoUploadMessage('Please upload MP4, WebM, or MOV files');
            setTimeout(() => setVideoUploadMessage(null), 3000);
            return;
        }

        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            setVideoUploadMessage('Video must be under 100MB');
            setTimeout(() => setVideoUploadMessage(null), 3000);
            return;
        }

        setIsUploadingVideo(true);
        setVideoUploadMessage('Uploading...');

        try {
            const savedVideo = await saveVideo(file);
            setVideos(prev => [...prev, savedVideo]);
            setVideoUploadMessage('Video uploaded!');
            setTimeout(() => setVideoUploadMessage(null), 3000);
        } catch (err) {
            console.error('Failed to save video:', err);
            setVideoUploadMessage('Upload failed. Please try again.');
            setTimeout(() => setVideoUploadMessage(null), 3000);
        } finally {
            setIsUploadingVideo(false);
            // Reset input
            if (videoInputRef.current) {
                videoInputRef.current.value = '';
            }
        }
    };

    const handleDeleteVideo = async (videoId: string) => {
        try {
            await deleteVideo(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
        } catch (err) {
            console.error('Failed to delete video:', err);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={styles.grid}>
            {/* Photo Upload */}
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 1.0, ease: "easeInOut" }}
            >
                <div className={styles.cardHeader}>
                    <Upload className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Photo Upload</h2>
                </div>
                <div
                    className={styles.uploadZone}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handlePhotoUpload}
                    />
                    <Upload size={48} />
                    <p>Drag & drop or click to upload</p>
                    <button className={styles.tabButton} style={{ background: 'rgba(255,255,255,0.1)', marginTop: '0.5rem' }}>
                        Choose Files
                    </button>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Supports JPG, PNG</p>
                </div>

                {photos.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <p className={styles.label}>Select Primary Avatar:</p>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {/* No Photo Option */}
                            <div
                                style={{
                                    position: 'relative',
                                    width: '80px',
                                    height: '80px',
                                    cursor: 'pointer',
                                    border: selectedPhotoIndex === -1 ? '3px solid #4ade80' : '2px solid rgba(255,255,255,0.2)',
                                    borderRadius: '10px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.2)',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}
                                onClick={() => setSelectedPhotoIndex(-1)}
                            >
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>No<br />Photo</span>
                                {selectedPhotoIndex === -1 && (
                                    <div style={{
                                        position: 'absolute', bottom: -8, right: -8,
                                        background: '#4ade80', color: 'black',
                                        borderRadius: '50%', width: '20px', height: '20px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                            </div>

                            {photos.map((photo, index) => (
                                <div
                                    key={index}
                                    style={{
                                        position: 'relative',
                                        width: '80px',
                                        height: '80px',
                                        cursor: 'pointer',
                                        border: selectedPhotoIndex === index ? '3px solid #4ade80' : '2px solid transparent',
                                        borderRadius: '10px',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setSelectedPhotoIndex(index)}
                                >
                                    <img
                                        src={photo}
                                        alt={`Upload ${index + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                    {selectedPhotoIndex === index && (
                                        <div style={{
                                            position: 'absolute', bottom: -8, right: -8,
                                            background: '#4ade80', color: 'black',
                                            borderRadius: '50%', width: '20px', height: '20px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                                        style={{
                                            position: 'absolute', top: -5, right: -5,
                                            background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none',
                                            borderRadius: '50%', width: '20px', height: '20px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Voice Engine */}
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 1.0, ease: "easeInOut" }}
            >
                <div className={styles.cardHeader}>
                    <Mic className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Voice Engine</h2>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Voice Style</label>
                    <select
                        className={styles.select}
                        value={voiceStyle}
                        onChange={(e) => setVoiceStyle(e.target.value)}
                    >
                        <option value="warm">Warm & Comforting</option>
                        <option value="gentle">Gentle & Soft</option>
                        <option value="slow">Slow-paced & Clear</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Tone Anchors</label>
                    <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={tones.calm}
                                onChange={() => toggleTone('calm')}
                            /> Calm
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={tones.jovial}
                                onChange={() => toggleTone('jovial')}
                            /> Jovial
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={tones.authoritative}
                                onChange={() => toggleTone('authoritative')}
                            /> Authoritative
                        </label>
                    </div>
                </div>
            </motion.div>

            {/* Safety Settings */}
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 1.0, ease: "easeInOut" }}
            >
                <div className={styles.cardHeader}>
                    <Shield className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Safety Settings</h2>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Identity Configuration</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Patient Name (e.g. Sarah)"
                        value={identity.patientName}
                        onChange={(e) => setIdentity(prev => ({ ...prev, patientName: e.target.value }))}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Avatar Name (e.g. Michel)"
                        style={{ marginBottom: '0.5rem' }}
                        value={identity.name}
                        onChange={(e) => setIdentity(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Relationship (e.g. Mother)"
                        value={identity.relationship}
                        onChange={(e) => {
                            const val = e.target.value;
                            const lower = val.toLowerCase();
                            let newGender = identity.gender;

                            // Simple heuristic for auto-gender detection
                            const maleTerms = ['father', 'dad', 'grandpa', 'grandfather', 'husband', 'brother', 'son', 'uncle', 'nephew'];
                            const femaleTerms = ['mother', 'mom', 'grandma', 'grandmother', 'wife', 'sister', 'daughter', 'aunt', 'niece'];

                            if (maleTerms.some(term => lower.includes(term))) {
                                newGender = 'male';
                            } else if (femaleTerms.some(term => lower.includes(term))) {
                                newGender = 'female';
                            }

                            setIdentity(prev => ({ ...prev, relationship: val, gender: newGender }));
                        }}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <select
                        className={styles.select}
                        value={identity.gender}
                        onChange={(e) => setIdentity(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                    >
                        <option value="female">Female (Warm)</option>
                        <option value="male">Male (Deep)</option>
                    </select>
                </div>

                {/* Deep Context / Life Story Section */}
                <div className={styles.formGroup} style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label className={styles.label} style={{ marginBottom: 0 }}>Life Story</label>
                        <button
                            className={styles.tabButton}
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.1)' }}
                            onClick={() => textFileRef.current?.click()}
                        >
                            <Upload size={14} style={{ marginRight: '4px' }} /> Upload Text File
                        </button>
                        <input
                            type="file"
                            ref={textFileRef}
                            style={{ display: 'none' }}
                            accept=".txt"
                            onChange={handleTextFileUpload}
                        />
                    </div>
                    <textarea
                        className={styles.input}
                        style={{ minHeight: '200px', resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit' }}
                        placeholder="Paste a biography, key memories, childhood stories, or important life events here..."
                        value={identity.lifeStory}
                        onChange={(e) => setIdentity(prev => ({ ...prev, lifeStory: e.target.value }))}
                    />
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                        This context will be injected into the AI's Brain to personalize every conversation.
                    </p>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Boundaries</label>
                    <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={boundaries.blockTravel}
                                onChange={() => toggleBoundary('blockTravel')}
                            /> Block travel promises
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={boundaries.blockAlive}
                                onChange={() => toggleBoundary('blockAlive')}
                            /> Block &quot;being alive&quot; claims
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={boundaries.redirectConfusion}
                                onChange={() => toggleBoundary('redirectConfusion')}
                            /> Redirect confusion
                        </label>
                    </div>
                </div>
            </motion.div>

            {/* Video Generation */}
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6, duration: 1.0, ease: "easeInOut" }}
            >
                <div className={styles.cardHeader}>
                    <Video className={styles.cardIcon} size={24} />
                    <h2 className={styles.cardTitle}>Video Library</h2>
                </div>
                
                {/* Upload Zone */}
                <div 
                    className={styles.uploadZone} 
                    style={{ borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)', padding: '2rem', cursor: 'pointer' }}
                    onClick={() => videoInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={videoInputRef}
                        style={{ display: 'none' }}
                        accept="video/mp4,video/webm,video/mov,video/quicktime"
                        onChange={handleVideoUpload}
                    />
                    <Video size={32} style={{ color: '#3b82f6' }} />
                    <p style={{ fontWeight: 600, marginTop: '1rem' }}>Upload Comfort Videos</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>MP4, WebM, MOV (max 100MB)</p>
                    <button 
                        className={styles.tabButton} 
                        style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', width: '100%', fontSize: '0.9rem' }}
                        disabled={isUploadingVideo}
                    >
                        {isUploadingVideo ? 'Uploading...' : 'Select Video'}
                    </button>
                </div>

                {/* Upload Message */}
                {videoUploadMessage && (
                    <p style={{ 
                        marginTop: '0.75rem', 
                        fontSize: '0.85rem', 
                        color: videoUploadMessage.includes('failed') || videoUploadMessage.includes('Please') ? '#f87171' : '#4ade80',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {videoUploadMessage.includes('failed') || videoUploadMessage.includes('Please') ? <X size={14} /> : <Check size={14} />}
                        {videoUploadMessage}
                    </p>
                )}

                {/* Video List */}
                {videos.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <p className={styles.label}>Uploaded Videos ({videos.length})</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                            {videos.map((video) => (
                                <div
                                    key={video.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    {/* Thumbnail */}
                                    <div
                                        style={{
                                            width: '80px',
                                            height: '45px',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            background: '#1f2937',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {video.thumbnail ? (
                                            <img
                                                src={video.thumbnail}
                                                alt={video.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ 
                                                width: '100%', 
                                                height: '100%', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center' 
                                            }}>
                                                <Video size={16} style={{ opacity: 0.5 }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ 
                                            fontSize: '0.9rem', 
                                            fontWeight: 500, 
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {video.name}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                            {formatFileSize(video.size)}
                                        </p>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteVideo(video.id)}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            padding: '0.5rem',
                                            cursor: 'pointer',
                                            color: '#f87171',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Save Button */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                {saveMessage && (
                    <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Check size={16} /> {saveMessage}
                    </span>
                )}
                <button
                    className={styles.tabButton}
                    style={{ background: 'var(--foreground)', color: 'var(--background)', fontWeight: 600 }}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
};

export default AvatarCreation;
