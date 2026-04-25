import { connectMongoose } from "@/lib/db";
import { Job } from "@/models/job";
import { Resume } from "@/models/resume";
import { redactPII } from "@/lib/llm/redact";

export async function loadJobAndResume(userId: string, jobId: string) {
  await connectMongoose();
  const [job, resume] = await Promise.all([
    Job.findById(jobId).lean(),
    Resume.findOne({ userId, isActive: true, deletedAt: null }).lean(),
  ]);
  if (!job || !resume) return null;

  const summary = [
    `Name: ${resume.parsed?.fullName ?? ""}`,
    `Seniority: ${resume.parsed?.inferredSeniority ?? "mid"}`,
    `Years: ${resume.parsed?.totalYearsExperience ?? 0}`,
    `Location: ${resume.parsed?.location ?? ""}`,
    `Summary: ${resume.parsed?.summary ?? ""}`,
    `Skills: ${[
      ...(resume.parsed?.skills?.languages ?? []),
      ...(resume.parsed?.skills?.frameworks ?? []),
      ...(resume.parsed?.skills?.databases ?? []),
      ...(resume.parsed?.skills?.cloud ?? []),
      ...(resume.parsed?.skills?.tools ?? []),
    ].join(", ")}`,
    `Recent experience: ${(resume.parsed?.experience ?? [])
      .slice(0, 3)
      .map((e) => `${e.role} @ ${e.company} (${e.startDate}-${e.endDate})`)
      .join(" | ")}`,
  ].join("\n");

  const { text: redactedResume } = redactPII(summary);

  const jobBlock = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location} ${job.remote ? "(Remote)" : ""}`,
    `Seniority: ${job.seniority}`,
    `Skills: ${(job.extractedSkills ?? []).join(", ")}`,
    `Description:\n${(job.description ?? "").slice(0, 3500)}`,
  ].join("\n");

  return { job, resume, redactedResume, jobBlock };
}
