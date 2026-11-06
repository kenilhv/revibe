# ReVibe

ReVibe takes a short video that works in one market and adapts it for a new market.

## What ReVibe does

1. ReVibe reads the source video. It finds the hook, the format, the objects and settings, the phrases and the sound.
2. ReVibe scans the target market. It uses an Oriane search export of top TikTok and Instagram videos.
3. ReVibe finds the local patterns in five layers: hook, format, objects, phrases and sound.
4. ReVibe makes a relevance map:
   - KEEP items protect the creator: face, voice, energy and the core product claim.
   - CHANGE items replace context that does not travel. Each change shows evidence videos from the scan.
5. ReVibe writes the output: 3 script variants in the target language with an English gloss, shot directions, a posting plan and 5 local creators.
6. ReVibe shows the hand-off payload for Compound, a Mac AI video editor. This step is a mock. Compound has no public API.

The score is `S = 0.35·Hook + 0.20·Format + 0.20·Objects + 0.15·Phrases + 0.10·Sound`. Each term is the share of the video's elements in that layer that are in the market's top set. The score is a heuristic. It is not a prediction of views.

## Run it

1. Install the packages:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Optional: set `GMI_API_KEY` in `.env.local`. Without a key, ReVibe runs on example data and cached results only.
4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000.

Example mode needs no keys and no network. It shows a US energy drink video by @jay.lifts, adapted for Japan. The UI marks this data as "Example data".

## Export a CSV from Oriane

Oriane indexes TikTok and Instagram only. Accounts with fewer than 5,000 followers are not in the index. Oriane has no country filter, so ReVibe scans a market by its spoken language.

Do these steps once for each market (the home market and the target market):

1. Sign in to Oriane.
2. Start a new search.
3. Paste the search text for the market into the AI prompt box. Use one of the texts below.
4. Check the filters: Platforms is TikTok and Instagram. Language is the market language. Date is the last 3 months. Views is 50K or more.
5. Run the search.
6. Export the results as CSV. One search gives one CSV with up to 10,000 rows.
7. Include at least these columns: Video URL, Nb Views, Publish Date, Caption / Description, Audio Title, Account Username, Account Follower Count and Audio Transcript (Pro). If you are not sure, include all columns.
8. In ReVibe, set the market data to "CSV" and upload the file.

Search text for the United States (English):

```text
Find TikTok and Instagram videos about energy drinks, spoken in English, published in the last 3 months, with at least 50K views. Search for "energy drink" in the audio transcript and in the caption. Do not filter on hook phrases or on words in the first seconds of the video. When I export, include the Audio Transcript (Pro) column.
```

Search text for Japan (Japanese):

```text
Find TikTok and Instagram videos about energy drinks, spoken in Japanese, published in the last 3 months, with at least 50K views. Search for エナジードリンク, エナドリ and "energy drink" in the audio transcript and in the caption. Do not filter on hook phrases or on words in the first seconds of the video. When I export, include the Audio Transcript (Pro) column.
```

To check the parser after a change, run:

```bash
node data/fixtures/check-csv.mjs
```

## Demo checklist

- [ ] Open the app with no keys. Make sure that example mode works. Example mode is the fallback.
- [ ] Set `GMI_API_KEY`. Open http://localhost:3000/api/health. Make sure that `llm` is `true` and `model` is correct.
- [ ] Run every live input of the demo once. Each live run writes its result to `data/cache/`.
- [ ] If you change computers, copy the `data/cache/` folder to the demo computer.
- [ ] On stage, set `REVIBE_OFFLINE=1` in `.env.local` and restart the server. ReVibe then makes no external calls. It replays the cache and the example data.
- [ ] Make sure that `/api/health` shows `"offline": true`.
- [ ] Do not commit `data/cache/`. It holds uploaded exports.

## Architecture

Routes (all return `{ ok, data, meta }` or `{ ok: false, error }`):

- `GET /api/health`: which services are set up. No secrets.
- `POST /api/upload`: store an Oriane CSV export. Returns a dataset summary.
- `POST /api/source`: read the source video into a source profile.
- `POST /api/scan`: scan one market into a market profile.
- `POST /api/map`: KEEP and CHANGE items with evidence and the score.
- `POST /api/output`: scripts, creators, posting plan and the Compound payload.
- `POST /api/compound`: the mock hand-off to Compound.

Server modules in `lib/server/`:

- `env.ts`: configuration from environment variables.
- `http.ts`: the route wrapper (JSON parsing, validation, timing, errors).
- `csv.ts`: the Oriane CSV parser and the dataset summary.
- `datasets.ts`: stores uploads in `data/cache/datasets/`.
- `cache.ts`: the JSON file cache in `data/cache/`.
- `llm.ts`: GMI Cloud chat completions that must return valid JSON.
- `schemas.ts`: zod schemas for requests and model output.
- `prompts.ts`: the prompts.
- `market.ts`: the market scan. The model labels videos. Code counts every share.
- `source.ts`, `relevance.ts`, `output.ts`: source profile, relevance map and output pack.
- `samples.ts`: the example data in `data/samples/`.
- `oriane-api.ts`: the Oriane REST API adapter (private beta). It calls `POST /rest/contents/search` on `https://connect.oriane.xyz` and maps the results to the same rows as a CSV export.

## Limits

- The score is a heuristic. It compares labels with the market's top patterns. It does not predict views.
- Objects and settings come from captions, transcripts and comments that the model reads. The Oriane CSV export has no visual tags.
- The model labels at most `SCAN_SAMPLE_SIZE` videos per market (default 120): the top videos of the last `SCAN_DAYS` days (default 90), ranked by views per follower.
- The Oriane API is in private beta. ReVibe follows the API docs (connect.oriane.xyz/rest/docs) and `docs/oriane-api.md`. ReVibe sends the key as `Authorization: Bearer <key>`. The reply has no video link, so ReVibe builds it from the platform id. An API scan makes one call of 100 videos, sorted by views per follower. Each call uses Oriane credits. Use CSV exports or the cache for the demo.
- Keyword searches catch videos that are off-topic. The model marks each video as relevant or not, and ReVibe leaves out the off-topic videos (unless fewer than 30% are on-topic).
- The GMI Cloud base URL and the default model name come from third-party documents. Check them in your GMI Cloud console.
- Compound has no public API. The hand-off shows the payload that ReVibe would send.
