import {
  Property,
  EstimateDefaults,
  DEFAULT_ESTIMATES,
  OfferTerms,
  OperatingNumbers,
  OfferMetrics,
  OfferDetails,
  PostBalloonMetrics,
  CriteriaResult,
  Offer,
  AnalysisResult,
} from "./types";

// ═══════════════════════════════════════════
// CORE MORTGAGE MATH
// ═══════════════════════════════════════════

/**
 * Standard monthly mortgage payment (P&I)
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Where P = principal, r = monthly rate, n = total months
 *
 * Special case: if rate is 0%, payment = principal / months (principal-only)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  const n = termYears * 12;
  if (annualRate === 0) {
    return principal / n;
  }
  const r = annualRate / 100 / 12;
  const factor = Math.pow(1 + r, n);
  return principal * (r * factor) / (factor - 1);
}

/**
 * Remaining loan balance after a given number of payments
 * Used for balloon payment calculation
 * B = P * [(1+r)^n - (1+r)^p] / [(1+r)^n - 1]
 */
export function calculateRemainingBalance(
  principal: number,
  annualRate: number,
  termYears: number,
  paymentsMade: number
): number {
  if (annualRate === 0) {
    const monthlyPayment = principal / (termYears * 12);
    return principal - monthlyPayment * paymentsMade;
  }
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const factor_n = Math.pow(1 + r, n);
  const factor_p = Math.pow(1 + r, paymentsMade);
  return principal * (factor_n - factor_p) / (factor_n - 1);
}

// ═══════════════════════════════════════════
// OPERATING NUMBERS
// ═══════════════════════════════════════════

/**
 * Calculate all operating income/expense numbers for a property.
 * Uses scraped data where available, falls back to estimate defaults.
 */
export function calculateOperatingNumbers(
  property: Property,
  purchasePrice: number,
  defaults: EstimateDefaults,
  rentOverride?: number
): OperatingNumbers {
  // Monthly rent: use override, or estimate at rentRate% of list price
  const monthlyRent = rentOverride || (property.listPrice * defaults.rentRate) / 100;
  const annualRent = monthlyRent * 12;

  // Taxes: use scraped annual tax if available, otherwise estimate
  const annualTax = property.annualTax || (purchasePrice * defaults.taxRate) / 100;

  // Insurance: always estimate (rarely scraped)
  const annualInsurance = (purchasePrice * defaults.insuranceRate) / 100;

  // Vacancy, maintenance, management as % of gross rent
  const annualVacancy = annualRent * (defaults.vacancyRate / 100);
  const annualMaintenance = annualRent * (defaults.maintenanceRate / 100);
  const annualManagement = annualRent * (defaults.managementRate / 100);

  // HOA if present
  const annualHoa = (property.monthlyHoa || 0) * 12;

  const totalAnnualExpenses =
    annualTax + annualInsurance + annualVacancy + annualMaintenance + annualManagement + annualHoa;

  const operatingExpenseRatio = (totalAnnualExpenses / annualRent) * 100;
  const noi = annualRent - totalAnnualExpenses;

  return {
    monthlyRent,
    annualRent,
    annualTax,
    annualInsurance,
    annualVacancy,
    annualMaintenance,
    annualManagement,
    totalAnnualExpenses,
    operatingExpenseRatio: Math.round(operatingExpenseRatio * 10) / 10,
    noi,
    monthlyNoi: noi / 12,
  };
}

// ═══════════════════════════════════════════
// OFFER METRICS
// ═══════════════════════════════════════════

function calculateOfferMetrics(
  operating: OperatingNumbers,
  details: OfferDetails,
  cashNeeded: number
): OfferMetrics {
  const monthlyCashflow = operating.monthlyNoi - details.monthlyPayment;
  const annualCashflow = monthlyCashflow * 12;

  const capRate = (operating.noi / details.purchasePrice) * 100;
  const cashOnCash = cashNeeded > 0 ? (annualCashflow / cashNeeded) * 100 : 0;

  // Total return includes principal paydown over first year
  // For simplicity: annual mortgage payment minus interest portion = principal paydown
  const annualPayment = details.monthlyPayment * 12;
  let firstYearInterest = 0;
  if (details.interestRate > 0) {
    firstYearInterest = details.loanAmount * (details.interestRate / 100);
  }
  const firstYearPrincipalPaydown = annualPayment - firstYearInterest;
  const totalReturn =
    cashNeeded > 0
      ? ((annualCashflow + firstYearPrincipalPaydown) / cashNeeded) * 100
      : 0;

  const dscr = details.monthlyPayment > 0 ? operating.monthlyNoi / details.monthlyPayment : 999;

  const grm = operating.annualRent > 0 ? details.purchasePrice / operating.annualRent : 0;

  return {
    cashNeeded,
    monthlyCashflow: Math.round(monthlyCashflow * 100) / 100,
    capRate: Math.round(capRate * 10) / 10,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    totalReturn: Math.round(totalReturn * 10) / 10,
    dscr: Math.round(dscr * 100) / 100,
    grm: Math.round(grm * 10) / 10,
  };
}

// ═══════════════════════════════════════════
// CRITERIA CHECK
// ═══════════════════════════════════════════

function checkCriteria(metrics: OfferMetrics, details: OfferDetails): CriteriaResult {
  const warnings: string[] = [];
  let passed = true;

  if (metrics.dscr < 1.25) {
    warnings.push("DSCR below 1.25 — most lenders would not finance this");
    passed = false;
  }

  if (details.ltv > 90) {
    warnings.push("High leverage (LTV >90%) — minimal equity cushion");
    passed = false;
  }

  if (metrics.monthlyCashflow <= 0) {
    warnings.push("Negative cashflow — property loses money monthly");
    passed = false;
  }

  if (metrics.capRate < 5) {
    warnings.push("Cap rate below 5% — weak income relative to price");
  }

  // Adjustment warnings
  if (details.priceAdjustment) {
    warnings.push(`Requires ${details.priceAdjustment} — may not be accepted`);
  }

  return { passed, warnings };
}

// ═══════════════════════════════════════════
// OFFER SCORING (0-100)
// ═══════════════════════════════════════════

export function calculateScore(metrics: OfferMetrics, ltv: number): number {
  // DSCR score: 0-30 points (1.0 = 0, 2.0+ = 30)
  const dscrScore = Math.min(30, Math.max(0, ((metrics.dscr - 0.8) / 1.2) * 30));

  // Cash on Cash: 0-25 points (0% = 0, 30%+ = 25)
  const cocScore = Math.min(25, Math.max(0, (metrics.cashOnCash / 30) * 25));

  // Monthly Cashflow: 0-25 points ($0 = 0, $2000+ = 25)
  const cfScore = Math.min(25, Math.max(0, (metrics.monthlyCashflow / 2000) * 25));

  // LTV: 0-20 points (100% = 0, 70% = 20)
  const ltvScore = Math.min(20, Math.max(0, ((100 - ltv) / 30) * 20));

  return Math.round(dscrScore + cocScore + cfScore + ltvScore);
}

// ═══════════════════════════════════════════
// POST-BALLOON REFINANCE PROJECTION
// ═══════════════════════════════════════════

function calculatePostBalloon(
  balloonAmount: number,
  operating: OperatingNumbers,
  cashNeeded: number
): PostBalloonMetrics {
  // Assume refinance at market conventional rate (6%) for 30 years
  const refiRate = 6.0;
  const refiTerm = 30;
  const refiPayment = calculateMonthlyPayment(balloonAmount, refiRate, refiTerm);

  const monthlyCashflow = operating.monthlyNoi - refiPayment;
  const annualCashflow = monthlyCashflow * 12;
  const cashOnCash = cashNeeded > 0 ? (annualCashflow / cashNeeded) * 100 : 0;

  // Simplified total return post-refi
  const annualPayment = refiPayment * 12;
  const firstYearInterest = balloonAmount * (refiRate / 100);
  const principalPaydown = annualPayment - firstYearInterest;
  const totalReturn = cashNeeded > 0 ? ((annualCashflow + principalPaydown) / cashNeeded) * 100 : 0;

  return {
    monthlyCashflow: Math.round(monthlyCashflow * 100) / 100,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    totalReturn: Math.round(totalReturn * 10) / 10,
  };
}

// ═══════════════════════════════════════════
// SINGLE OFFER BUILDER
// ═══════════════════════════════════════════

function buildOffer(
  terms: OfferTerms,
  property: Property,
  operating: OperatingNumbers,
  defaults: EstimateDefaults
): Offer {
  const downPayment = terms.purchasePrice * (terms.downPaymentPercent / 100);
  const loanAmount = terms.purchasePrice - downPayment;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, terms.interestRate, terms.termYears);
  const ltv = (loanAmount / terms.purchasePrice) * 100;

  // Cash needed = down payment + closing costs + reserves
  const closingCosts = terms.purchasePrice * (defaults.closingCostRate / 100);
  const monthlyExpenses = operating.totalAnnualExpenses / 12;
  const reserves = monthlyExpenses * defaults.reserveMonths;
  const cashNeeded = downPayment + closingCosts + reserves;

  // Balloon calculation
  let balloonAmount: number | undefined;
  if (terms.balloonYear) {
    const paymentsMade = terms.balloonYear * 12;
    balloonAmount = calculateRemainingBalance(loanAmount, terms.interestRate, terms.termYears, paymentsMade);
    balloonAmount = Math.round(balloonAmount * 100) / 100;
  }

  const details: OfferDetails = {
    purchasePrice: terms.purchasePrice,
    downPayment: Math.round(downPayment * 100) / 100,
    loanAmount: Math.round(loanAmount * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    interestRate: terms.interestRate,
    termYears: terms.termYears,
    ltv: Math.round(ltv * 10) / 10,
    operatingExpenseRatio: operating.operatingExpenseRatio,
    balloonAmount,
    balloonYear: terms.balloonYear,
    priceAdjustment: terms.priceAdjustment
      ? `${Math.abs(terms.priceAdjustment)}% below asking`
      : undefined,
  };

  const metrics = calculateOfferMetrics(operating, details, Math.round(cashNeeded));
  const criteria = checkCriteria(metrics, details);
  const score = calculateScore(metrics, details.ltv);

  // Post-balloon projections
  let postBalloon: PostBalloonMetrics | undefined;
  if (balloonAmount && balloonAmount > 0) {
    postBalloon = calculatePostBalloon(balloonAmount, operating, Math.round(cashNeeded));
  }

  return {
    tab: terms.label,
    label: terms.label,
    type: terms.type,
    terms,
    metrics,
    details,
    criteria,
    postBalloon,
    score,
  };
}

// ═══════════════════════════════════════════
// 4-OFFER GENERATION ENGINE
// ═══════════════════════════════════════════

/**
 * Generate the 4 standard offer structures:
 *
 * Creative I:  110% of list, 10% down, 2% interest, 25yr amortization (principal-only feel)
 * Creative II: 100% of list, 10% down, 2% interest, 30yr amort, balloon at year 7
 * Conventional I: 100% of list, 5% down, 6% interest, 30yr
 * Conventional II: 90% of list (-10%), 20% down, 6% interest, 30yr (auto-tuned)
 */
export function generateOffers(
  property: Property,
  defaults: EstimateDefaults = DEFAULT_ESTIMATES,
  rentOverride?: number
): AnalysisResult {
  const listPrice = property.listPrice;

  // Define the 4 offer term structures
  const offerTerms: OfferTerms[] = [
    {
      type: "creative",
      label: "Creative I",
      purchasePrice: Math.round(listPrice * 1.1),
      downPaymentPercent: 10,
      interestRate: 2.0,
      termYears: 25,
    },
    {
      type: "creative",
      label: "Creative II",
      purchasePrice: listPrice,
      downPaymentPercent: 10,
      interestRate: 2.0,
      termYears: 30,
      balloonYear: 7,
    },
    {
      type: "conventional",
      label: "Conventional I",
      purchasePrice: listPrice,
      downPaymentPercent: 5,
      interestRate: 6.0,
      termYears: 30,
    },
    {
      type: "conventional",
      label: "Conventional II",
      purchasePrice: Math.round(listPrice * 0.9),
      downPaymentPercent: 20,
      interestRate: 6.0,
      termYears: 30,
      priceAdjustment: -10,
    },
  ];

  // Calculate operating numbers for each (re-calc per offer since purchase price differs)
  const offers: Offer[] = offerTerms.map((terms) => {
    const operating = calculateOperatingNumbers(property, terms.purchasePrice, defaults, rentOverride);
    return buildOffer(terms, property, operating, defaults);
  });

  // Use first offer's operating numbers as the base (for display)
  const baseOperating = calculateOperatingNumbers(property, listPrice, defaults, rentOverride);

  return {
    property,
    operating: baseOperating,
    offers,
    analyzedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════
// CUSTOM OFFER BUILDER
// ═══════════════════════════════════════════

export function buildCustomOffer(
  property: Property,
  offerType: "creative" | "conventional",
  downPaymentPercent: number,
  interestRate: number,
  termYears: number,
  purchasePrice: number,
  defaults: EstimateDefaults = DEFAULT_ESTIMATES,
  balloonYear?: number,
  rentOverride?: number
): Offer {
  const price = purchasePrice > 0 ? purchasePrice : property.listPrice;
  const priceAdjustment = Math.round(((price - property.listPrice) / property.listPrice) * 100);

  const terms: OfferTerms = {
    type: offerType,
    label: "Custom Offer",
    purchasePrice: price,
    downPaymentPercent,
    interestRate,
    termYears,
    balloonYear: balloonYear && balloonYear > 0 ? balloonYear : undefined,
    priceAdjustment: priceAdjustment < 0 ? priceAdjustment : undefined,
  };

  const operating = calculateOperatingNumbers(property, price, defaults, rentOverride);
  return buildOffer(terms, property, operating, defaults);
}

// ═══════════════════════════════════════════
// ROI PROJECTION (10 year)
// ═══════════════════════════════════════════

export interface ROIPoint {
  year: number;
  equity: number;
  appreciation: number;
  cashflow: number;
  total: number;
}

export function projectROI(offer: Offer, appreciationRate: number = 3.0): ROIPoint[] {
  const points: ROIPoint[] = [];
  const d = offer.details;
  const annualCF = offer.metrics.monthlyCashflow * 12;

  for (let yr = 0; yr <= 10; yr++) {
    // Equity from principal paydown
    const paymentsMade = yr * 12;
    const remainingBalance =
      yr === 0
        ? d.loanAmount
        : calculateRemainingBalance(d.loanAmount, d.interestRate, d.termYears, paymentsMade);
    const equity = d.downPayment + (d.loanAmount - remainingBalance);

    // Appreciation
    const propertyValue = d.purchasePrice * Math.pow(1 + appreciationRate / 100, yr);
    const appreciationGain = propertyValue - d.purchasePrice;

    // Cumulative cashflow
    const totalCF = annualCF * yr;

    points.push({
      year: yr,
      equity: Math.round(equity),
      appreciation: Math.round(appreciationGain),
      cashflow: Math.round(totalCF),
      total: Math.round(equity + appreciationGain + totalCF),
    });
  }

  return points;
}
