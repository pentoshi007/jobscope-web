import { z } from "zod";

export const ParsedResumeSchema = z.object({
  fullName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  summary: z.string().default(""),
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
        startDate: z.string().default(""),
        endDate: z.string().default(""),
      }),
    )
    .default([]),
  certifications: z.array(z.string()).default([]),
  totalYearsExperience: z.number().default(0),
  inferredSeniority: z.enum(["junior", "mid", "senior", "staff"]).default("mid"),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
