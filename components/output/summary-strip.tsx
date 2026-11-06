import { compact, full, pct } from "@/lib/format";
import { PLATFORM_NAMES } from "@/lib/markets";
import type { MarketProfile, PostingPlan, RelevanceMap } from "@/lib/types";
import { Stat } from "../ui";
import { ArrowRightIcon } from "../map/icons";
import { plural, signedPoints } from "../map/labels";
import { shortDays } from "./text";

/** One line of facts above the scripts: score, changes, sample, and where to post. */
export function SummaryStrip({ map, market, posting }: { map: RelevanceMap; market: MarketProfile; posting: PostingPlan }) {
  const delta = map.score_after - map.score_before;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-surface px-5 py-4 shadow-card sm:px-6 md:grid-cols-4">
      <Stat
        label="Relevance score"
        value={
          <span className="inline-flex items-center gap-2">
            <span className="sr-only">Before: </span>
            <span className="text-muted">{pct(map.score_before)}</span>
            <ArrowRightIcon className="size-4 shrink-0 text-faint" />
            <span className="sr-only">After: </span>
            <span className="text-keep">{pct(map.score_after)}</span>
          </span>
        }
        sub={`${signedPoints(delta)} points. Heuristic, not a prediction.`}
      />
      <Stat
        label="Changes"
        value={map.change.length}
        sub={map.keep.length > 0 ? `${plural(map.keep.length, "thing")} kept as they are` : "Nothing kept"}
      />
      <Stat
        label="Market sample"
        value={`${full(market.sample.n)} ${market.sample.n === 1 ? "video" : "videos"}`}
        sub={`${compact(market.sample.total_views)} views · last ${plural(market.sample.days, "day")}`}
      />
      <Stat
        label="Post on"
        value={PLATFORM_NAMES[posting.platform]}
        sub={`${shortDays(posting.days)} · ${posting.local_time}`}
      />
    </div>
  );
}
