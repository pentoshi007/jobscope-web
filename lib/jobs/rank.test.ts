import { describe, expect, it } from "vitest";
import { ParsedResumeSchema } from "@/lib/resume/schema";
import { rankJobsForUser } from "./rank";

const resume = ParsedResumeSchema.parse({
  headline: "Full Stack Developer",
  location: "Bengaluru, India",
  totalYearsExperience: 2,
  inferredSeniority: "mid",
  skills: {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["React", "Node.js"],
    tools: [],
    databases: ["MongoDB"],
    cloud: [],
    soft: [],
  },
  jobSearchProfile: {
    primaryRole: "Full Stack Developer",
    targetTitles: ["Full Stack Developer", "Software Engineer"],
    requiredSkills: ["javascript", "typescript", "react", "node.js"],
    preferredSkills: ["mongodb"],
    searchQueries: ["Full Stack Developer"],
    source: "ai",
  },
});

function job(id: string, location: string, remote: boolean) {
  return {
    id,
    title: "Full Stack Developer",
    description: "Build React and Node.js applications with TypeScript and MongoDB.",
    extractedSkills: ["javascript", "typescript", "react", "node.js"],
    seniority: "mid" as const,
    location,
    remote,
    postedAt: new Date(),
    sourceQuality: 70,
  };
}

describe("rankJobsForUser", () => {
  it("scores jobs when an active resume is missing parsed data", () => {
    const ranked = rankJobsForUser([undefined], [job("missing-parsed", "Remote", true)], {
      limit: 1,
      minScore: 0,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].m.score).toBeGreaterThanOrEqual(0);
  });

  it("prioritizes target-country jobs while preserving remote and global buckets", () => {
    const jobs = [
      ...Array.from({ length: 30 }, (_, i) => job(`tr-${i}`, "Remote, India", true)),
      ...Array.from({ length: 30 }, (_, i) => job(`to-${i}`, "Bengaluru, India", false)),
      ...Array.from({ length: 30 }, (_, i) => job(`or-${i}`, "Remote, United States", true)),
      ...Array.from({ length: 10 }, (_, i) => job(`oo-${i}`, "London, United Kingdom", false)),
    ];

    const ranked = rankJobsForUser([resume], jobs, { limit: 20, minScore: 30 });
    const counts = ranked.reduce<Record<string, number>>((acc, item) => {
      acc[item.bucket] = (acc[item.bucket] ?? 0) + 1;
      return acc;
    }, {});

    expect(ranked).toHaveLength(20);
    expect((counts.targetRemote ?? 0) + (counts.targetOnsite ?? 0)).toBe(13);
    expect(counts.otherRemote).toBe(6);
    expect(counts.otherOnsite).toBe(1);
  });

  it("does not backfill other-country jobs beyond quota when target-country jobs exist", () => {
    const jobs = [
      ...Array.from({ length: 2 }, (_, i) => job(`tr-${i}`, "Remote, India", true)),
      ...Array.from({ length: 30 }, (_, i) => job(`or-${i}`, "Remote, United States", true)),
      ...Array.from({ length: 30 }, (_, i) => job(`oo-${i}`, "London, United Kingdom", false)),
    ];

    const ranked = rankJobsForUser([resume], jobs, { limit: 20, minScore: 30 });
    const otherCountryCount = ranked.filter((item) => item.bucket.startsWith("other")).length;

    expect(ranked.some((item) => item.bucket.startsWith("target"))).toBe(true);
    expect(otherCountryCount).toBeLessThanOrEqual(7);
  });
});
