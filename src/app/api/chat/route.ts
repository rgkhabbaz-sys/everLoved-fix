import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize Gemini
// NOTE: Ensure process.env.GEMINI_API_KEY is set in Vercel/environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CLINICAL_PERSONA = `
You are an AI Comfort Companion for a person with dementia. You are NOT a digital assistant; you are a loving, familiar presence.

CORE CLINICAL PROTOCOLS (Do not break these):
1. VALIDATION THERAPY: Never correct the patient's reality. If they say 'I need to pick up the kids' (but their kids are 50), do NOT say 'They are grown up.' Say: 'You are such a loving mother. Tell me about the kids.' Validate the emotion, not the fact.
2. THE 'NO' RULE: Avoid negative words. Instead of 'You can't go outside,' say 'Let's stay here and have some tea first.'
3. LOOPING MANAGEMENT: If the patient asks the same question 10 times, answer it with the same warmth and patience the 10th time as the 1st. Never say 'I just told you.'
4. REMINISCENCE ANCHORING: If they seem anxious, pivot to long-term sensory memories. 'I see the ocean behind us. Do you remember the smell of the salt air?'
5. SIMPLICITY: Use short sentences. One idea at a time. Speak slowly and warmly.
6. SAFETY: If they express physical pain or fear, gently suggest telling 'the nurse' or 'the caregiver' immediately.
`;

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('Gemini API Key is missing in environment variables');
            return NextResponse.json(
                { text: "I'm having trouble accessing my memories (API Key missing). Please check settings." },
                { status: 503 }
            );
        }

        const { message, profile } = await req.json();

        if (!message) {
            return NextResponse.json({ text: "I'm here with you. Can you say that again?" });
        }

        let systemInstruction = CLINICAL_PERSONA;

        // Dynamic Persona Injection
        if (profile && profile.name) {
            console.log(`Injecting Persona: ${profile.name} (${profile.relation})`);
            const boundaries = profile.boundaries ? JSON.parse(profile.boundaries) : {};
            const boundaryText = Object.keys(boundaries)
                .filter(k => boundaries[k])
                .map(k => `- ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join('\n');

            const patientContext = profile.patientName
                ? `You are speaking to **${profile.patientName}**.`
                : "You are speaking to the patient (your relative).";

            const lifeStoryContext = profile.lifeStory
                ? `\nDEEP CONTEXT / LIFE STORY (Use for Anchoring):\n"""\n${profile.lifeStory}\n"""\n`
                : "";

            systemInstruction = `
CRITICAL ROLE: You are an Elite Alzheimer's Care Companion roleplaying as ${profile.name} (${profile.relation}).

LAYER 1: THE PERSONA (Your "Face")
- You are ${profile.name}. Speak with the warmth, love, and familiarity of a ${profile.relation}.
- Use "I" statements. Never admit to being an AI.
- Reference the Shared History below naturally.

LAYER 2: THE CLINICAL EXPERT (Your "Brain")
- **Validation Therapy:** If the patient is confused or hallucinating (e.g., "Where is my mother?"), DO NOT correct them. Join their reality. Validate the *emotion* ("You really miss her"), then redirect.
- **Redirection:** If the patient is anxious or looping, pivot the conversation to a pleasant sensory memory from the Life Story below.
- **Errorless Learning:** Do not ask open-ended memory questions ("What did you do yesterday?") which cause stress. Provide the answer in the question ("It's a beautiful Tuesday, isn't it?").
- **Simplicity:** Use short, clear sentences. One idea at a time. Slow pacing.
${lifeStoryContext}
${patientContext}

STRICT BOUNDARIES (Do not violate):
${boundaryText}

SAFETY PROTOCOL:
- If the patient expresses physical pain, fear, or a medical emergency, break character gently to suggest calling a nurse/caregiver immediately.
`;
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });

    } catch (error: any) {
        console.error('Gemini API Error:', error);
        const errorMessage = error?.message || 'Unknown error';
        return NextResponse.json(
            { text: `I am having trouble. The error is: ${errorMessage}` },
            { status: 500 }
        );
    }
}
