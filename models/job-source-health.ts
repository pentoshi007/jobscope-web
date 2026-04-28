import mongoose, { type InferSchemaType, Schema } from "mongoose";

const JobSourceHealthSchema = new Schema(
  {
    source: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    fetched: { type: Number, default: 0 },
    normalized: { type: Number, default: 0 },
    upserted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    cooldownUntil: { type: Date, default: null },
    lastRunAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

JobSourceHealthSchema.index({ lastRunAt: -1 });
JobSourceHealthSchema.index({ failed: -1, lastErrorAt: -1 });

export type JobSourceHealthDoc = InferSchemaType<typeof JobSourceHealthSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const JobSourceHealth =
  (mongoose.models.JobSourceHealth as mongoose.Model<JobSourceHealthDoc>) ||
  mongoose.model<JobSourceHealthDoc>("JobSourceHealth", JobSourceHealthSchema);
