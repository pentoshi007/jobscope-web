import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ApplicationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    status: {
      type: String,
      enum: ["saved", "applied", "interview", "offer", "rejected"],
      default: "saved",
    },
    notes: { type: String, default: "" },
    appliedAt: { type: Date, default: null },
    reminderAt: { type: Date, default: null },
    matchScoreSnapshot: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
ApplicationSchema.index({ userId: 1, status: 1, order: 1 });

export type ApplicationDoc = InferSchemaType<typeof ApplicationSchema>;

export const Application =
  (mongoose.models.Application as mongoose.Model<ApplicationDoc>) ||
  mongoose.model<ApplicationDoc>("Application", ApplicationSchema);
