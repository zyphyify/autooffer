import { createClient } from "@supabase/supabase-js";
import { AnalysisResult, UserProfile, AnalysisHistoryEntry, SavedOffer } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════

export async function getProfile(deviceId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    brokerage: data.brokerage,
    phone: data.phone,
    email: data.email,
    license: data.license,
    defaults: data.defaults,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function upsertProfile(
  deviceId: string,
  profile: Partial<UserProfile>
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        device_id: deviceId,
        name: profile.name,
        brokerage: profile.brokerage,
        phone: profile.phone,
        email: profile.email,
        license: profile.license,
        defaults: profile.defaults,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Profile upsert error:", error);
    return null;
  }
  return data;
}

// ═══════════════════════════════════════════
// ANALYSIS HISTORY
// ═══════════════════════════════════════════

export async function saveAnalysis(
  deviceId: string,
  results: AnalysisResult[]
): Promise<string | null> {
  const properties = results.map((r) => r.property.fullAddress);

  // Compute aggregate stats from the best offer (Creative I) of each property
  const bestOffers = results.map((r) => r.offers[0]);
  const totalValue = results.reduce((sum, r) => sum + r.property.listPrice, 0);
  const avgCashflow =
    bestOffers.reduce((sum, o) => sum + o.metrics.monthlyCashflow, 0) / bestOffers.length;
  const avgCoc =
    bestOffers.reduce((sum, o) => sum + o.metrics.cashOnCash, 0) / bestOffers.length;
  const avgTotalReturn =
    bestOffers.reduce((sum, o) => sum + o.metrics.totalReturn, 0) / bestOffers.length;

  const { data, error } = await supabase
    .from("analysis_history")
    .insert({
      device_id: deviceId,
      properties,
      results: JSON.stringify(results),
      total_value: totalValue,
      avg_cashflow: Math.round(avgCashflow),
      avg_coc: Math.round(avgCoc * 10) / 10,
      avg_total_return: Math.round(avgTotalReturn * 10) / 10,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Save analysis error:", error);
    return null;
  }
  return data.id;
}

export async function getHistory(deviceId: string): Promise<AnalysisHistoryEntry[]> {
  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Get history error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    properties: row.properties,
    results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    total_value: row.total_value,
    avg_cashflow: row.avg_cashflow,
    avg_coc: row.avg_coc,
    avg_total_return: row.avg_total_return,
    created_at: row.created_at,
  }));
}

export async function getAnalysisById(id: string): Promise<AnalysisHistoryEntry | null> {
  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    properties: data.properties,
    results: typeof data.results === "string" ? JSON.parse(data.results) : data.results,
    total_value: data.total_value,
    avg_cashflow: data.avg_cashflow,
    avg_coc: data.avg_coc,
    avg_total_return: data.avg_total_return,
    created_at: data.created_at,
  };
}

export async function deleteAnalysis(id: string, deviceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("analysis_history")
    .delete()
    .eq("id", id)
    .eq("device_id", deviceId);

  return !error;
}

// ═══════════════════════════════════════════
// SAVED OFFERS
// ═══════════════════════════════════════════

export async function saveCustomOffer(
  deviceId: string,
  propertyAddress: string,
  offerData: any,
  notes?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("saved_offers")
    .insert({
      device_id: deviceId,
      property_address: propertyAddress,
      offer_data: offerData,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Save offer error:", error);
    return null;
  }
  return data.id;
}

export async function getSavedOffers(deviceId: string): Promise<SavedOffer[]> {
  const { data, error } = await supabase
    .from("saved_offers")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}
