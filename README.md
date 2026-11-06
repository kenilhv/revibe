# ReVibe

Take a winning short video to a new market. Keep what is you. Change what is context. Prove each change with real social video data.

Built at Hack the Feed (San Francisco, 6 November 2026) on Oriane, GMI Cloud and Wan 3.0.

## What ReVibe does

1. **Read the source video.** Paste a TikTok or Instagram link. Oriane returns the transcript, the words of the first 3 seconds, the on-screen text, the audio and the numbers. ReVibe finds the hook, the format, the objects and settings, the phrases and the sound.
2. **Scan the target market.** ReVibe searches Oriane for the top videos in the niche, in the market's language, from the last 90 days. The model drops videos that only mention the niche. Code counts every pattern.
3. **Compare on five layers:** hook, format, objects, phrases, sound. The Object Gap chart shows the two markets side by side.
4. **Make the relevance map.** KEEP items protect the creator: face, voice, energy and the core claim. CHANGE items replace the context that does not travel. Each change links to the videos from the scan that support it.
5. **Write the output:** 3 script variants in the target language with an English gloss and shot directions, a posting plan, and 5 local creators from the scan.
6. **Render a preview clip** of the hook shot with Wan 3.0 on GMI Cloud (720P, 9:16, 5 s).
7. **Hand off to Compound** for the cut, the captions, the post and the tracking. Compound has no public API, so this step shows the payload that ReVibe would send.

The score is `S = 0.35·Hook + 0.20·Format + 0.20·Objects + 0.15·Phrases + 0.10·Sound`. Each term is the share of the video's elements in that layer that are in the market's top set. It is a heuristic. It does not predict views.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3002.

Example mode needs no keys and no network: a US energy drink video by @jay.lifts, adapted for Japan, with three pre-rendered clips. The UI marks it "Example data".

Keys in `.env.local`:

| Variable | What it does |
|---|---|
| `GMI_API_KEY` | GMI Cloud inference key. Needed for every live analysis. |
| `GMI_MODEL` | Chat model on GMI Cloud. Use a non-reasoning model, or one that accepts the no-reasoning flag. Tested: `deepseek-ai/DeepSeek-V4-Flash`. |
| `ORIANE_API_KEY` | Oriane Connect API key. Needed for live scans and for source videos by link. |
| `SCAN_SAMPLE_SIZE` | Candidates per market from the API (default 120, demo 200). |
| `REVIBE_OFFLINE` | `1` on stage: no external calls, only the cache and example data. |

Without an Oriane key, upload an Oriane CSV export per market instead (Input screen, "Oriane CSV").

## Demo checklist

- [ ] `npm run dev`, then open http://localhost:3002/api/health. `llm` and `oriane_api` are `true`.
- [ ] Run every live input of the demo once. Each live result lands in `data/cache/`.
- [ ] Set `REVIBE_OFFLINE=1` in `.env.local` and restart. `/api/health` shows `"offline": true`. ReVibe now replays the cache.
- [ ] Do not commit `data/cache/`. It holds uploads, scans and renders.

## How the data flows

```
Source video ──► /api/source ──► SourceProfile
Target market ─► /api/scan ────► MarketProfile (Oriane search → model labels → code counts)
Both ──────────► /api/map ─────► RelevanceMap (model drafts keep/change → code resolves evidence, scores)
Map ───────────► /api/output ──► OutputPack (3 scripts, creators, posting plan, Compound payload)
Variant ───────► /api/render ──► Wan 3.0 clip on GMI Cloud (async job, polled)
```

Server modules live in `lib/server/`. `oriane-api.ts` calls `POST /rest/contents/search` on `connect.oriane.xyz` (see `docs/oriane-api.md`). `wan.ts` calls the GMI Cloud video queue. `llm.ts` asks GMI Cloud chat models for strict JSON and turns reasoning off.

## Limits

- The score is a heuristic.
- Objects and settings come from what the model reads in captions, transcripts and on-screen text, not from Oriane's visual tags, which the API does not expose today.
- Oriane indexes TikTok and Instagram, accounts over 5,000 followers, and has no country filter. ReVibe scans a market by its spoken language.
- The phrases layer is the weakest: short viral phrases are rare in a 50-video sample.
- Each live scan uses Oriane credits (2 pages of 100) and a few model calls. Each clip costs about $0.50 at 720P.
