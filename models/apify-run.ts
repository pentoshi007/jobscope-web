import mongoose, { type InferSchemaType, Schema } from "mongoose";

/**
 * Tracks a pending Apify actor run so the next cron invocation
 * can pick up the dataset once the run finishes.
 */
const ApifyRunSchema = new Schema(
  {
    /** Apify actor-run ID */
    runId: { type: String, required: true, unique: true, index: true },
    /** The actor path/ID that was invoked */
    actorId: { type: String, required: true },
    /** Current known status (READY, RUNNING, SUCCEEDED, FAILED, TIMED-OUT, ABORTED) */
    status: { type: String, default: "RUNNING" },
    /** Once the run finishes this holds the default dataset ID */
    defaultDatasetId: { type: String, default: "" },
    /** When the run was started */
    startedAt: { type: Date, default: Date.now },
    /** When the run completed (null while still running) */
    completedAt: { type: Date, default: null },
    /** Whether the dataset has already been ingested */
    ingested: { type: Boolean, default: false },
    /** Origin: "cron" or "admin" */
    origin: { type: String, default: "cron" },
  },
  { timestamps: true },
);

ApifyRunSchema.index({ status: 1, ingested: 1 });
ApifyRunSchema.index({ startedAt: -1 });

export type ApifyRunDoc = InferSchemaType<typeof ApifyRunSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApifyRun =
  (mongoose.models.ApifyRun as mongoose.Model<ApifyRunDoc>) ||
  mongoose.model<ApifyRunDoc>("ApifyRun", ApifyRunSchema);
