"use client";

import { useState, useEffect } from "react";
import {
  AnalysisResult,
  Offer,
  UserProfile,
  AnalysisHistoryEntry,
  DEFAULT_ESTIMATES,
} from "@/lib/types";
import { projectROI, type ROIPoint, buildCustomOffer } from "@/lib/calculator";
import {
  analyzeUrls,
  fetchProfile,
  saveProfile as saveProfileApi,
  fetchHistory,
  deleteHistoryEntry,
  fetchAnalysisById,
} from "@/lib/api-client";

// ═══════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════

const fmt = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
const fmtK = (n: number) =>
  n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(1) + "M" : n >= 1000 ? "$" + (n / 1000).toFixed(0) + "K" : "$" + n;
const pct = (n: number) => n.toFixed(1) + "%";

// ═══════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════

function Arrow({ d = "left", s = 18 }: { d?: string; s?: number }) {
  const paths: Record<string, string> = { left: "M15 18l-6-6 6-6", right: "M9 18l6-6-6-6" };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={paths[d] || paths.left} /></svg>;
}
const IconSearch = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
const IconClock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
const IconSettings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
const IconMail = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg>;
const IconGrid = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
const IconChart = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#3D6B50" /><path d="M7 12l3.5 3.5L17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#C0392B" /><path d="M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>;
const IconAlert = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2"><path d="M12 2L2 22h20L12 2zM12 9v5m0 4h.01" /></svg>;
const IconClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
const IconCopy = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
const IconEye = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconTrash = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>;
const IconSparkle = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg>;

// ═══════════════════════════════════════════
// SCORE RING
// ═══════════════════════════════════════════

function ScoreRing({ score, size = 96, stroke = 5 }: { score: number; size?: number; stroke?: number }) {
  const [anim, setAnim] = useState(0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setAnim((1 - Math.pow(1 - t, 3)) * score);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const color = score >= 75 ? "#3D6B50" : score >= 50 ? "#C4A265" : "#C0392B";
  const label = score >= 75 ? "Strong" : score >= 50 ? "Moderate" : "Weak";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0ECE6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ * (1 - anim / 100)} strokeLinecap="round" />
      </svg>
      <div style={{ marginTop: -size / 2 - 16, textAlign: "center", position: "relative" }}>
        <div className="font-serif font-bold text-brand-navy" style={{ fontSize: size * 0.28 }}>{Math.round(anim)}</div>
        <div className="text-[11px] text-brand-text-light uppercase tracking-wider">{label}</div>
      </div>
      <div style={{ height: size * 0.22 }} />
    </div>
  );
}

// ═══════════════════════════════════════════
// ROI CHART
// ═══════════════════════════════════════════

function ROIChart({ data }: { data: ROIPoint[] }) {
  const w = 520, h = 200, pad = { t: 20, r: 20, b: 30, l: 55 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const maxY = Math.max(...data.map(d => d.total)) * 1.1;
  const x = (yr: number) => pad.l + (yr / 10) * iw;
  const y = (v: number) => pad.t + ih - (v / maxY) * ih;
  const areaPath = (key: keyof ROIPoint) => { const pts = data.map(d => `${x(d.year)},${y(d[key] as number)}`).join(" "); return pts + ` ${x(10)},${y(0)} ${x(0)},${y(0)}`; };
  const linePath = (key: keyof ROIPoint) => data.map(d => `${x(d.year)},${y(d[key] as number)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[520px]">
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (<g key={i}><line x1={pad.l} y1={y(maxY * f)} x2={w - pad.r} y2={y(maxY * f)} stroke="#F0ECE6" strokeWidth="1" /><text x={pad.l - 8} y={y(maxY * f) + 4} textAnchor="end" fontSize="10" fill="#8B95A5">{fmtK(maxY * f)}</text></g>))}
      {data.filter((_, i) => i % 2 === 0).map(d => (<text key={d.year} x={x(d.year)} y={h - 8} textAnchor="middle" fontSize="10" fill="#8B95A5">Yr {d.year}</text>))}
      <polygon points={areaPath("total")} fill="#0A2540" opacity={0.06} />
      <polygon points={areaPath("cashflow")} fill="#3D6B50" opacity={0.12} />
      <polyline points={linePath("total")} fill="none" stroke="#0A2540" strokeWidth="2" />
      <polyline points={linePath("cashflow")} fill="none" stroke="#3D6B50" strokeWidth="2" />
      <polyline points={linePath("equity")} fill="none" stroke="#C4A265" strokeWidth="2" />
    </svg>
  );
}

// ═══════════════════════════════════════════
// COMPARE VIEW
// ═══════════════════════════════════════════

function CompareView({ offers }: { offers: Offer[] }) {
  type R = { label: string; getValue: (o: Offer) => number | undefined; format: (n: number) => string; best: "high" | "low" };
  const rows: R[] = [
    { label: "Purchase Price", getValue: o => o.details.purchasePrice, format: fmt, best: "low" },
    { label: "Cash Needed", getValue: o => o.metrics.cashNeeded, format: fmt, best: "low" },
    { label: "Monthly Cashflow", getValue: o => o.metrics.monthlyCashflow, format: fmt, best: "high" },
    { label: "Cash on Cash", getValue: o => o.metrics.cashOnCash, format: pct, best: "high" },
    { label: "DSCR", getValue: o => o.metrics.dscr, format: n => n.toFixed(2), best: "high" },
    { label: "Cap Rate", getValue: o => o.metrics.capRate, format: pct, best: "high" },
    { label: "Down Payment", getValue: o => o.details.downPayment, format: fmt, best: "low" },
    { label: "Monthly Payment", getValue: o => o.details.monthlyPayment, format: fmt, best: "low" },
    { label: "Interest Rate", getValue: o => o.details.interestRate, format: pct, best: "low" },
    { label: "LTV", getValue: o => o.details.ltv, format: pct, best: "low" },
  ];
  const bestIdx = (row: R) => { const vals = offers.map(o => row.getValue(o)).filter((v): v is number => v !== undefined); if (!vals.length) return -1; const t = row.best === "high" ? Math.max(...vals) : Math.min(...vals); return offers.findIndex(o => row.getValue(o) === t); };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
        <thead><tr>
          <th className="text-left px-4 py-3 border-b-2 border-brand-border text-brand-text-light font-semibold text-[11px] uppercase tracking-wider">Metric</th>
          {offers.map((o, i) => (<th key={i} className="text-right px-4 py-3 border-b-2 border-brand-border font-semibold text-[12px]">{o.tab}<div className="mt-1">{o.criteria.passed ? <IconCheck /> : <IconX />}</div></th>))}
        </tr></thead>
        <tbody>{rows.map((row, ri) => { const bi = bestIdx(row); return (
          <tr key={ri} className="border-b border-brand-border-light">
            <td className="px-4 py-2.5 text-brand-text-med font-medium">{row.label}</td>
            {offers.map((o, i) => { const v = row.getValue(o); return (<td key={i} className={`text-right px-4 py-2.5 ${i === bi ? "font-bold text-brand-sage bg-brand-sage-bg" : "text-brand-navy"}`}>{v !== undefined ? row.format(v) : "—"}</td>); })}
          </tr>
        ); })}</tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════
// PROFILE MODAL
// ═══════════════════════════════════════════

function ProfileModal({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: UserProfile; onSave: (p: UserProfile) => void }) {
  const [f, setF] = useState(profile);
  useEffect(() => { if (open) setF(profile); }, [open, profile]);
  if (!open) return null;
  const set = (k: keyof UserProfile, v: string) => setF({ ...f, [k]: v } as UserProfile);
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card animate-in max-w-[440px] w-full p-8 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-text-light hover:text-brand-navy"><IconClose /></button>
        <h2 className="font-serif text-2xl mb-1">Profile Settings</h2>
        <p className="text-[13px] text-brand-text-light mb-6">Personalize your outreach templates</p>
        {([{ k: "name" as const, l: "Full Name", p: "Jane Smith" }, { k: "brokerage" as const, l: "Brokerage", p: "Compass" }, { k: "phone" as const, l: "Phone", p: "(215) 555-0100" }, { k: "email" as const, l: "Email", p: "jane@compass.com" }, { k: "license" as const, l: "License #", p: "RS-123456" }]).map(fl => (
          <div key={fl.k} className="mb-4"><label className="label">{fl.l}</label><input className="input-field" value={String(f[fl.k] || "")} onChange={e => set(fl.k, e.target.value)} placeholder={fl.p} /></div>
        ))}
        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => { onSave(f); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// EMAIL MODAL
// ═══════════════════════════════════════════

function EmailModal({ open, onClose, offer, property, profile }: { open: boolean; onClose: () => void; offer: Offer | null; property: { address: string; city: string; listPrice: number } | null; profile: UserProfile }) {
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [copied, setCopied] = useState(false);
  if (!open || !offer || !property) return null;
  const d = offer.details;
  const subj = `Creative Financing Offer — ${property.address}, ${property.city}`;
  const body = `Dear Property Owner,\n\nMy name is ${profile.name || "Your Name"}, a licensed agent with ${profile.brokerage || "Your Brokerage"}. I'm writing about your property at ${property.address}, ${property.city}, currently listed at ${fmt(property.listPrice)}.\n\nI'd like to propose a ${offer.label.toLowerCase()} financing arrangement:\n\n• Purchase Price: ${fmt(d.purchasePrice)}\n• Down Payment: ${fmt(d.downPayment)}\n• Monthly Payment: ${fmt(d.monthlyPayment)}\n• Interest Rate: ${d.interestRate}%\n• Term: ${d.termYears} years\n\nThis provides you guaranteed monthly income of ${fmt(d.monthlyPayment)}, eliminates commission costs, and requires no repairs.\n\nWould you be available for a brief conversation this week?\n\nBest regards,\n${profile.name || "Your Name"}\n${profile.brokerage || "Your Brokerage"}\n${profile.phone || "(555) 555-5555"}`;
  const sms = `Hi — I'm ${profile.name || "Your Name"} with ${profile.brokerage || "Your Brokerage"}. Interested in ${property.address}: ${fmt(d.purchasePrice)} purchase, ${fmt(d.downPayment)} down, ${fmt(d.monthlyPayment)}/mo. Open to a quick call? ${profile.phone || "(555) 555-5555"}`;
  const doCopy = () => { navigator.clipboard.writeText(tab === "email" ? `Subject: ${subj}\n\n${body}` : sms); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card animate-in max-w-[600px] w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-0">
          <div className="flex justify-between items-start">
            <div><h2 className="font-serif text-[22px]">Draft Communication</h2><p className="text-[13px] text-brand-text-light mt-0.5">{property.address}, {property.city}</p></div>
            <button onClick={onClose} className="text-brand-text-light hover:text-brand-navy"><IconClose /></button>
          </div>
          <div className="flex gap-2 mt-4 border-b border-brand-border">
            {(["email", "sms"] as const).map(t => (<button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${tab === t ? "border-brand-gold text-brand-navy" : "border-transparent text-brand-text-light"}`}>{t === "email" ? "Email" : "SMS"}</button>))}
          </div>
        </div>
        <div className="p-6 pt-4 overflow-y-auto flex-1">
          {tab === "email" && <div className="mb-4"><label className="label">Subject</label><input className="input-field bg-brand-cream" readOnly value={subj} /></div>}
          <label className="label">{tab === "email" ? "Body" : "Message"}</label>
          <textarea className="input-field bg-brand-cream resize-none leading-relaxed" style={{ height: tab === "email" ? 320 : 120 }} readOnly value={tab === "email" ? body : sms} />
        </div>
        <div className="p-4 border-t border-brand-border">
          <button className={`btn-primary flex items-center gap-2 ${copied ? "!bg-brand-sage" : ""}`} onClick={doCopy}><IconCopy /> {copied ? "Copied!" : "Copy to Clipboard"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════

function HomePage({ onAnalyze, onBuilder, onHistory, onProfileOpen }: { onAnalyze: (urls: string[]) => Promise<void>; onBuilder: () => void; onHistory: () => void; onProfileOpen: () => void }) {
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    const urlList = urls.split("\n").map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0) return;
    setLoading(true);
    setError(null);
    setProgress(0);
    const interval = setInterval(() => setProgress(p => Math.min(p + Math.random() * 8, 90)), 500);
    try {
      await onAnalyze(urlList);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Check your API keys and try again.");
    } finally {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setLoading(false), 300);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "#FAFAF8" }}>
      <div className="w-full max-w-[680px]">
        <div className="text-center mb-10 animate-in">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-navy mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
          </div>
          <h1 className="font-serif text-4xl leading-tight text-brand-navy">Seller Finance<br />Auto Offers</h1>
          <p className="text-[15px] text-brand-text-light mt-2 max-w-[400px] mx-auto">Analyze Zillow listings and generate intelligent creative financing offers in seconds.</p>
        </div>
        <div className="card p-8 animate-in" style={{ animationDelay: "0.15s" }}>
          <div className="flex gap-2 mb-7 justify-end">
            {[{ icon: <IconSettings />, label: "Profile", action: onProfileOpen }, { icon: <IconGrid />, label: "Builder", action: onBuilder }, { icon: <IconClock />, label: "History", action: onHistory }].map((b, i) => (
              <button key={i} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-2 !text-[12px]" onClick={b.action}>{b.icon}{b.label}</button>
            ))}
          </div>
          <label className="label">Zillow Listing URLs</label>
          <textarea className="input-field h-[120px] resize-none leading-[1.8]" value={urls} onChange={e => setUrls(e.target.value)} placeholder="Paste Zillow URLs here, one per line…" />
          <p className="text-[11px] text-brand-text-light mt-1.5 mb-5">Up to 10 listings per analysis</p>
          <label className="label">Estimation Defaults</label>
          <select className="input-field mb-6"><option>Tax 1.2% · Rent 1% · Insurance 0.35%</option></select>
          {error && <div className="mb-4 p-3 rounded-btn bg-brand-red-bg border border-red-200 text-brand-red text-[13px]">{error}</div>}
          {loading ? (
            <div>
              <div className="h-1 rounded-full bg-brand-border-light overflow-hidden mb-3"><div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #C4A265, #3D6B50)" }} /></div>
              <p className="text-center text-[13px] text-brand-text-light">{progress < 30 ? "Scraping listing data…" : progress < 60 ? "Estimating market rates…" : progress < 90 ? "Calculating offers…" : "Finalizing…"}</p>
            </div>
          ) : (
            <button className="btn-primary w-full !py-3.5 !text-[15px] flex items-center justify-center gap-2" onClick={handleScrape}><IconSearch /> Analyze Listings</button>
          )}
        </div>
        <div className="mt-8 px-2 animate-in" style={{ animationDelay: "0.3s" }}>
          <h3 className="label mb-4">How it works</h3>
          <div className="grid grid-cols-4 gap-4">
            {[{ n: "01", t: "Scrape", d: "Pull listing data from Zillow" }, { n: "02", t: "Estimate", d: "Fill gaps with market rates" }, { n: "03", t: "Calculate", d: "Generate 4 offer scenarios" }, { n: "04", t: "Outreach", d: "Draft seller communications" }].map((s, i) => (
              <div key={i} className="text-center"><div className="font-serif text-[28px] text-brand-gold mb-1">{s.n}</div><div className="text-[13px] font-semibold text-brand-navy mb-1">{s.t}</div><div className="text-[12px] text-brand-text-light leading-relaxed">{s.d}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// RESULTS PAGE
// ═══════════════════════════════════════════

function ResultsPage({ analysis, onBack, onHistory, profile, onEmailOffer }: { analysis: AnalysisResult; onBack: () => void; onHistory: () => void; profile: UserProfile; onEmailOffer: (o: Offer) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState<"detail" | "compare" | "timeline">("detail");
  const { property, offers } = analysis;
  const offer = offers[activeTab];
  const m = offer.metrics;
  const d = offer.details;
  const roi = projectROI(offer);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <div className="max-w-[1120px] mx-auto px-5 py-6 pb-16">
        <div className="flex justify-between items-center mb-8 animate-in">
          <button className="btn-secondary flex items-center gap-1.5" onClick={onBack}><Arrow d="left" s={16} /> Home</button>
          <h1 className="font-serif text-[28px]">Analysis</h1>
          <button className="btn-secondary flex items-center gap-1.5" onClick={onHistory}><IconClock /> History</button>
        </div>
        {/* Property Header */}
        <div className="card p-6 mb-6 animate-in" style={{ animationDelay: "0.08s" }}>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div><h2 className="text-xl font-bold">{property.address}</h2><p className="text-[13px] text-brand-text-light mt-0.5">{property.city}, {property.state} {property.zip}</p></div>
            <div className="flex gap-6 flex-wrap">
              {[{ l: "List Price", v: fmt(property.listPrice) }, { l: "Beds/Baths", v: `${property.beds}bd / ${property.baths}ba` }, { l: "Sq Ft", v: property.sqft ? property.sqft.toLocaleString() : "—" }, { l: "Built", v: property.yearBuilt ? String(property.yearBuilt) : "—" }].map((s, i) => (
                <div key={i} className="text-right"><div className="label !mb-0.5">{s.l}</div><div className="text-[15px] font-semibold">{s.v}</div></div>
              ))}
            </div>
          </div>
        </div>
        {/* View Switcher */}
        <div className="flex gap-2 mb-5 animate-in" style={{ animationDelay: "0.14s" }}>
          {[{ k: "detail" as const, icon: <IconEye />, label: "Detail" }, { k: "compare" as const, icon: <IconGrid />, label: "Compare All" }, { k: "timeline" as const, icon: <IconChart />, label: "ROI Timeline" }].map(v => (
            <button key={v.k} onClick={() => setView(v.k)} className={`flex items-center gap-1.5 px-4 py-2 rounded-btn text-[13px] font-semibold border-none cursor-pointer transition-all ${view === v.k ? "bg-brand-navy text-white" : "bg-white text-brand-text-med shadow-card"}`}>{v.icon}{v.label}</button>
          ))}
        </div>

        {view === "compare" && <div className="card p-6 animate-in"><CompareView offers={offers} /></div>}

        {view === "timeline" && (
          <div className="card p-7 animate-in">
            <h3 className="font-serif text-[22px] mb-1">10-Year Projected Returns</h3>
            <p className="text-[13px] text-brand-text-light mb-5">{offer.tab} — assumes 3% annual appreciation</p>
            <ROIChart data={roi} />
            <div className="flex gap-6 mt-4 justify-center">
              {[{ c: "#0A2540", l: "Total Value" }, { c: "#3D6B50", l: "Cashflow" }, { c: "#C4A265", l: "Equity" }].map((leg, i) => (<div key={i} className="flex items-center gap-1.5 text-[12px] text-brand-text-med"><div className="w-3 h-[3px] rounded-sm" style={{ background: leg.c }} />{leg.l}</div>))}
            </div>
            <div className="flex gap-2 mt-6 justify-center">
              {offers.map((o, i) => (<button key={i} onClick={() => setActiveTab(i)} className={`px-4 py-2 rounded-btn text-[12px] font-semibold border-none cursor-pointer transition-all ${activeTab === i ? "bg-brand-navy text-white" : "bg-brand-cream text-brand-text-med"}`}>{o.tab}</button>))}
            </div>
          </div>
        )}

        {view === "detail" && (
          <>
            <div className="flex gap-2 mb-5 animate-in" style={{ animationDelay: "0.2s" }}>
              {offers.map((o, i) => (
                <button key={i} onClick={() => setActiveTab(i)} className={`flex-1 p-4 rounded-card text-center cursor-pointer transition-all card-hover ${activeTab === i ? "border-2 border-brand-navy bg-white shadow-card-md" : "border border-brand-border bg-brand-cream"}`}>
                  <div className="text-[13px] font-bold text-brand-navy">{o.tab}</div>
                  <div className="text-[11px] text-brand-text-light mt-0.5">{o.label}</div>
                  <div className="mt-2">{o.criteria.passed ? <IconCheck /> : <IconX />}</div>
                </button>
              ))}
            </div>
            {offer.criteria.warnings.length > 0 && (
              <div className="space-y-2 mb-5 animate-in" style={{ animationDelay: "0.25s" }}>
                {offer.criteria.warnings.map((w, i) => (<div key={i} className="flex items-center gap-3 px-4 py-3 rounded-btn bg-brand-amber-bg border border-[#E8D5A0]"><IconAlert /><span className="text-[13px] text-brand-amber font-medium">{w}</span></div>))}
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card p-7 animate-in" style={{ animationDelay: "0.3s" }}>
                <div className="flex justify-between items-start mb-6">
                  <div><div className="label !mb-1">Offer Score</div><ScoreRing score={offer.score} /></div>
                  <div className="tag bg-brand-sage-bg text-brand-sage">{offer.type === "creative" ? "Creative" : "Conventional"}</div>
                </div>
                <div className="label mb-4">Key Metrics</div>
                <div className="grid grid-cols-2 gap-5">
                  {[{ l: "Cash Needed", v: fmt(m.cashNeeded), c: "#0A2540" }, { l: "Monthly Cashflow", v: fmt(m.monthlyCashflow), c: "#3D6B50" }, { l: "Cap Rate", v: pct(m.capRate), c: "#3D6B50" }, { l: "Cash on Cash", v: pct(m.cashOnCash), c: m.cashOnCash < 10 ? "#B8860B" : "#3D6B50" }, { l: "Total Return", v: pct(m.totalReturn), c: "#3D6B50" }, { l: "DSCR", v: m.dscr.toFixed(2), c: m.dscr < 1.25 ? "#B8860B" : "#3D6B50" }, { l: "GRM", v: m.grm.toString(), c: "#0A2540" }].map((item, i) => (
                    <div key={i}><div className="text-[11px] text-brand-text-light font-medium mb-1">{item.l}</div><div className="text-[22px] font-bold font-serif" style={{ color: item.c }}>{item.v}</div></div>
                  ))}
                  <div><div className="text-[11px] text-brand-text-light font-medium mb-1.5">Criteria</div><div className={`tag ${offer.criteria.passed ? "bg-brand-sage-bg text-brand-sage" : "bg-brand-red-bg text-brand-red"}`}>{offer.criteria.passed ? <><IconCheck /> Passed</> : <><IconX /> Failed</>}</div></div>
                </div>
              </div>
              <div className="card p-7 flex flex-col animate-in" style={{ animationDelay: "0.4s" }}>
                <div className="label mb-4">Offer Details</div>
                <div className="flex-1">
                  {[{ l: "Purchase Price", v: fmt(d.purchasePrice) }, { l: "Down Payment", v: fmt(d.downPayment) }, { l: "Monthly Payment", v: fmt(d.monthlyPayment) }, { l: "Interest Rate", v: pct(d.interestRate) }, ...(d.balloonAmount ? [{ l: "Balloon Amount", v: fmt(d.balloonAmount) }, { l: "Balloon Year", v: `Year ${d.balloonYear}` }] : []), { l: "Term", v: `${d.termYears} years` }, { l: "LTV", v: pct(d.ltv), warn: d.ltv > 90 }, { l: "Op. Expense Ratio", v: pct(d.operatingExpenseRatio) }].map((r: any, i) => (
                    <div key={i} className="flex justify-between py-2.5 border-b border-brand-border-light"><span className="text-[13px] text-brand-text-med">{r.l}</span><span className={`text-[13px] font-semibold ${r.warn ? "text-brand-red" : "text-brand-navy"}`}>{r.v}</span></div>
                  ))}
                </div>
                {d.priceAdjustment && <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-brand-amber-bg border border-[#E8D5A0] text-[12px] text-brand-amber font-medium">Adjustment: {d.priceAdjustment}</div>}
                {offer.postBalloon && (
                  <div className="mt-4 p-4 rounded-btn bg-brand-cream border border-brand-border">
                    <div className="label !mb-2.5">Post-Balloon Refinance</div>
                    {[{ l: "Monthly Cashflow", v: fmt(offer.postBalloon.monthlyCashflow) }, { l: "CoC Return", v: pct(offer.postBalloon.cashOnCash) }, { l: "Total Return", v: pct(offer.postBalloon.totalReturn) }].map((r, i) => (
                      <div key={i} className="flex justify-between py-1.5"><span className="text-[12px] text-brand-text-med">{r.l}</span><span className="text-[12px] font-semibold text-brand-sage">{r.v}</span></div>
                    ))}
                  </div>
                )}
                <button className="btn-gold w-full mt-5 flex items-center justify-center gap-2" onClick={() => onEmailOffer(offer)}><IconMail /> Draft Seller Communication</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// BUILDER PAGE
// ═══════════════════════════════════════════

function BuilderPage({ onBack, analysis }: { onBack: () => void; analysis: AnalysisResult | null }) {
  const [dp, setDp] = useState(10);
  const [ir, setIr] = useState(2);
  const [term, setTerm] = useState(25);
  const [balloon, setBalloon] = useState(0);
  const [price, setPrice] = useState(analysis?.property.listPrice || 0);
  const [offerType, setOfferType] = useState<"creative" | "conventional">("creative");
  const [result, setResult] = useState<Offer | null>(null);

  const property = analysis?.property;

  const calculate = () => {
    if (!property) return;
    const offer = buildCustomOffer(property, offerType, dp, ir, term, price, DEFAULT_ESTIMATES, balloon > 0 ? balloon : undefined);
    setResult(offer);
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <div className="max-w-[900px] mx-auto px-5 py-6 pb-16">
        <button className="btn-secondary flex items-center gap-1.5 mb-6" onClick={onBack}><Arrow d="left" s={16} /> Back</button>
        <h1 className="font-serif text-[32px] mb-1 animate-in">Custom Offer Builder</h1>
        <p className="text-[14px] text-brand-text-light mb-8 animate-in">Experiment with deal terms and see projected returns in real time</p>

        {!property ? (
          <div className="card p-8 text-center animate-in">
            <p className="text-brand-text-light mb-4">Analyze a property first, then come back here to build custom offers.</p>
            <button className="btn-primary" onClick={onBack}>← Go Analyze a Property</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-5">
              <div className="card p-6 animate-in">
                <div className="label mb-3">Property</div>
                <div className="text-[15px] font-semibold">{property.fullAddress}</div>
                <div className="text-[13px] text-brand-text-light mt-1">List: {fmt(property.listPrice)} · {property.beds}bd/{property.baths}ba · {property.sqft.toLocaleString()} sqft</div>
              </div>
              <div className="card p-6 animate-in" style={{ animationDelay: "0.1s" }}>
                <div className="label mb-3">Offer Type</div>
                <select className="input-field" value={offerType} onChange={e => setOfferType(e.target.value as any)}>
                  <option value="creative">Creative Financing</option>
                  <option value="conventional">Conventional</option>
                </select>
              </div>
              <div className="card p-6 animate-in" style={{ animationDelay: "0.2s" }}>
                <div className="label mb-5">Deal Terms</div>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2"><label className="text-[13px] font-medium">Down Payment</label><span className="text-[13px] font-bold text-brand-gold">{dp}%</span></div>
                    <div className="flex items-center gap-3"><input type="range" min={0} max={50} value={dp} onChange={e => setDp(+e.target.value)} className="flex-1" style={{ accentColor: "#C4A265" }} /><input type="number" className="input-field !w-16 text-center !p-2" value={dp} onChange={e => setDp(+e.target.value)} /></div>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium block mb-2">Interest Rate</label>
                    <div className="flex items-center gap-2"><button className="btn-secondary !px-3 !py-2" onClick={() => setIr(Math.max(0, ir - 0.25))}>−0.25%</button><input type="number" className="input-field text-center flex-1" step={0.25} value={ir} onChange={e => setIr(+e.target.value)} /><button className="btn-secondary !px-3 !py-2" onClick={() => setIr(ir + 0.25)}>+0.25%</button></div>
                  </div>
                  <div><label className="text-[13px] font-medium block mb-2">Term (years)</label><select className="input-field" value={term} onChange={e => setTerm(+e.target.value)}>{[15, 20, 25, 30].map(y => <option key={y} value={y}>{y} years</option>)}</select></div>
                  <div><label className="text-[13px] font-medium block mb-2">Balloon Year</label><select className="input-field" value={balloon} onChange={e => setBalloon(+e.target.value)}><option value={0}>None</option>{[3, 5, 7, 10].map(y => <option key={y} value={y}>Year {y}</option>)}</select></div>
                  <div><label className="text-[13px] font-medium block mb-2">Purchase Price</label><input className="input-field" type="number" value={price} onChange={e => setPrice(+e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4" style={{ position: "sticky", top: 24, alignSelf: "start" }}>
              <button className="btn-gold w-full flex items-center justify-center gap-2" onClick={calculate}><IconSparkle /> Calculate Offer</button>
              {result && (
                <div className="card p-6 animate-in">
                  <div className="flex justify-between items-center mb-4">
                    <div className="label !mb-0">Results</div>
                    <div className={`tag ${result.criteria.passed ? "bg-brand-sage-bg text-brand-sage" : "bg-brand-red-bg text-brand-red"}`}>{result.criteria.passed ? <><IconCheck /> Pass</> : <><IconX /> Fail</>}</div>
                  </div>
                  <ScoreRing score={result.score} size={80} stroke={4} />
                  <div className="space-y-3 mt-4">
                    {[{ l: "Monthly Cashflow", v: fmt(result.metrics.monthlyCashflow), c: result.metrics.monthlyCashflow > 0 ? "#3D6B50" : "#C0392B" }, { l: "Cash Needed", v: fmt(result.metrics.cashNeeded), c: "#0A2540" }, { l: "Cash on Cash", v: pct(result.metrics.cashOnCash), c: "#3D6B50" }, { l: "DSCR", v: result.metrics.dscr.toFixed(2), c: result.metrics.dscr >= 1.25 ? "#3D6B50" : "#B8860B" }, { l: "Cap Rate", v: pct(result.metrics.capRate), c: "#3D6B50" }, { l: "Payment", v: fmt(result.details.monthlyPayment), c: "#0A2540" }].map((r, i) => (
                      <div key={i} className="flex justify-between"><span className="text-[12px] text-brand-text-med">{r.l}</span><span className="text-[13px] font-bold" style={{ color: r.c }}>{r.v}</span></div>
                    ))}
                  </div>
                  {result.criteria.warnings.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {result.criteria.warnings.map((w, i) => (<div key={i} className="text-[11px] text-brand-amber flex items-center gap-1"><IconAlert />{w}</div>))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// HISTORY PAGE
// ═══════════════════════════════════════════

function HistoryPage({ onBack, onViewDetails }: { onBack: () => void; onViewDetails: (id: string) => void }) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchHistory().then(h => { setHistory(h); setLoading(false); }); }, []);
  const handleDelete = async (id: string) => { const ok = await deleteHistoryEntry(id); if (ok) setHistory(h => h.filter(e => e.id !== id)); };
  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <div className="max-w-[880px] mx-auto px-5 py-6 pb-16">
        <div className="flex justify-between items-center mb-8">
          <button className="btn-secondary flex items-center gap-1.5" onClick={onBack}><Arrow d="left" s={16} /> Home</button>
          <h1 className="font-serif text-[28px]">History</h1>
          <div className="w-20" />
        </div>
        {loading ? <div className="text-center py-20 text-brand-text-light">Loading…</div> : history.length === 0 ? <div className="text-center py-20 text-brand-text-light">No analyses yet.</div> : (
          <div className="space-y-4">
            {history.map((h, idx) => (
              <div key={h.id} className="card card-hover p-6 animate-in" style={{ animationDelay: `${idx * 0.08}s` }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-[13px] text-brand-text-light"><IconClock />{new Date(h.created_at).toLocaleString()}</div>
                    <div className="mt-2">{h.properties.map((p, i) => <div key={i} className="text-[14px] text-brand-navy font-medium">{p}</div>)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-1.5 !py-2 !px-3.5" onClick={() => onViewDetails(h.id)}><IconEye /> View</button>
                    <button className="p-2 rounded-btn border border-brand-border bg-white cursor-pointer hover:bg-brand-red-bg" onClick={() => handleDelete(h.id)}><IconTrash /></button>
                  </div>
                </div>
                <div className="border-t border-brand-border-light pt-4 grid grid-cols-4 gap-4">
                  <div><div className="label">Status</div><div className="tag bg-brand-sage-bg text-brand-sage mt-1.5">{h.properties.length} Successful</div></div>
                  <div><div className="label">Total Value</div><div className="font-serif text-xl font-bold text-brand-sage mt-1">{fmtK(h.total_value)}</div></div>
                  <div><div className="label">Avg Cashflow</div><div className="font-serif text-xl font-bold text-brand-sage mt-1">{fmtK(h.avg_cashflow)}</div></div>
                  <div><div className="label">Avg Returns</div><div className="text-[13px] text-brand-text-med mt-1.5">CoC {h.avg_coc}% · Total {h.avg_total_return}%</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════

export default function Page() {
  const [page, setPage] = useState<"home" | "results" | "builder" | "history">("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [emailOffer, setEmailOffer] = useState<Offer | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ name: "", brokerage: "", phone: "", email: "", license: "", defaults: DEFAULT_ESTIMATES });

  useEffect(() => { fetchProfile().then(p => { if (p) setProfile(p); }); }, []);

  const handleAnalyze = async (urls: string[]) => {
    const response = await analyzeUrls(urls);
    if (response.errors.length > 0 && response.results.length === 0) {
      throw new Error(response.errors.map(e => `${e.url}: ${e.error}`).join("\n"));
    }
    if (response.results.length > 0) {
      setAnalysis(response.results[0]);
      setPage("results");
    }
  };

  const handleSaveProfile = async (p: UserProfile) => { setProfile(p); await saveProfileApi(p); };
  const handleViewHistory = async (id: string) => { const entry = await fetchAnalysisById(id); if (entry?.results?.length) { setAnalysis(entry.results[0]); setPage("results"); } };
  const emailProperty = analysis ? { address: analysis.property.address, city: `${analysis.property.city}, ${analysis.property.state} ${analysis.property.zip}`, listPrice: analysis.property.listPrice } : null;

  return (
    <>
      {page === "home" && <HomePage onAnalyze={handleAnalyze} onBuilder={() => setPage("builder")} onHistory={() => setPage("history")} onProfileOpen={() => setProfileOpen(true)} />}
      {page === "results" && analysis && <ResultsPage analysis={analysis} onBack={() => setPage("home")} onHistory={() => setPage("history")} profile={profile} onEmailOffer={setEmailOffer} />}
      {page === "builder" && <BuilderPage onBack={() => setPage("home")} analysis={analysis} />}
      {page === "history" && <HistoryPage onBack={() => setPage("home")} onViewDetails={handleViewHistory} />}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} onSave={handleSaveProfile} />
      <EmailModal open={!!emailOffer} onClose={() => setEmailOffer(null)} offer={emailOffer} property={emailProperty} profile={profile} />
    </>
  );
}
