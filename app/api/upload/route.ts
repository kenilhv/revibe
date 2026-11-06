import { saveDatasetWithReport } from "@/lib/server/datasets";
import { handle, UserError } from "@/lib/server/http";
import { UploadRequestSchema } from "@/lib/server/schemas";
import type { DatasetSummary } from "@/lib/types";

// POST /api/upload: store an Oriane CSV export and return its summary.

const MAX_CSV_BYTES = 25 * 1024 * 1024;
// The JSON envelope escapes quotes and line breaks, so the body can be larger than the file.
const MAX_BODY_BYTES = 40 * 1024 * 1024;

export const POST = handle(
  UploadRequestSchema,
  async ({ filename, csv }) => {
    if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
      throw new UserError("The file is larger than 25 MB. In Oriane, export fewer rows or fewer columns, then upload it again.", 413);
    }
    const report = await saveDatasetWithReport(filename, csv);
    const note = report.warnings.slice(0, 3).join(" ");
    return { data: report.summary satisfies DatasetSummary, source: "live", note: note || undefined };
  },
  { maxBytes: MAX_BODY_BYTES },
);
