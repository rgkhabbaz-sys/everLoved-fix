import { useState, useEffect, useCallback } from 'react';
import { compressImage } from '../utils/imageUtils';

export interface Identity {
    name: string;
    relationship: string;
    gender: 'male' | 'female';
    patientName: string;
    lifeStory: string;
}

export interface AvatarState {
    photos: string[];
    selectedPhotoIndex: number | null;
    voiceStyle: string;
    tones: { calm: boolean; jovial: boolean; authoritative: boolean };
    identity: Identity;
    boundaries: { blockTravel: boolean; blockAlive: boolean; redirectConfusion: boolean };
    isSaving: boolean;
    saveMessage: string;
}

export const useAvatar = () => {
    const [photos, setPhotos] = useState<string[]>([]);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
    const [voiceStyle, setVoiceStyle] = useState('gentle');
    const [tones, setTones] = useState({ calm: true, jovial: true, authoritative: false });
    const [identity, setIdentity] = useState<Identity>({
        name: '',
        relationship: '',
        gender: 'female',
        patientName: '',
        lifeStory: ''
    });
    const [boundaries, setBoundaries] = useState({ blockTravel: true, blockAlive: true, redirectConfusion: true });
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // Load saved data on mount
    useEffect(() => {
        const savedPhotos = localStorage.getItem('everloved_photos');
        if (savedPhotos) {
            const parsedPhotos = JSON.parse(savedPhotos);
            setPhotos(parsedPhotos);

            const savedAvatar = localStorage.getItem('everloved_avatar');
            if (savedAvatar) {
                const index = parsedPhotos.indexOf(savedAvatar);
                if (index !== -1) {
                    setSelectedPhotoIndex(index);
                }
                if (index !== -1) {
                    setSelectedPhotoIndex(index);
                }
            }
        }

        // Load active profile to populate identity
        const savedProfile = localStorage.getItem('everloved_active_profile');
        if (savedProfile) {
            try {
                const parsedProfile = JSON.parse(savedProfile);
                setIdentity(prev => ({
                    ...prev,
                    name: parsedProfile.name || '',
                    relationship: parsedProfile.relation || '',
                    gender: parsedProfile.gender || 'female',
                    patientName: parsedProfile.patientName || '',
                    lifeStory: parsedProfile.lifeStory || ''
                }));
            } catch (e) {
                console.error("Failed to load profile identity", e);
            }
        }

        const savedBoundaries = localStorage.getItem('everloved_boundaries');
        if (savedBoundaries) {
            setBoundaries(JSON.parse(savedBoundaries));
        }
    }, []);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (event.target?.result) {
                    try {
                        const originalBase64 = event.target!.result as string;
                        const compressedBase64 = await compressImage(originalBase64);

                        setPhotos(prev => {
                            const newPhotos = [...prev, compressedBase64];
                            try {
                                localStorage.setItem('everloved_photos', JSON.stringify(newPhotos));
                            } catch (err) {
                                console.error('Error saving photos list:', err);
                                setSaveMessage('Error: Storage full');
                            }
                            return newPhotos;
                        });

                        if (selectedPhotoIndex === null) {
                            setSelectedPhotoIndex(0);
                        }
                    } catch (error) {
                        console.error('Error compressing image:', error);
                        setSaveMessage('Error processing image');
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = useCallback(() => {
        setIsSaving(true);
        console.log('Saving configuration...', { selectedPhotoIndex, photosLength: photos.length });

        try {
            let activeImage = '';
            if (selectedPhotoIndex === -1) {
                console.log('Clearing avatar from localStorage (No Photo selected)');
                localStorage.removeItem('everloved_avatar');
            } else if (selectedPhotoIndex !== null && photos[selectedPhotoIndex]) {
                activeImage = photos[selectedPhotoIndex];
                console.log('Saving avatar to localStorage:', activeImage.substring(0, 50) + '...');
                localStorage.setItem('everloved_avatar', activeImage);
            } else {
                console.warn('No avatar selected or photo not found');
            }

            localStorage.setItem('everloved_boundaries', JSON.stringify(boundaries));

            // Phase 1: Create Single Source of Truth Profile
            const profile = {
                imageUrl: activeImage,
                name: identity.name,
                relation: identity.relationship,
                gender: identity.gender,
                patientName: identity.patientName,
                lifeStory: identity.lifeStory,
                boundaries: JSON.stringify(boundaries), // Serialize boundaries for easy prompt injection
            };

            localStorage.setItem('everloved_active_profile', JSON.stringify(profile));
            console.log('Saved active profile:', profile);

            setTimeout(() => {
                setIsSaving(false);
                setSaveMessage('Configuration saved successfully!');
                setTimeout(() => setSaveMessage(''), 3000);
            }, 1500);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            setIsSaving(false);
            setSaveMessage('Error saving! Image might be too large.');
            setTimeout(() => setSaveMessage(''), 3000);
        }
    }, [selectedPhotoIndex, photos, boundaries, identity]);

    const toggleTone = (tone: keyof typeof tones) => {
        setTones(prev => ({ ...prev, [tone]: !prev[tone] }));
    };

    const toggleBoundary = (boundary: keyof typeof boundaries) => {
        setBoundaries(prev => ({ ...prev, [boundary]: !prev[boundary] }));
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => {
            const newPhotos = prev.filter((_, i) => i !== index);
            localStorage.setItem('everloved_photos', JSON.stringify(newPhotos));
            return newPhotos;
        });
        if (selectedPhotoIndex === index) {
            setSelectedPhotoIndex(null);
            localStorage.removeItem('everloved_avatar');
        }
        if (selectedPhotoIndex !== null && selectedPhotoIndex > index) setSelectedPhotoIndex(selectedPhotoIndex - 1);
    };

    return {
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
    };
};
