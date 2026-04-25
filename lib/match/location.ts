export function locationsMatch(
  resumeLoc: string,
  jobLoc: string,
  preferred: string[] = [],
): boolean {
  if (!jobLoc) return true;
  const r = resumeLoc.toLowerCase();
  const j = jobLoc.toLowerCase();
  if (r && j.includes(r.split(",")[0].trim())) return true;
  for (const p of preferred) {
    if (j.includes(p.toLowerCase())) return true;
  }
  return false;
}
