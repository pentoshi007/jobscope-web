import { describe, expect, it } from "vitest";
import { score } from "@/lib/match/score";
import { ParsedResumeSchema } from "@/lib/resume/schema";
import { buildResumeJobProfile, jobMatchesProfile } from "./profile";

describe("resume job profile matching", () => {
  it("falls back to a default profile when parsed resume data is missing", () => {
    const profile = buildResumeJobProfile([undefined]);

    expect(profile.primaryTitle).toBe("general");
    expect(() =>
      score(undefined, {
        title: "Software Engineer",
        description: "Build product features.",
        extractedSkills: [],
        seniority: "mid",
        location: "Remote",
        remote: true,
        postedAt: new Date(),
      }),
    ).not.toThrow();
  });

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

  it("allows evidenced secondary software roles but ranks the primary role higher", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "Full Stack MERN Developer",
      location: "Bengaluru, India",
      totalYearsExperience: 2,
      inferredSeniority: "mid",
      skills: {
        languages: ["JavaScript", "TypeScript"],
        frameworks: ["React", "Node.js", "Express.js"],
        tools: [],
        databases: ["MongoDB"],
        cloud: [],
        soft: [],
      },
      jobSearchProfile: {
        primaryRole: "Full Stack Developer",
        targetTitles: ["Full Stack Developer", "MERN Stack Developer"],
        secondaryTitles: ["React Developer", "Node.js Developer"],
        requiredSkills: ["JavaScript", "TypeScript", "React", "Node.js"],
        preferredSkills: ["Express.js", "MongoDB"],
        supportingSkills: [],
        searchQueries: ["Full Stack Developer", "React Developer", "Node.js Developer"],
        source: "ai",
      },
    });
    const profile = buildResumeJobProfile([resume]);
    const fullStackJob = {
      title: "Full Stack Developer",
      description: "Build React and Node.js applications with MongoDB.",
      extractedSkills: ["javascript", "typescript", "react", "node.js", "mongodb"],
      seniority: "mid" as const,
      location: "Bengaluru, India",
      remote: false,
      postedAt: new Date(),
    };
    const reactJob = {
      title: "React Developer",
      description: "Build TypeScript React interfaces and consume Node.js APIs.",
      extractedSkills: ["typescript", "react", "javascript"],
      seniority: "mid" as const,
      location: "Bengaluru, India",
      remote: false,
      postedAt: new Date(),
    };

    expect(jobMatchesProfile(profile, reactJob)).toBe(true);
    expect(score(resume, reactJob, { roleProfile: profile }).score).toBeLessThan(
      score(resume, fullStackJob, { roleProfile: profile }).score,
    );
  });

  it("allows evidenced secondary cybersecurity tracks at a lower score", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "SOC Analyst L1",
      location: "Chicago, IL, United States",
      totalYearsExperience: 2,
      inferredSeniority: "mid",
      skills: {
        languages: ["Python"],
        frameworks: [],
        tools: ["Splunk", "Burp Suite", "Nmap"],
        databases: [],
        cloud: [],
        soft: [],
      },
      experience: [
        {
          role: "SOC Analyst L1",
          company: "SecureCo",
          description: "Monitored SIEM alerts and performed vulnerability assessment.",
          skills: ["soc monitoring", "incident response", "vulnerability assessment"],
        },
      ],
      projects: [
        {
          name: "Penetration testing lab",
          description: "Practiced web application penetration testing with Burp Suite and Nmap.",
          skills: ["penetration testing", "burp suite", "nmap"],
        },
      ],
      jobSearchProfile: {
        primaryRole: "SOC Analyst",
        targetTitles: ["SOC Analyst", "Security Analyst"],
        secondaryTitles: ["Penetration Tester", "Vulnerability Assessment Analyst"],
        requiredSkills: ["siem", "incident response", "soc monitoring"],
        preferredSkills: ["vulnerability assessment", "python"],
        supportingSkills: ["penetration testing", "burp suite", "nmap"],
        searchQueries: ["SOC Analyst", "Penetration Tester"],
        source: "ai",
      },
    });
    const profile = buildResumeJobProfile([resume]);
    const socJob = {
      title: "SOC Analyst",
      description: "Monitor SIEM alerts and respond to incidents.",
      extractedSkills: ["siem", "incident response", "soc monitoring"],
      seniority: "mid" as const,
      location: "Chicago, IL",
      remote: false,
      postedAt: new Date(),
    };
    const pentestJob = {
      title: "Penetration Tester",
      description: "Test web applications with Burp Suite, Nmap, and vulnerability assessment.",
      extractedSkills: ["penetration testing", "burp suite", "nmap"],
      seniority: "mid" as const,
      location: "Chicago, IL",
      remote: false,
      postedAt: new Date(),
    };

    expect(jobMatchesProfile(profile, pentestJob)).toBe(true);
    expect(score(resume, pentestJob, { roleProfile: profile }).score).toBeLessThan(
      score(resume, socJob, { roleProfile: profile }).score,
    );
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
    expect(result.breakdown.location).toBe(0);
    expect(result.reasons[0]).toContain("Different country");
  });

  it("gives zero location points to non-remote country mismatches even if preferred", () => {
    const resume = ParsedResumeSchema.parse({
      headline: "Data Analyst",
      location: "Mumbai, India",
      inferredSeniority: "mid",
      skills: {
        languages: ["Python"],
        frameworks: [],
        tools: [],
        databases: [],
        cloud: [],
        soft: [],
      },
    });

    const result = score(
      resume,
      {
        title: "Data Analyst",
        description: "Analyze business data with Python.",
        extractedSkills: ["python"],
        seniority: "mid",
        location: "Chicago, IL, United States",
        remote: false,
        postedAt: new Date(),
      },
      { preferredLocations: ["Chicago"] },
    );

    expect(result.breakdown.location).toBe(0);
  });
});
