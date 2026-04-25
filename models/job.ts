import mongoose, { Schema, type InferSchemaType } from "mongoose";

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
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

JobSchema.index({ externalId: 1, source: 1 }, { unique: true });
JobSchema.index({ title: "text", company: "text", description: "text" });
JobSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

export type JobDoc = InferSchemaType<typeof JobSchema> & { _id: mongoose.Types.ObjectId };

export const Job =
  (mongoose.models.Job as mongoose.Model<JobDoc>) || mongoose.model<JobDoc>("Job", JobSchema);
