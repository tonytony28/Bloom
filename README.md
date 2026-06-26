# 🌸 Bloom

**A warm, voice-first companion that helps women in Sub-Saharan Africa
discover their passion — and turn it into a real learning path and local
opportunities.**

Bloom is built for low-literacy, low-bandwidth, mobile-first users. You can
talk to it in your language (English, Kiswahili, Bemba, or French), and
Bloom talks back. After a short conversation, it surfaces concrete next
steps: things to learn and organizations near you that can help.

## How it works

1. **Talk to Bloom.** Tap the mic and answer one gentle question at a time.
   Bloom (powered by Claude Haiku) listens for what lights you up.
2. **Hear your passion.** After 3–5 exchanges, Bloom names what you love
   and shows it back to you.
3. **Walk the path.** Bloom generates 3 personalized learning topics in
   your language and lists real opportunities in your region.

## Tech

- **Next.js 16** App Router + React 19 + Tailwind 4
- **Anthropic Claude Haiku 4.5** — multilingual, low-latency chat
- **Groq Whisper-large-v3** — free, fast voice transcription (OpenAI-compatible API)
- **Web Speech API (`speechSynthesis`)** — Bloom speaks her replies back
- **`MediaRecorder` + `AnalyserNode`** — voice capture with a live waveform

## Run locally

```bash
npm install
# Create .env.local with the two keys below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables

Create `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=...    # console.anthropic.com
GROQ_API_KEY=...         # console.groq.com/keys (free tier)
```

| Var | Where to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) (free tier) |

## What's deliberate

- **Voice-first**, because typing is a barrier for many target users.
- **Mobile-shaped layout** — every screen is designed for a phone.
- **Offline-friendly** — the conversation persists in `localStorage` and an
  offline banner appears when the network drops.
- **Share by WhatsApp** — the dominant comms platform in SSA. Discoveries
  flow naturally into existing social networks.
- **No build-time secrets exposed to the client.** All AI calls go through
  Next.js API routes.

## Folder layout

```
src/
  app/
    page.tsx                 # Welcome + language picker
    discover/                # Voice chat with Bloom
    path/                    # Personalized passion + learning path
    api/
      chat/route.ts          # Claude Haiku chat
      transcribe/route.ts    # Groq Whisper transcription
  lib/
    claude.ts                # Claude client + prompts
    i18n.ts                  # Languages + dictionary
    use-lang.ts              # Language preference hook
    opportunities.ts         # Curated regional opportunities
```
