import { Property } from "./types";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = "zillow-scraper-api.p.rapidapi.com";

/**
 * Extract ZPID from a Zillow URL
 */
export function extractZpid(url: string): string | null {
  const match = url.match(/\/(\d+)_zpid/);
  return match ? match[1] : null;
}

/**
 * Deep search for a value in a nested object by key name.
 * Returns the first truthy match found.
 */
function deepFind(obj: any, targetKey: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (obj[targetKey] !== undefined && obj[targetKey] !== null && obj[targetKey] !== "") {
    return obj[targetKey];
  }
  for (const key of Object.keys(obj)) {
    const result = deepFind(obj[key], targetKey);
    if (result !== undefined && result !== null && result !== "") return result;
  }
  return undefined;
}

/**
 * Extract a number from various possible formats
 */
function extractNumber(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Fetch property details from Zillow via RapidAPI.
 * Extremely defensive parsing - searches the entire response
 * for the fields we need regardless of nesting structure.
 */
export async function scrapeProperty(url: string): Promise<{ property: Property; rawDebug: string }> {
  const zpid = extractZpid(url);
  if (!zpid) {
    throw new Error(`Could not extract ZPID from URL: ${url}`);
  }

  if (!RAPIDAPI_KEY) {
    throw new Error("RAPIDAPI_KEY environment variable is not set");
  }

  const apiUrl = `https://${RAPIDAPI_HOST}/zillow/property/${zpid}`;

  console.log(`[Zillow] Fetching: ${apiUrl}`);

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Zillow] API error ${response.status}:`, errorText);
    throw new Error(`Zillow API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const raw = await response.json();

  // Log first 500 chars to help debug response format
  const rawStr = JSON.stringify(raw);
  console.log(`[Zillow] Response keys:`, Object.keys(raw));
  console.log(`[Zillow] Response preview:`, rawStr.slice(0, 500));

  // Defensive extraction - try multiple possible field names
  const price =
    extractNumber(deepFind(raw, "price")) ||
    extractNumber(deepFind(raw, "listPrice")) ||
    extractNumber(deepFind(raw, "list_price")) ||
    extractNumber(deepFind(raw, "zestimate")) ||
    extractNumber(deepFind(raw, "taxAssessedValue"));

  if (!price || price === 0) {
    throw new Error(
      `No price found for ZPID ${zpid}. API response keys: ${Object.keys(raw).join(", ")}. ` +
      `First 300 chars: ${rawStr.slice(0, 300)}`
    );
  }

  // Address extraction
  const addressObj = raw.address || raw.data?.address || raw.property?.address || {};
  const streetAddress =
    deepFind(raw, "streetAddress") ||
    deepFind(raw, "street") ||
    deepFind(raw, "address_line1") ||
    addressObj.streetAddress ||
    "";
  const city =
    deepFind(raw, "city") ||
    addressObj.city ||
    "";
  const state =
    deepFind(raw, "state") ||
    addressObj.state ||
    "";
  const zipcode =
    deepFind(raw, "zipcode") ||
    deepFind(raw, "zip") ||
    addressObj.zipcode ||
    addressObj.zip ||
    "";

  const property: Property = {
    zpid,
    address: streetAddress,
    city,
    state,
    zip: zipcode,
    fullAddress: [streetAddress, city, state, zipcode].filter(Boolean).join(", "),
    listPrice: price,
    zestimate: extractNumber(deepFind(raw, "zestimate")) || undefined,
    beds: extractNumber(deepFind(raw, "bedrooms")) || extractNumber(deepFind(raw, "beds")) || 0,
    baths: extractNumber(deepFind(raw, "bathrooms")) || extractNumber(deepFind(raw, "baths")) || 0,
    sqft: extractNumber(deepFind(raw, "livingArea")) || extractNumber(deepFind(raw, "sqft")) || extractNumber(deepFind(raw, "livingAreaSqFt")) || 0,
    yearBuilt: extractNumber(deepFind(raw, "yearBuilt")) || extractNumber(deepFind(raw, "year_built")) || 0,
    lotSize: extractNumber(deepFind(raw, "lotSize")) || extractNumber(deepFind(raw, "lotAreaValue")) || undefined,
    annualTax: extractNumber(deepFind(raw, "taxAnnualAmount")) || extractNumber(deepFind(raw, "annualPropertyTax")) || extractNumber(deepFind(raw, "propertyTax")) || undefined,
    monthlyHoa: extractNumber(deepFind(raw, "monthlyHoaFee")) || extractNumber(deepFind(raw, "hoaFee")) || undefined,
    homeType: deepFind(raw, "homeType") || deepFind(raw, "propertyType") || undefined,
    url,
  };

  console.log(`[Zillow] Parsed property:`, {
    address: property.fullAddress,
    price: property.listPrice,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
  });

  return { property, rawDebug: rawStr.slice(0, 1000) };
}
