import mongoose, { type InferSchemaType, Schema } from "mongoose";

const AppLogSchema = new Schema(
  {
    fingerprint: { type: String, required: true, unique: true, index: true },
    level: { type: String, enum: ["error", "warn", "info"], default: "error", index: true },
    kind: {
      type: String,
      enum: ["error", "rate_limit", "cron", "resume", "api"],
      default: "error",
      index: true,
    },
    message: { type: String, required: true },
    source: { type: String, default: "", index: true },
    path: { type: String, default: "" },
    userId: { type: String, default: "", index: true },
    status: { type: Number, default: null },
    stack: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: () => ({}) },
    count: { type: Number, default: 1 },
    seen: { type: Boolean, default: false, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

AppLogSchema.index({ seen: 1, lastSeenAt: -1 });
AppLogSchema.index({ kind: 1, lastSeenAt: -1 });

export type AppLogDoc = InferSchemaType<typeof AppLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AppLog =
  (mongoose.models.AppLog as mongoose.Model<AppLogDoc>) ||
  mongoose.model<AppLogDoc>("AppLog", AppLogSchema);
