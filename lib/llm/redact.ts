const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
// Match phone numbers: must start with + or digit, contain at least 9 digit-like chars,
// and look like a phone number (not a year like 2024 or a GPA like 8.7/10).
const PHONE_RE = /(?<!\d)(\+?\d[\d\s().-]{8,}\d)(?!\d)/g;

export type RedactOptions = { keepUrls?: boolean };

export function redactPII(
  text: string,
  options: RedactOptions = {},
): { text: string; restore: (s: string) => string } {
  const slots: Record<string, string> = {};
  let i = 0;
  const replace = (label: string) => (m: string) => {
    // Skip matches that are just years or short numbers
    const digitsOnly = m.replace(/\D/g, "");
    if (digitsOnly.length < 7) return m;
    const token = `[${label}_${i++}]`;
    slots[token] = m;
    return token;
  };
  let out = text.replace(EMAIL_RE, replace("EMAIL")).replace(PHONE_RE, replace("PHONE"));
  if (!options.keepUrls) {
    out = out.replace(/https?:\/\/[^\s<>"]+/g, replace("URL"));
  }
  return {
    text: out,
    // Restore any token that exists in our slots map
    restore: (s: string) => s.replace(/\[(EMAIL|PHONE|URL)_\d+\]/g, (m) => slots[m] ?? m),
  };
}
