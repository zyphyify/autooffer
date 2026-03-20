// ═══════════════════════════════════════════
// Zillow API Response Types
// ═══════════════════════════════════════════

export interface ZillowPropertyData {
  zpid: string;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zipcode: string;
  };
  price: number;
  zestimate?: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number; // sqft
  yearBuilt: number;
  lotSize?: number;
  propertyTaxRate?: number;
  annualPropertyTax?: number;
  monthlyHoaFee?: number;
  homeType?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
}

// ═══════════════════════════════════════════
// Application Domain Types
// ═══════════════════════════════════════════

export interface Property {
  zpid: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  listPrice: number;
  zestimate?: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSize?: number;
  annualTax?: number;
  monthlyHoa?: number;
  homeType?: string;
  url: string;
}

export interface EstimateDefaults {
  taxRate: number;       // e.g. 1.2 (percent)
  rentRate: number;      // e.g. 1.0 (percent of price = monthly rent)
  insuranceRate: number; // e.g. 0.35 (percent)
  vacancyRate: number;   // e.g. 5.0 (percent)
  maintenanceRate: number; // e.g. 5.0 (percent of gross rent)
  managementRate: number;  // e.g. 5.0 (percent of gross rent)
  closingCostRate: number; // e.g. 3.0 (percent of purchase price)
  reserveMonths: number;   // e.g. 6 months of expenses
}

export const DEFAULT_ESTIMATES: EstimateDefaults = {
  taxRate: 1.2,
  rentRate: 1.0,
  insuranceRate: 0.35,
  vacancyRate: 5.0,
  maintenanceRate: 5.0,
  managementRate: 5.0,
  closingCostRate: 3.0,
  reserveMonths: 6,
};

// ═══════════════════════════════════════════
// Calculation Types
// ═══════════════════════════════════════════

export interface OfferTerms {
  type: "creative" | "conventional";
  label: string;
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  balloonYear?: number; // if set, balloon payment due at this year
  priceAdjustment?: number; // percent adjustment from list (e.g. -10)
}

export interface OperatingNumbers {
  monthlyRent: number;
  annualRent: number;
  annualTax: number;
  annualInsurance: number;
  annualVacancy: number;
  annualMaintenance: number;
  annualManagement: number;
  totalAnnualExpenses: number;
  operatingExpenseRatio: number; // percent
  noi: number; // annual NOI
  monthlyNoi: number;
}

export interface OfferMetrics {
  cashNeeded: number;
  monthlyCashflow: number;
  capRate: number;
  cashOnCash: number;
  totalReturn: number;
  dscr: number;
  grm: number;
}

export interface OfferDetails {
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  ltv: number;
  operatingExpenseRatio: number;
  balloonAmount?: number;
  balloonYear?: number;
  priceAdjustment?: string;
}

export interface PostBalloonMetrics {
  monthlyCashflow: number;
  cashOnCash: number;
  totalReturn: number;
}

export interface CriteriaResult {
  passed: boolean;
  warnings: string[];
}

export interface Offer {
  tab: string;
  label: string;
  type: "creative" | "conventional";
  terms: OfferTerms;
  metrics: OfferMetrics;
  details: OfferDetails;
  criteria: CriteriaResult;
  postBalloon?: PostBalloonMetrics;
  score: number;
}

export interface AnalysisResult {
  property: Property;
  operating: OperatingNumbers;
  offers: Offer[];
  analyzedAt: string;
}

// ═══════════════════════════════════════════
// Database / Persistence Types
// ═══════════════════════════════════════════

export interface UserProfile {
  id?: string;
  name: string;
  brokerage: string;
  phone: string;
  email: string;
  license: string;
  defaults: EstimateDefaults;
  created_at?: string;
  updated_at?: string;
}

export interface AnalysisHistoryEntry {
  id: string;
  properties: string[]; // addresses
  results: AnalysisResult[];
  total_value: number;
  avg_cashflow: number;
  avg_coc: number;
  avg_total_return: number;
  created_at: string;
}

export interface SavedOffer {
  id: string;
  property_address: string;
  offer_data: Offer;
  notes?: string;
  created_at: string;
}

// ═══════════════════════════════════════════
// API Request/Response Types
// ═══════════════════════════════════════════

export interface ScrapeRequest {
  urls: string[];
  defaults?: Partial<EstimateDefaults>;
}

export interface ScrapeResponse {
  results: AnalysisResult[];
  errors: { url: string; error: string }[];
}

export interface BuilderRequest {
  zpid: string;
  offerType: "creative" | "conventional";
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  balloonYear?: number;
  purchasePrice: number;
  rentOverride?: number;
  defaults?: Partial<EstimateDefaults>;
}
