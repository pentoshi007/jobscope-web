import mongoose, { type InferSchemaType, Schema } from "mongoose";

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

const LinksSchema = new Schema(
  {
    website: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    twitter: { type: String, default: "" },
    other: { type: [String], default: [] },
  },
  { _id: false },
);

const ExperienceSchema = new Schema(
  {
    company: String,
    role: String,
    location: String,
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
    location: String,
    startDate: String,
    endDate: String,
    gpa: String,
    honors: String,
  },
  { _id: false },
);

const ProjectSchema = new Schema(
  {
    name: String,
    description: String,
    url: String,
    skills: { type: [String], default: [] },
  },
  { _id: false },
);

const _CertificationSchema = new Schema(
  {
    name: String,
    issuer: String,
    date: String,
    url: String,
  },
  { _id: false },
);

const JobSearchRoleSchema = new Schema(
  {
    label: { type: String, default: "" },
    priority: { type: Number, default: 0 },
    reason: { type: String, default: "" },
  },
  { _id: false },
);

const JobSearchProfileSchema = new Schema(
  {
    primaryRole: { type: String, default: "" },
    profileSummary: { type: String, default: "" },
    roleFamilies: { type: [JobSearchRoleSchema], default: [] },
    targetTitles: { type: [String], default: [] },
    secondaryTitles: { type: [String], default: [] },
    avoidTitles: { type: [String], default: [] },
    requiredSkills: { type: [String], default: [] },
    preferredSkills: { type: [String], default: [] },
    supportingSkills: { type: [String], default: [] },
    searchQueries: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    negativeKeywords: { type: [String], default: [] },
    source: { type: String, enum: ["ai", "heuristic"], default: "heuristic" },
    builtAt: { type: String, default: "" },
  },
  { _id: false },
);

const ParsedSchema = new Schema(
  {
    fullName: String,
    email: String,
    phone: String,
    location: String,
    headline: String,
    summary: String,
    links: { type: LinksSchema, default: () => ({}) },
    skills: { type: ParsedSkillsSchema, default: () => ({}) },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    projects: { type: [ProjectSchema], default: [] },
    certifications: { type: [Schema.Types.Mixed], default: [] },
    achievements: { type: [String], default: [] },
    awards: { type: [String], default: [] },
    publications: { type: [String], default: [] },
    languagesSpoken: { type: [String], default: [] },
    totalYearsExperience: { type: Number, default: 0 },
    inferredSeniority: { type: String, enum: ["junior", "mid", "senior", "staff"], default: "mid" },
    jobSearchProfile: { type: JobSearchProfileSchema, default: () => ({}) },
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
ResumeSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
ResumeSchema.index({ isActive: 1, deletedAt: 1, updatedAt: -1 });

export type ResumeDoc = InferSchemaType<typeof ResumeSchema>;

export const Resume =
  (mongoose.models.Resume as mongoose.Model<ResumeDoc>) ||
  mongoose.model<ResumeDoc>("Resume", ResumeSchema);
