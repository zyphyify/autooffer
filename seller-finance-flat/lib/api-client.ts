import { getDeviceId } from "./device";
import { AnalysisResult, UserProfile, AnalysisHistoryEntry, EstimateDefaults } from "./types";

const headers = () => ({
  "Content-Type": "application/json",
  "x-device-id": getDeviceId(),
});

// ═══════════════════════════════════════════
// SCRAPE & ANALYZE
// ═══════════════════════════════════════════

export interface ScrapeApiResponse {
  results: AnalysisResult[];
  errors: { url: string; error: string }[];
  historyId?: string;
}

export async function analyzeUrls(
  urls: string[],
  defaults?: Partial<EstimateDefaults>
): Promise<ScrapeApiResponse> {
  const res = await fetch("/api/scrape", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      urls,
      defaults,
      deviceId: getDeviceId(),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Analysis failed");
  }

  return res.json();
}

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════

export async function fetchProfile(): Promise<UserProfile | null> {
  const res = await fetch("/api/profile", { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.profile;
}

export async function saveProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(profile),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.profile;
}

// ═══════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════

export async function fetchHistory(): Promise<AnalysisHistoryEntry[]> {
  const res = await fetch("/api/history", { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.history || [];
}

export async function fetchAnalysisById(id: string): Promise<AnalysisHistoryEntry | null> {
  const res = await fetch(`/api/history?id=${id}`, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.analysis;
}

export async function deleteHistoryEntry(id: string): Promise<boolean> {
  const res = await fetch("/api/history", {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ id }),
  });

  return res.ok;
}
