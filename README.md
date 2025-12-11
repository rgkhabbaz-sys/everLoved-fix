# everLoved - AI Companion for Alzheimer's Patients

A voice-first AI companion application designed to provide comfort and support for individuals with dementia and their caregivers.

## Features

- **Voice Conversation**: Natural voice interaction using browser speech recognition
- **AI Companion**: Powered by Google Gemini with clinical dementia care protocols
- **Text-to-Speech**: ElevenLabs for natural voice responses (with browser fallback)
- **Caregiver Dashboard**: Monitor sessions and configure patient profiles
- **Wellness Tracking**: Health and wellness metrics visualization
- **Science Section**: Educational resources about dementia care

## Quick Deploy to Vercel

### Step 1: Create a New GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `everloved` (or any name you prefer)
3. Keep it **Private** if you want
4. Click **Create repository**
5. Don't add any files yet

### Step 2: Push This Code to Your New Repo

Open Terminal/Command Prompt in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repo name.

### Step 3: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Import your new repository
4. Before deploying, add **Environment Variables**:

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google AI API key | Yes |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | Optional* |

*If you don't have ElevenLabs, the app will use browser text-to-speech as fallback.

5. Click **Deploy**

### Step 4: Get Your API Keys

**Gemini API Key (Required):**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the key

**ElevenLabs API Key (Optional but recommended):**
1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Sign up for free account
3. Go to Profile Settings → API Keys
4. Copy your API key

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local file with your keys
echo "GEMINI_API_KEY=your_key_here" > .env.local
echo "ELEVENLABS_API_KEY=your_key_here" >> .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Browser Support

Voice features work best in:
- Google Chrome (recommended)
- Microsoft Edge
- Safari

## Tech Stack

- Next.js 15
- React 18
- TypeScript
- Framer Motion
- Google Gemini AI
- ElevenLabs TTS
- Web Speech API

## License

Private - For personal use only.
