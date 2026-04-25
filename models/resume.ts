import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ParsedSkillsSchema = new Schema(
  {
    languages: { type: [String], default: [] },
    frameworks: { type: [String], default: [] },
    tools: { type: [String], default: [] },
    databases: { type: [String], default: [] },
    cloud: { type: [String], default: [] },
    soft: { type: [String], default: [] },
  },
  { _id: false },
);

const ExperienceSchema = new Schema(
  {
    company: String,
    role: String,
    startDate: String,
    endDate: String,
    description: String,
    skills: { type: [String], default: [] },
  },
  { _id: false },
);

const EducationSchema = new Schema(
  {
    school: String,
    degree: String,
    field: String,
    startDate: String,
    endDate: String,
  },
  { _id: false },
);

const ParsedSchema = new Schema(
  {
    fullName: String,
    email: String,
    phone: String,
    location: String,
    summary: String,
    skills: { type: ParsedSkillsSchema, default: () => ({}) },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    certifications: { type: [String], default: [] },
    totalYearsExperience: { type: Number, default: 0 },
    inferredSeniority: { type: String, enum: ["junior", "mid", "senior", "staff"], default: "mid" },
  },
  { _id: false },
);

const ResumeSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    fileKey: { type: String, required: true },
    fileName: String,
    rawText: String,
    parsed: { type: ParsedSchema, default: () => ({}) },
    parsedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ResumeSchema.index({ userId: 1, isActive: 1 });

export type ResumeDoc = InferSchemaType<typeof ResumeSchema>;

export const Resume =
  (mongoose.models.Resume as mongoose.Model<ResumeDoc>) ||
  mongoose.model<ResumeDoc>("Resume", ResumeSchema);
