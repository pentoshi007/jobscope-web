export interface LocationAnalysis {
  resumeCountry: string;
  jobCountry: string;
  countryMismatch: boolean;
  matched: boolean;
  reason: string;
}

const COUNTRY_ALIASES: Array<[string, RegExp]> = [
  ["United States", /\b(united states|usa|u\.s\.a\.|u\.s\.|us|america)\b/i],
  ["India", /\b(india|bharat)\b/i],
  ["United Kingdom", /\b(united kingdom|uk|u\.k\.|great britain|england|scotland|wales)\b/i],
  ["Canada", /\bcanada\b/i],
  ["Australia", /\baustralia\b/i],
  ["Germany", /\bgermany\b/i],
  ["France", /\bfrance\b/i],
  ["Netherlands", /\bnetherlands\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["United Arab Emirates", /\b(uae|united arab emirates|dubai|abu dhabi)\b/i],
  ["Ireland", /\bireland\b/i],
  ["Spain", /\bspain\b/i],
  ["Italy", /\bitaly\b/i],
  ["Brazil", /\bbrazil\b/i],
  ["Mexico", /\bmexico\b/i],
  ["Japan", /\bjapan\b/i],
];

const US_STATE_CODES = new Set([
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "ia",
  "id",
  "il",
  "in",
  "ks",
  "ky",
  "la",
  "ma",
  "md",
  "me",
  "mi",
  "mn",
  "mo",
  "ms",
  "mt",
  "nc",
  "nd",
  "ne",
  "nh",
  "nj",
  "nm",
  "nv",
  "ny",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "va",
  "vt",
  "wa",
  "wi",
  "wv",
  "wy",
  "dc",
]);

const CITY_COUNTRIES: Array<[string, RegExp]> = [
  [
    "United States",
    /\b(new york|san francisco|chicago|seattle|austin|boston|los angeles|phoenix|dallas|denver|atlanta|miami|washington dc)\b/i,
  ],
  [
    "India",
    /\b(bengaluru|bangalore|mumbai|delhi|new delhi|hyderabad|pune|chennai|gurugram|gurgaon|noida|kolkata|ahmedabad)\b/i,
  ],
  ["United Kingdom", /\b(london|manchester|edinburgh|birmingham|bristol|glasgow)\b/i],
  ["Canada", /\b(toronto|vancouver|montreal|ottawa|calgary)\b/i],
  ["Australia", /\b(sydney|melbourne|brisbane|perth|adelaide)\b/i],
  ["Germany", /\b(berlin|munich|hamburg|frankfurt)\b/i],
];

export function locationsMatch(
  resumeLoc: string,
  jobLoc: string,
  preferred: string[] = [],
): boolean {
  return analyzeLocation(resumeLoc, jobLoc, false, preferred).matched;
}

export function analyzeLocation(
  resumeLoc: string,
  jobLoc: string,
  remote: boolean,
  preferred: string[] = [],
): LocationAnalysis {
  const resumeCountry = inferCountry(resumeLoc);
  const jobCountry = inferCountry(jobLoc);

  if (remote) {
    return {
      resumeCountry,
      jobCountry,
      countryMismatch: false,
      matched: true,
      reason: "Remote role; country mismatch ignored.",
    };
  }

  if (!jobLoc) {
    return {
      resumeCountry,
      jobCountry,
      countryMismatch: false,
      matched: true,
      reason: "Job location not specified.",
    };
  }

  for (const p of preferred) {
    if (p && normalize(jobLoc).includes(normalize(p))) {
      return {
        resumeCountry,
        jobCountry,
        countryMismatch: false,
        matched: true,
        reason: "Matches a preferred location.",
      };
    }
  }

  if (resumeCountry && jobCountry && resumeCountry !== jobCountry) {
    return {
      resumeCountry,
      jobCountry,
      countryMismatch: true,
      matched: false,
      reason: `Different country: resume is ${resumeCountry}, job is ${jobCountry}.`,
    };
  }

  const resumeBase = normalize(resumeLoc).split(",")[0]?.trim();
  const job = normalize(jobLoc);
  if (resumeBase && job.includes(resumeBase)) {
    return {
      resumeCountry,
      jobCountry,
      countryMismatch: false,
      matched: true,
      reason: "Matches resume location.",
    };
  }

  return {
    resumeCountry,
    jobCountry,
    countryMismatch: false,
    matched: Boolean(resumeCountry && jobCountry && resumeCountry === jobCountry),
    reason:
      resumeCountry && jobCountry && resumeCountry === jobCountry
        ? `Same country: ${resumeCountry}.`
        : "Could not confidently compare countries.",
  };
}

export function inferCountry(location: string) {
  const loc = normalize(location);
  if (!loc) return "";

  for (const [country, re] of COUNTRY_ALIASES) {
    if (re.test(loc)) return country;
  }

  const stateMatch = loc.match(/(?:^|,\s*|\s)([a-z]{2})(?:\s|$)/i);
  if (stateMatch?.[1] && US_STATE_CODES.has(stateMatch[1].toLowerCase())) {
    return "United States";
  }

  for (const [country, re] of CITY_COUNTRIES) {
    if (re.test(loc)) return country;
  }

  return "";
}

export function hasCountrySignal(location: string) {
  return Boolean(inferCountry(location));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}
