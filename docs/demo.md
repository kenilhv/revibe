# Stage demo: 3 minutes

Everything replays from the cache. Set `REVIBE_OFFLINE=1` in `.env.local`, restart `npm run dev`, and check http://localhost:3002/api/health shows `"offline": true`.

## The real video

- Source: https://www.tiktok.com/@jennnbellee/video/7676581842794958110 (4.8M views, TikTok, US). Paste this exact link.
- Niche: energy drink. Home: United States, English. Target: Japan, Japanese, platform "Recommend from data". Data source: Oriane API.
- Cached: the video analysis, the US and Japan scans (200 candidates each, 114 and 56 on-topic), the plan (68% → 93%), three scripts, and the Wan 3.0 renders: script B hook (5 s), script B full (22 s), and a US-market recreation of the source with the same creator and the same Red Bull can (`us-7676581842794958110.mp4`), shown as "Before". The real TikTok download is `source-7676581842794958110.mp4`.
- Say it straight if asked: the "before" on screen is a recreation of the TikTok source so both videos share one creator and one can; the original is linked on the Analyze stage.

## Script

| Time | Stage | Say |
|---|---|---|
| 0:00 | Brief | "This is a creator's video that did 4.8 million views in the US. We want it to work in Japan." Drop the link. Paste the example brief. Analyze my video. |
| 0:20 | Analyze | Let the theater run (7 s). "ReVibe read the transcript, the first three seconds, the objects on screen." Point at the hook and the objects: Red Bull, golf cart, cash register. |
| 0:50 | Market | Theater (9 s): "161 Japanese videos found, 144 dropped, 56 labeled." Then the Object Gap: US vs Japan. "Nobody in Japan is at a golf cart. Everybody is at a supermarket." |
| 1:30 | Plan | Theater (8 s). Suggestions first, hook on top. Then the frame match: the source frame on the left, the Japanese frame on the right, a line per change. Click one evidence chip. "Every change points at a real video." |
| 2:15 | Final | Theater (9 s): "Wan 3.0 on GMI Cloud renders script A, 21 seconds." The video plays. "Before 68%, after 93%." Compound hand-off in one line. |
| 2:50 | Close | "Oriane finds what works. ReVibe decides what to change, with proof. GMI Cloud and Wan 3.0 render it. Compound posts it." |

## If something breaks

- A stage shows an error: press Retry. The cache answers in milliseconds.
- The theater runs long: press Skip.
- The link is wrong: use "Use the example video" (US @jay.lifts → Japan, also fully cached).
