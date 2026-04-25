import mongoose, { Schema, type InferSchemaType } from "mongoose";

const MatchSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, required: true },
    jobId: { type: Schema.Types.ObjectId, required: true },
    score: { type: Number, required: true },
    breakdown: {
      skills: Number,
      seniority: Number,
      location: Number,
      experience: Number,
      recency: Number,
    },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    computedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
  },
  { timestamps: true },
);

MatchSchema.index({ userId: 1, resumeId: 1, score: -1 });
MatchSchema.index({ userId: 1, jobId: 1, resumeId: 1 }, { unique: true });

export type MatchDoc = InferSchemaType<typeof MatchSchema>;

export const Match =
  (mongoose.models.Match as mongoose.Model<MatchDoc>) ||
  mongoose.model<MatchDoc>("Match", MatchSchema);
