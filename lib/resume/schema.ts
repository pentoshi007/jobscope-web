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
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
