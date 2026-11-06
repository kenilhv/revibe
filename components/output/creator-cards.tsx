// Local creators from the market scan who fit the video. A card links to the profile only when the URL is real.

import { compact } from "@/lib/format";
import type { CreatorMatch } from "@/lib/types";
import { ExampleTag, NewTabNote } from "../map/evidence";
import { ExternalIcon } from "../map/icons";
import { handle, plural } from "../map/labels";
import { ACCOUNT_PLATFORM } from "./text";

const LABEL = "font-mono text-[0.65rem] font-medium uppercase tracking-[0.1em] text-muted";

export function CreatorCards({ creators, marketName }: { creators: CreatorMatch[]; marketName: string }) {
  return (
    <section aria-labelledby="rv-creators-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Local creators</span>
        <h2 id="rv-creators-heading" className="font-display text-xl font-semibold">
          {plural(creators.length, "creator")} who fit this video
        </h2>
        <p className="text-sm text-muted">
          From the {marketName} scan. Work with them, or study how they post.
        </p>
      </div>

      {creators.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-muted">
          No creators in the scan match this video.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {creators.map((creator, i) => (
            <li key={`${creator.handle}-${i}`} className="min-w-0">
              <CreatorCard creator={creator} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreatorCard({ creator }: { creator: CreatorMatch }) {
  const name = handle(creator.handle);
  const initial = name.slice(1, 2).toUpperCase() || "?";

  return (
    <article className="flex h-full flex-col gap-3.5 rounded-xl border border-line bg-surface p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-display text-sm font-semibold text-muted"
        >
          {initial}
        </span>
        <div className="flex min-w-0 flex-col">
          {creator.url ? (
            <a
              href={creator.url}
              target="_blank"
              rel="noopener noreferrer"
              title={name}
              className="flex min-w-0 items-center gap-1 text-sm font-semibold text-ink underline-offset-2 hover:underline"
            >
              <span className="truncate">{name}</span>
              <ExternalIcon className="size-3 shrink-0 text-muted" />
              <NewTabNote />
            </a>
          ) : (
            <span title={name} className="truncate text-sm font-semibold text-ink">
              {name}
            </span>
          )}
          <span className="text-xs text-muted">{ACCOUNT_PLATFORM[creator.platform]}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 border-y border-line py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className={LABEL}>Followers</dt>
          <dd className="tabular font-display text-lg font-semibold leading-tight">{compact(creator.followers)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className={LABEL}>Avg views</dt>
          <dd className="tabular font-display text-lg font-semibold leading-tight">{compact(creator.avg_views)}</dd>
        </div>
      </dl>

      <p className="text-sm leading-relaxed text-muted">{creator.why}</p>

      {!creator.url && <ExampleTag className="mt-auto self-start" />}
    </article>
  );
}
