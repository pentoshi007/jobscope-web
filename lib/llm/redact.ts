const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const URL_RE = /https?:\/\/[^\s<>"]+/g;

export function redactPII(text: string): { text: string; restore: (s: string) => string } {
  const slots: Record<string, string> = {};
  let i = 0;
  const replace = (re: RegExp, label: string) => (m: string) => {
    const token = `[${label}_${i++}]`;
    slots[token] = m;
    return token;
  };
  const out = text
    .replace(EMAIL_RE, replace(EMAIL_RE, "EMAIL"))
    .replace(PHONE_RE, replace(PHONE_RE, "PHONE"))
    .replace(URL_RE, replace(URL_RE, "URL"));
  return {
    text: out,
    restore: (s: string) => s.replace(/\[(EMAIL|PHONE|URL)_\d+\]/g, (m) => slots[m] ?? m),
  };
}
