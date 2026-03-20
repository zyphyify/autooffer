import { NextRequest, NextResponse } from "next/server";
import { scrapeProperty } from "@/lib/zillow";
import { generateOffers } from "@/lib/calculator";
import { saveAnalysis } from "@/lib/supabase";
import { DEFAULT_ESTIMATES, EstimateDefaults, AnalysisResult } from "@/lib/types";

export const maxDuration = 30; // Allow up to 30s for API calls

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, defaults: customDefaults, deviceId } = body;

    console.log("[Scrape] Request received:", { urls, deviceId: deviceId?.slice(0, 10) });

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "At least one Zillow URL is required" }, { status: 400 });
    }

    if (urls.length > 10) {
      return NextResponse.json({ error: "Maximum 10 URLs per analysis" }, { status: 400 });
    }

    const defaults: EstimateDefaults = { ...DEFAULT_ESTIMATES, ...(customDefaults || {}) };

    const results: AnalysisResult[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const url of urls) {
      try {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;

        if (!trimmedUrl.includes("zillow.com")) {
          errors.push({ url: trimmedUrl, error: "Not a valid Zillow URL" });
          continue;
        }

        console.log("[Scrape] Processing:", trimmedUrl);

        // Scrape property data
        const { property } = await scrapeProperty(trimmedUrl);

        console.log("[Scrape] Property scraped:", property.fullAddress, "Price:", property.listPrice);

        // Generate all 4 offers
        const analysis = generateOffers(property, defaults);

        console.log("[Scrape] Offers generated:", analysis.offers.map(o => o.tab).join(", "));

        results.push(analysis);
      } catch (err: any) {
        console.error("[Scrape] Error for URL:", url, err.message);
        errors.push({
          url,
          error: err.message || "Failed to scrape property",
        });
      }
    }

    // Try to save to history (don't block on failure)
    let historyId: string | null = null;
    if (deviceId && results.length > 0) {
      try {
        historyId = await saveAnalysis(deviceId, results);
        console.log("[Scrape] Saved to history:", historyId);
      } catch (saveErr: any) {
        console.error("[Scrape] History save failed (non-blocking):", saveErr.message);
      }
    }

    console.log("[Scrape] Done. Results:", results.length, "Errors:", errors.length);

    return NextResponse.json({
      results,
      errors,
      historyId: historyId || undefined,
    });
  } catch (err: any) {
    console.error("[Scrape] Fatal error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error", stack: err.stack?.slice(0, 500) },
      { status: 500 }
    );
  }
}
