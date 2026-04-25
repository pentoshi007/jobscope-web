type S = "junior" | "mid" | "senior" | "staff" | "unknown";

const ORDER: Record<S, number> = { unknown: 2, junior: 0, mid: 1, senior: 2, staff: 3 };

export function isAdjacent(a: S, b: S): boolean {
  if (a === "unknown" || b === "unknown") return true;
  return Math.abs(ORDER[a] - ORDER[b]) === 1;
}
