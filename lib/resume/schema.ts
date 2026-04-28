import { z } from "zod";

const LinksSchema = z
  .object({
    website: z.string().default(""),
    linkedin: z.string().default(""),
    github: z.string().default(""),
    portfolio: z.string().default(""),
    twitter: z.string().default(""),
    other: z.array(z.string()).default([]),
  })
  .default({ website: "", linkedin: "", github: "", portfolio: "", twitter: "", other: [] });

const CertificationSchema = z.preprocess(
  (v) => (typeof v === "string" ? { name: v } : v),
  z.object({
    name: z.string().default(""),
    issuer: z.string().default(""),
    date: z.string().default(""),
    url: z.string().default(""),
  }),
);

export const JobSearchProfileSchema = z
  .object({
    primaryRole: z.string().default(""),
    profileSummary: z.string().default(""),
    roleFamilies: z
      .array(
        z.object({
          label: z.string().default(""),
          priority: z.number().min(0).max(100).default(0),
          reason: z.string().default(""),
        }),
      )
      .default([]),
    targetTitles: z.array(z.string()).default([]),
    secondaryTitles: z.array(z.string()).default([]),
    avoidTitles: z.array(z.string()).default([]),
    requiredSkills: z.array(z.string()).default([]),
    preferredSkills: z.array(z.string()).default([]),
    supportingSkills: z.array(z.string()).default([]),
    searchQueries: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    negativeKeywords: z.array(z.string()).default([]),
    source: z.enum(["ai", "heuristic"]).default("heuristic"),
    builtAt: z.string().default(""),
  })
  .default({
    primaryRole: "",
    profileSummary: "",
    roleFamilies: [],
    targetTitles: [],
    secondaryTitles: [],
    avoidTitles: [],
    requiredSkills: [],
    preferredSkills: [],
    supportingSkills: [],
    searchQueries: [],
    keywords: [],
    negativeKeywords: [],
    source: "heuristic",
    builtAt: "",
  });

export const ParsedResumeSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  headline: z.string().default(""),
  summary: z.string().default(""),
  links: LinksSchema,
  skills: z
    .object({
      languages: z.array(z.string()).default([]),
      frameworks: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
      databases: z.array(z.string()).default([]),
      cloud: z.array(z.string()).default([]),
      soft: z.array(z.string()).default([]),
    })
    .default({
      languages: [],
      frameworks: [],
      tools: [],
      databases: [],
      cloud: [],
      soft: [],
    }),
  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
        description: z.string().default(""),
        skills: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string().default(""),
        degree: z.string().default(""),
        field: z.string().default(""),
        location: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
        gpa: z.string().default(""),
        honors: z.string().default(""),
      }),
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        url: z.string().default(""),
        skills: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  certifications: z.array(CertificationSchema).default([]),
  achievements: z.array(z.string()).default([]),
  awards: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  languagesSpoken: z.array(z.string()).default([]),
  totalYearsExperience: z.number().default(0),
  inferredSeniority: z.enum(["junior", "mid", "senior", "staff"]).default("mid"),
  jobSearchProfile: JobSearchProfileSchema,
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type JobSearchProfile = z.infer<typeof JobSearchProfileSchema>;
