// Video Storage using IndexedDB
// Handles larger video files than localStorage allows

const DB_NAME = 'everLovedVideos';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

interface StoredVideo {
    id: string;
    name: string;
    blob: Blob;
    type: string;
    size: number;
    uploadedAt: number;
    thumbnail?: string;
}

// Initialize the database
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Save a video
export async function saveVideo(file: File): Promise<StoredVideo> {
    const db = await openDB();
    
    const video: StoredVideo = {
        id: `video_${Date.now()}`,
        name: file.name,
        blob: file,
        type: file.type,
        size: file.size,
        uploadedAt: Date.now(),
    };

    // Generate thumbnail
    try {
        video.thumbnail = await generateThumbnail(file);
    } catch (e) {
        console.error('Failed to generate thumbnail:', e);
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(video);

        request.onsuccess = () => resolve(video);
        request.onerror = () => reject(request.error);
    });
}

// Get all videos
export async function getAllVideos(): Promise<StoredVideo[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// Get a single video by ID
export async function getVideo(id: string): Promise<StoredVideo | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

// Delete a video
export async function deleteVideo(id: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Generate video thumbnail
function generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadeddata = () => {
            // Seek to 1 second or 10% of video duration
            video.currentTime = Math.min(1, video.duration * 0.1);
        };

        video.onseeked = () => {
            canvas.width = 160;
            canvas.height = 90;
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            URL.revokeObjectURL(video.src);
            resolve(thumbnail);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video'));
        };

        video.src = URL.createObjectURL(file);
    });
}

// Create object URL for playback
export function createVideoURL(video: StoredVideo): string {
    return URL.createObjectURL(video.blob);
}

// Revoke object URL when done
export function revokeVideoURL(url: string): void {
    URL.revokeObjectURL(url);
}
