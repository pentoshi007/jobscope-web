export interface UserPreferences {
  preferredLocations: string[];
  remoteOnly: boolean;
  minMatchScore: number;
  alerts: { dailyDigest: boolean };
}

export const DEFAULT_PREFS: UserPreferences = {
  preferredLocations: [],
  remoteOnly: false,
  minMatchScore: 60,
  alerts: { dailyDigest: true },
};

export function parsePrefs(raw: string | null | undefined): UserPreferences {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}
