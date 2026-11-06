# Oriane API: verified notes

These facts come from live calls on 6 November 2026, and from the OpenAPI spec that is embedded in https://connect.oriane.xyz/rest/docs.

## Connection

- Base URL: `https://connect.oriane.xyz`
- Auth: `Authorization: Bearer <ORIANE_API_KEY>`. The key starts with `beta_`. `x-api-key` returns 401.
- Send the body as UTF-8 JSON from code (Node `fetch`). Do not test Japanese queries with curl arguments in Git Bash: Windows changes the characters and the search returns 0.
- Status 200 means one page holds all results. Status 206 means more pages exist. Status 402 means the account has no credits left.
- Each call uses credits. The cost goes up with the projection.

## Endpoints

| Method | Path | Use |
|---|---|---|
| POST | `/rest/contents/search` | Search videos and posts |
| POST | `/rest/profiles/search` | Search creator profiles |
| POST | `/rest/assets` | Make a text or image asset for visual search |

### Query string for `/rest/contents/search`

- `limit`: 1 to 100 (default 20)
- `offset`: page start
- `projection`: `basic` | `default` | `full`. Only `full` returns `media[]` with transcripts.
- `sort`: comma list of fields with an optional `:asc` or `:desc`. Fields: `visualSimilarity`, `transcriptRelevance`, `viewsCount`, `likesCount`, `sharesCount`, `commentsCount`, `interactionsCount`, `engagementRatePerViews`, `engagementRatePerFollowers`, `viewsRatePerFollowers`, `profileFollowersCount`, `publishedAt`.
- `aiSearchAnchor`: send it on later pages of a visual similarity search.

### Body

```json
{
  "operator": "and",
  "filters": { "...": "..." },
  "queries": [{ "operator": "or", "filters": { "...": "..." } }]
}
```

- `operator` is required at every level.
- `queries` nests at most 2 levels. Use it to OR several text angles inside one AND.
- The total number of filter values is 500 or fewer.

### Filter shapes

- List filters: `{ "includes": [...], "excludes": [...], "operator": "and" }`
- Text filters: one or more of `exactMatch`, `includesExactly`, `includesFuzzy`, `excludesExactly`, `excludesFuzzy`. Each is `{ "values": [...], "operator": "or" }`.
- Number filters: `{ "min": 10000, "max": 5000000 }`
- Date filters: `{ "after": "2026-08-08", "before": "2026-11-06" }`
- Booleans: `true` or `false`

### Filters ReVibe uses

| Filter | Shape | Note |
|---|---|---|
| `transcriptLanguage` | list | ISO 639-1, for example `"ja"`, `"en"`. `"japanese"` returns 0. |
| `captionLanguage` | list | Same codes |
| `transcript`, `caption`, `onScreenText`, `hashtags`, `audioTitle` | text | Japanese works with UTF-8 bodies |
| `format` | list | `"video"` |
| `platform` | list | `"tiktok"`, `"instagram"`, `"youtube"` |
| `publishedAt` | date | Last 90 days |
| `viewsCount`, `profileFollowersCount`, `viewsRatePerFollowers` | number | |
| `profileLocationCompleteAddress`, `locationCompleteAddress` | text | Country proxy. Most profiles have no location, so use it only as a soft signal. |
| `platformId` | list of `{ platform, platformId }` | Look up one known video |
| `visualSimilarity` | `{ includes: { values: [{ assetId, minScore }] } }` | See the warning below |

## Response

`data.results[]` (projection `full`) includes:

- `id`, `platform`, `platformId`, `platformType`, `format`, `publishedAt`
- `caption`, `captionLanguage`, `hashtags[]`, `mentions[]`
- `viewsCount`, `likesCount`, `sharesCount`, `commentsCount`, `interactionsCount`
- `engagementRatePerViews`, `engagementRatePerFollowers`, `viewsRatePerFollowers` (percentages)
- `profileHandle`, `profileDisplayName`, `profileFollowersCount`, `profileVerified`, `profileBio`, `profileLocationCompleteAddress`
- `audioTitle`, `audioAuthor`, `audioType`, `audioCopyrighted`
- `thumbnailMediaUrl`
- `media[]`: `duration`, `transcript`, `transcriptLanguage`, `transcriptChunks[] { startSeconds, endSeconds, text }`, `onScreenText[]`, `frames[] { timestampSeconds, url, onScreenTextRegions[] }`
- `popularComments[] { content, likesCount }`

Also: `data.aggregations` (total and average views, likes, interactions) and `metadata.pagination { offset, limit, totalCount }`.

There is no video URL field. Build it:

- TikTok: `https://www.tiktok.com/@<profileHandle>/video/<platformId>`
- Instagram: use the shortcode if the API gives one; otherwise link to `https://www.instagram.com/<profileHandle>/`

## What we learned

1. **Hooks are exact.** `transcriptChunks` with `startSeconds < 3` give the words of the first 3 seconds.
2. **On-screen text is real data.** `onScreenText[]` is a layer that the CSV export does not have.
3. **Visual search with a text asset is weak for products.** "a person holding a can of energy drink" returned food and travel videos at every `minScore` from 0.2 to 0.75. Do not use it to scan a niche. Image assets may work better; this was not tested.
4. **Keywords can be noisy.** `モンスター` also matches "monster" in other contexts. The labeler must mark each video as relevant to the niche or not, and the market profile must use only relevant videos.
5. **Volume, last 90 days, at least 10K views, by transcript language:**

| Niche | English | Japanese |
|---|---|---|
| Energy drink | 33,778 | 452 |
| Skincare | 52,575 | 3,599 |
| Protein and fitness | 83,250 | 1,377 |
| Coffee | 104,539 | 3,201 |
| Convenience store food | 6,402 | 1,327 |
| Ramen and noodles | 7,217 | 1,961 |

## Scan query plan for a market

1. Build niche terms for the target language: a short native-language list plus brand names in native script and in Latin script. Use a small built-in dictionary for the demo niches, and the LLM for other niches.
2. Call `/rest/contents/search` once with `limit=100`, `projection=full`, `sort=viewsRatePerFollowers:desc`:

```json
{
  "operator": "and",
  "filters": {
    "transcriptLanguage": { "includes": ["ja"] },
    "format": { "includes": ["video"] },
    "publishedAt": { "after": "<today minus 90 days>" },
    "viewsCount": { "min": 10000 }
  },
  "queries": [
    {
      "operator": "or",
      "filters": {
        "transcript": { "includesFuzzy": { "values": ["エナドリ", "エナジードリンク", "レッドブル"], "operator": "or" } },
        "caption": { "includesFuzzy": { "values": ["エナドリ", "エナジードリンク", "レッドブル"], "operator": "or" } }
      }
    }
  ]
}
```

3. Map each result to the same row shape as the CSV pipeline (`OrianeRow`). Put the first 3 seconds of `transcriptChunks` in the hook text, and `onScreenText` in the objects input.
4. Label, drop the videos that are not about the niche, aggregate, and cache the result. One scan costs one call.

## Source video from a URL

- TikTok: the `platformId` is the number after `/video/` in the URL.
- Instagram: convert the shortcode in `/reel/<code>` or `/p/<code>` to the numeric media id (base64url alphabet `A-Z a-z 0-9 - _`, read as base 64 into a BigInt).
- Search with `filters.platformId.includes = [{ platform, platformId }]`, `projection=full`, `limit=1`.
