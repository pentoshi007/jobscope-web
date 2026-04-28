import { describe, expect, it } from "vitest";
import { score } from "@/lib/match/score";
import { ParsedResumeSchema } from "@/lib/resume/schema";
import { buildResumeJobProfile, jobMatchesProfile } from "./profile";

describe("resume job profile matching", () => {
  it("keeps a cybersecurity resume from matching full-stack roles as primary jobs", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "Dedicated Cybersecurity Analyst",
      location: "Chicago, IL, United States",
      totalYearsExperience: 2,
      inferredSeniority: "mid",
      skills: {
        languages: ["Python", "JavaScript"],
        frameworks: ["React"],
        tools: ["Linux", "Bash", "RBAC"],
        databases: ["SQL"],
        cloud: [],
        soft: [],
      },
      experience: [
        {
          role: "Cybersecurity Analyst",
          company: "SecureCo",
          description: "Performed vulnerability assessment and incident response.",
          skills: ["cybersecurity", "incident response", "vulnerability assessment", "python"],
        },
      ],
      jobSearchProfile: {
        primaryRole: "Cybersecurity Analyst",
        profileSummary: "Cybersecurity analyst with web development as secondary background.",
        roleFamilies: [{ label: "Cybersecurity Analyst", priority: 100, reason: "Primary track" }],
        targetTitles: ["Cybersecurity Analyst", "Security Analyst", "SOC Analyst"],
        secondaryTitles: ["Full Stack Developer"],
        avoidTitles: ["Full Stack Developer", "Full Stack Web Developer", "Frontend Developer"],
        requiredSkills: ["cybersecurity", "incident response", "vulnerability assessment"],
        preferredSkills: ["python", "linux", "rbac"],
        supportingSkills: ["javascript", "react"],
        searchQueries: ["Cybersecurity Analyst", "Security Analyst", "SOC Analyst"],
        keywords: ["cybersecurity", "incident response", "vulnerability assessment"],
        negativeKeywords: ["full stack", "frontend"],
        source: "ai",
        builtAt: new Date().toISOString(),
      },
    });
    const profile = buildResumeJobProfile([resume]);

    const fullStackJob = {
      title: "Full Stack Web Developer",
      description: "Build React and Node.js applications.",
      extractedSkills: ["javascript", "react", "node.js"],
      seniority: "mid" as const,
      location: "Chicago, IL",
      remote: false,
      postedAt: new Date(),
    };
    const securityJob = {
      title: "Cybersecurity Analyst",
      description: "Monitor SIEM alerts, investigate incidents, and assess vulnerabilities.",
      extractedSkills: ["cybersecurity", "incident response", "vulnerability assessment", "python"],
      seniority: "mid" as const,
      location: "Chicago, IL",
      remote: false,
      postedAt: new Date(),
    };

    expect(jobMatchesProfile(profile, fullStackJob)).toBe(false);
    expect(score(resume, fullStackJob, { roleProfile: profile }).score).toBeLessThan(30);
    expect(jobMatchesProfile(profile, securityJob)).toBe(true);
    expect(score(resume, securityJob, { roleProfile: profile }).score).toBeGreaterThanOrEqual(80);
  });

  it("does not filter adjacent software roles from a full-stack resume", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "Full-Stack Developer",
      location: "Bengaluru, India",
      totalYearsExperience: 1,
      inferredSeniority: "junior",
      skills: {
        languages: ["JavaScript", "TypeScript"],
        frameworks: ["React", "Node.js", "Express.js"],
        tools: [],
        databases: ["MongoDB"],
        cloud: [],
        soft: [],
      },
      jobSearchProfile: {
        primaryRole: "Full-Stack Developer",
        targetTitles: ["Full-Stack Developer", "Software Engineer", "Cybersecurity Intern"],
        secondaryTitles: ["Cybersecurity Intern"],
        avoidTitles: ["Web Developer", "Frontend Developer", "Backend Developer"],
        requiredSkills: ["JavaScript", "TypeScript", "React", "Node.js"],
        preferredSkills: ["Express.js", "MongoDB"],
        supportingSkills: [],
        searchQueries: ["Full-Stack Developer", "Software Engineer"],
        keywords: [],
        negativeKeywords: [],
        source: "ai",
      },
    });

    const profile = buildResumeJobProfile([resume]);

    expect(profile.titles).toContain("full-stack developer");
    expect(profile.avoidTitles).not.toContain("frontend developer");
    expect(profile.titles).not.toContain("cybersecurity intern");
  });

  it("caps non-remote jobs in a different country and explains why", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "Data Analyst",
      location: "Mumbai, India",
      totalYearsExperience: 3,
      inferredSeniority: "mid",
      skills: {
        languages: ["Python", "SQL"],
        frameworks: [],
        tools: ["Tableau"],
        databases: [],
        cloud: [],
        soft: [],
      },
      jobSearchProfile: {
        primaryRole: "Data Analyst",
        targetTitles: ["Data Analyst"],
        requiredSkills: ["Python", "SQL"],
        preferredSkills: ["Tableau"],
        searchQueries: ["Data Analyst"],
        source: "ai",
      },
    });
    const profile = buildResumeJobProfile([resume]);
    const result = score(
      resume,
      {
        title: "Data Analyst",
        description: "Analyze dashboards with Python, SQL, and Tableau.",
        extractedSkills: ["python", "sql", "tableau"],
        seniority: "mid",
        location: "Chicago, IL",
        remote: false,
        postedAt: new Date(),
      },
      { roleProfile: profile },
    );

    expect(result.score).toBeLessThanOrEqual(62);
    expect(result.reasons[0]).toContain("Different country");
  });
});
