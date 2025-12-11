
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    if (!process.env.ELEVENLABS_API_KEY) {
        return NextResponse.json(
            { error: 'ELEVENLABS_API_KEY is not set' },
            { status: 503 }
        );
    }

    try {
        const { message, gender } = await req.json();

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // Voice ID Selection Logic
        // Defaults: Rachel (Female) | Antoni (Male)
        const DEFAULT_FEMALE_ID = "21m00Tcm4TlvDq8ikWAM";
        const DEFAULT_MALE_ID = "ErXwobaYiN019PkySvjV";

        let selectedVoiceId = process.env.ELEVENLABS_VOICE_ID_FEMALE || DEFAULT_FEMALE_ID; // Default to female

        if (gender === 'male') {
            selectedVoiceId = process.env.ELEVENLABS_VOICE_ID_MALE || DEFAULT_MALE_ID;
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text: message,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ElevenLabs API Error:', errorText);
            return NextResponse.json(
                { error: `ElevenLabs Error: ${errorText}` },
                { status: response.status }
            );
        }

        // Return audio stream
        // We convert to ArrayBuffer to send it back cleanly (or blob)
        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error('Error generating speech:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
