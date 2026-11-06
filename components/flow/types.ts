// The five-stage flow. Each stage first runs (visible progress), then shows its result.

import type {
  ApiMeta,
  DataMode,
  Market,
  MarketProfile,
  OutputPack,
  PlatformChoice,
  RelevanceMap,
  RenderJob,
  SourceProfile,
} from "@/lib/types";

export type Stage = "brief" | "analyze" | "market" | "plan" | "final";

export const STAGES: { id: Stage; label: string; title: string }[] = [
  { id: "brief", label: "Brief", title: "Your video and your plan" },
  { id: "analyze", label: "Analyze", title: "Reading the video" },
  { id: "market", label: "Market", title: "Scanning the target market" },
  { id: "plan", label: "Plan", title: "What to keep, what to change" },
  { id: "final", label: "Final", title: "The market-ready video" },
];

export const STAGE_ORDER: Stage[] = STAGES.map((s) => s.id);

export interface Brief {
  /** TikTok or Instagram link of the source video. Empty when the example video is used. */
  videoUrl: string;
  /** A dropped file name, shown back to the user. The file itself is not analyzed today. */
  fileName: string | null;
  /** Campaign documents or notes: goals, claims to keep, launch dates, audience. */
  docs: string;
  niche: string;
  home: Market;
  target: { country: string; language: string; platform: PlatformChoice };
  /** Data source per market: the bundled example, an Oriane CSV export, or the Oriane API. */
  mode: DataMode;
  /** Dataset ids when mode is "csv". */
  homeDatasetId: string | null;
  targetDatasetId: string | null;
}

export interface RunData {
  source?: SourceProfile;
  home?: MarketProfile;
  target?: MarketProfile;
  map?: RelevanceMap;
  output?: OutputPack;
  hookClip?: RenderJob;
  fullClip?: RenderJob;
  metas: Partial<Record<"source" | "home" | "target" | "map" | "output" | "hookClip" | "fullClip", ApiMeta>>;
}

/** One line of the progress theater. */
export interface TheaterStep {
  label: string;
  /** A real number or value from the data, shown after the label. */
  detail?: string;
}

export type StagePhase = "idle" | "running" | "result" | "error";

export interface StageState {
  phase: StagePhase;
  steps: TheaterStep[];
  /** Target length of the progress theater in milliseconds. */
  durationMs: number;
  error?: string;
}

export interface RunView {
  stage: Stage;
  brief: Brief;
  data: RunData;
  states: Record<Stage, StageState>;
  /** The stage the run has reached. Earlier stages can be opened again. */
  reached: Stage;
  busy: boolean;
}

export interface RunActions {
  start: (brief: Brief) => void;
  /** Go to the next stage and run it. */
  next: () => void;
  back: () => void;
  goTo: (stage: Stage) => void;
  /** End the progress theater of the current stage now. */
  skipTheater: () => void;
  /** Run the current stage again after an error. */
  retry: () => void;
  restart: () => void;
}

export interface ScreenProps {
  run: RunView;
  actions: RunActions;
}
