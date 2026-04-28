import mongoose, { type InferSchemaType, Schema } from "mongoose";

const SalarySchema = new Schema(
  {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    currency: { type: String, default: null },
    period: { type: String, enum: ["year", "month", "hour", null], default: null },
  },
  { _id: false },
);

const JobSchema = new Schema(
  {
    externalId: { type: String, required: true },
    source: { type: String, required: true, index: true },
    dedupeHash: { type: String, required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: "" },
    country: { type: String, default: "", index: true },
    remote: { type: Boolean, default: false },
    workMode: { type: String, enum: ["remote", "hybrid", "onsite", "unknown"], default: "unknown" },
    description: { type: String, default: "" },
    url: { type: String, required: true },
    postedAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date },
    salary: { type: SalarySchema, default: () => ({}) },
    extractedSkills: { type: [String], default: [], index: true },
    seniority: {
      type: String,
      enum: ["junior", "mid", "senior", "staff", "unknown"],
      default: "unknown",
    },
    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
    sourceQuality: { type: Number, default: 50 },
    fetchedAt: { type: Date, default: Date.now },
    cacheExpiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
  },
  { timestamps: true },
);

JobSchema.index({ externalId: 1, source: 1 }, { unique: true });
JobSchema.index({ title: "text", company: "text", description: "text" });
JobSchema.index({ fetchedAt: 1 });
JobSchema.index({ cacheExpiresAt: 1 }, { expireAfterSeconds: 0 });
JobSchema.index({ extractedSkills: 1, fetchedAt: -1, postedAt: -1 });
JobSchema.index({ country: 1, workMode: 1, cacheExpiresAt: 1, postedAt: -1 });

export type JobDoc = InferSchemaType<typeof JobSchema> & { _id: mongoose.Types.ObjectId };

export const Job =
  (mongoose.models.Job as mongoose.Model<JobDoc>) || mongoose.model<JobDoc>("Job", JobSchema);
