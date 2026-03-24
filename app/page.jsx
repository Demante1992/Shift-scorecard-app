"use client";
import React, { useMemo, useState } from "react";
import { Upload, Copy, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import Tesseract from "tesseract.js";

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl bg-white shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children }) { return <div className="p-6 pb-0">{children}</div>; }
function CardTitle({ children, className = "" }) { return <h2 className={`text-xl font-semibold ${className}`}>{children}</h2>; }
function CardContent({ children }) { return <div className="p-6">{children}</div>; }
function Button({ children, className = "", variant = "solid", ...props }) {
  const base = "inline-flex items-center rounded-2xl px-4 py-2 text-sm font-medium transition";
  const style = variant === "outline" ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" : "bg-slate-900 text-white hover:bg-slate-800";
  return <button className={`${base} ${style} ${className}`} {...props}>{children}</button>;
}
function Input(props) { return <input {...props} />; }
function Badge({ children }) { return <span className="rounded-full border border-slate-300 px-3 py-1 text-xs">{children}</span>; }

function statusClass(status) {
  if (status === "good") return "bg-green-100 text-green-800 border-green-200";
  if (status === "warn") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}
function parsePercent(str) { const n = Number(String(str).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : null; }
function parseTimeToMinutes(str) { const m = String(str).match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) + Number(m[2]) / 60 : null; }
function formatVariance(n, suffix = "") { if (n == null || Number.isNaN(n)) return "—"; const sign = n > 0 ? "+" : ""; return `${sign}${n.toFixed(1)}${suffix}`; }
function formatClock(n) { return n != null ? `${Math.floor(n)}:${String(Math.round((n % 1) * 60)).padStart(2, "0")}` : "—"; }
function scoreStatus(key, value) {
  if (value == null || Number.isNaN(value)) return "warn";
  switch (key) {
    case "salesVsForecast": return value >= 0 ? "good" : value >= -5 ? "warn" : "bad";
    case "laborVariance": return value <= 0 ? "good" : value <= 2 ? "warn" : "bad";
    case "loadTime": return value < 6 ? "good" : value <= 7 ? "warn" : "bad";
    case "deliveryTime": return value < 35 ? "good" : value <= 40 ? "warn" : "bad";
    case "hangups": return value <= 5 ? "good" : value <= 8 ? "warn" : "bad";
    case "voids": return value <= 10 ? "good" : value <= 25 ? "warn" : "bad";
    case "cash": return Math.abs(value) === 0 ? "good" : Math.abs(value) <= 5 ? "warn" : "bad";
    case "inventory": return Math.abs(value) <= 1 ? "good" : Math.abs(value) <= 2 ? "warn" : "bad";
    default: return "warn";
  }
}
function cleanOCRText(text) {
  return text.replace(/[|]/g, " ").replace(/\s+/g, " ").replace(/Florrisant/gi, "Florissant").replace(/St Ann/gi, "St Ann").trim();
}
function extractRows(raw) {
  const text = cleanOCRText(raw);
  const stores = ["Florissant", "Belleville", "Saint Peters", "St Peters", "Collinsville", "Ballwin", "St Ann", "Grand Total"];
  const positions = stores.map((name) => ({ name, idx: text.toLowerCase().indexOf(name.toLowerCase()) })).filter((x) => x.idx >= 0).sort((a, b) => a.idx - b.idx);
  const rows = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i < positions.length - 1 ? positions[i + 1].idx : text.length;
    rows.push({ store: positions[i].name, text: text.slice(start, end).trim() });
  }
  return rows;
}
function parseRow(rowText, store) {
  const pcts = [...rowText.matchAll(/-?\d+\.\d+%/g)].map((m) => parsePercent(m[0]));
  const times = [...rowText.matchAll(/\b\d{1,2}:\d{2}\b/g)].map((m) => parseTimeToMinutes(m[0]));
  const ints = [...rowText.matchAll(/\b-?\d+\b/g)].map((m) => Number(m[0]));
  return {
    store,
    salesVsForecast: pcts[0] ?? null,
    laborVariance: ints.length > 8 ? ints[8] : null,
    loadTime: times.length ? times[times.length - 1] : null,
    deliveryTime: times.length > 1 ? times[times.length - 2] : null,
    hangups: ints[0] ?? null,
    voids: ints.length > 1 ? ints[ints.length - 2] : null,
    cash: ints.length ? ints[ints.length - 1] : null,
    inventory: pcts.length ? pcts[pcts.length - 1] : null,
  };
}
function makeFocus(data) {
  const priorities = [];
  if (scoreStatus("laborVariance", data.laborVariance) === "bad") priorities.push("tighten labor");
  if (scoreStatus("deliveryTime", data.deliveryTime) === "bad" || scoreStatus("loadTime", data.loadTime) === "bad") priorities.push("speed of service");
  if (scoreStatus("voids", data.voids) === "bad" || scoreStatus("cash", data.cash) === "bad") priorities.push("cash control");
  if (scoreStatus("inventory", data.inventory) === "bad") priorities.push("portioning and counts");
  if (scoreStatus("salesVsForecast", data.salesVsForecast) === "bad") priorities.push("sales-building");
  return priorities.length ? priorities.slice(0, 2).join(" + ") : "stay consistent";
}
function MetricPill({ label, value, status }) {
  return <div className={`rounded-2xl border px-3 py-2 ${statusClass(status)}`}><div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}
function ScorecardGraphic({ data }) {
  const focus = makeFocus(data);
  return <div className="mx-auto w-full max-w-md rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shift Leader Daily Report</div><div className="mt-1 text-2xl font-bold text-slate-900">{data.store}</div></div><Badge>Morning Summary</Badge></div><div className="mt-5 grid grid-cols-2 gap-3"><MetricPill label="Sales vs Forecast" value={formatVariance(data.salesVsForecast, "%")} status={scoreStatus("salesVsForecast", data.salesVsForecast)} /><MetricPill label="Labor vs Ideal" value={formatVariance(data.laborVariance, " hrs")} status={scoreStatus("laborVariance", data.laborVariance)} /><MetricPill label="Load Time" value={formatClock(data.loadTime)} status={scoreStatus("loadTime", data.loadTime)} /><MetricPill label="Delivery Time" value={formatClock(data.deliveryTime)} status={scoreStatus("deliveryTime", data.deliveryTime)} /><MetricPill label="Hangups" value={data.hangups ?? "—"} status={scoreStatus("hangups", data.hangups)} /><MetricPill label="Voids" value={data.voids != null ? `$${data.voids}` : "—"} status={scoreStatus("voids", data.voids)} /><MetricPill label="Cash Over/Short" value={data.cash != null ? `$${data.cash}` : "—"} status={scoreStatus("cash", data.cash)} /><MetricPill label="Inventory" value={formatVariance(data.inventory, "%")} status={scoreStatus("inventory", data.inventory)} /></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Focus</div><div className="mt-1 text-base font-semibold text-slate-900">{focus}</div></div></div>;
}

export default function Page() {
  const [imageUrl, setImageUrl] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedData = useMemo(() => {
    const row = rows.find((r) => r.store === selectedStore) || rows.find((r) => r.store !== "Grand Total") || rows[0];
    return row ? parseRow(row.text, row.store) : null;
  }, [rows, selectedStore]);
  const textVersion = useMemo(() => {
    if (!selectedData) return "";
    return `${selectedData.store}\nSales vs Forecast: ${formatVariance(selectedData.salesVsForecast, "%")}\nLabor vs Ideal: ${formatVariance(selectedData.laborVariance, " hrs")}\nLoad Time: ${formatClock(selectedData.loadTime)}\nDelivery Time: ${formatClock(selectedData.deliveryTime)}\nHangups: ${selectedData.hangups ?? "—"}\nVoids: ${selectedData.voids != null ? `$${selectedData.voids}` : "—"}\nCash Over/Short: ${selectedData.cash != null ? `$${selectedData.cash}` : "—"}\nInventory: ${formatVariance(selectedData.inventory, "%")}\nFocus: ${makeFocus(selectedData)}`;
  }, [selectedData]);
  async function runOCR(file) {
    setLoading(true); setError(""); setRows([]); setSelectedStore("");
    try {
      const objectUrl = URL.createObjectURL(file); setImageUrl(objectUrl);
      const { data } = await Tesseract.recognize(file, "eng", { logger: () => {} });
      const cleaned = cleanOCRText(data.text); setOcrText(cleaned);
      const foundRows = extractRows(cleaned);
      if (!foundRows.length) setError("I could not detect store rows from this screenshot. Try a cleaner screenshot or crop tighter around the table.");
      else { setRows(foundRows); const firstStore = foundRows.find((r) => r.store !== "Grand Total") || foundRows[0]; setSelectedStore(firstStore?.store || ""); }
    } catch { setError("There was a problem reading the screenshot."); } finally { setLoading(false); }
  }
  async function copyText() { if (textVersion) await navigator.clipboard.writeText(textVersion); }
  return <div className="min-h-screen bg-slate-100 p-4 md:p-8"><div className="mx-auto max-w-6xl"><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6"><h1 className="text-3xl font-bold tracking-tight text-slate-900">Shift Leader Scorecard Builder</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Upload your daily performance screenshot. The app reads the report, auto-detects store rows, and creates a text-ready graphic your GMs can send each morning.</p></motion.div><div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload report screenshot</CardTitle></CardHeader><CardContent><label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:bg-white"><Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && runOCR(e.target.files[0])} /><ImageIcon className="h-10 w-10 text-slate-500" /><div className="mt-3 text-lg font-semibold text-slate-900">Tap to upload screenshot</div><div className="mt-1 text-sm text-slate-500">Best results come from a full-width screenshot with clear text.</div></label>{loading && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><Loader2 className="h-4 w-4 animate-spin" />Reading screenshot and building scorecard...</div>}{error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}{imageUrl && <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><img src={imageUrl} alt="Uploaded report" className="w-full object-contain" /></div>}{!!rows.length && <div className="mt-4"><div className="mb-2 text-sm font-medium text-slate-700">Detected stores</div><div className="flex flex-wrap gap-2">{rows.map((row) => <button key={row.store} onClick={() => setSelectedStore(row.store)} className={`rounded-full border px-3 py-1.5 text-sm transition ${selectedStore === row.store ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{row.store}</button>)}</div></div>}</CardContent></Card><div className="space-y-6"><Card><CardHeader><CardTitle>Generated graphic</CardTitle></CardHeader><CardContent>{selectedData ? <ScorecardGraphic data={selectedData} /> : <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Your scorecard will appear here after upload.</div>}</CardContent></Card><Card><CardHeader><CardTitle>Text version</CardTitle></CardHeader><CardContent><div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-800">{textVersion || "Upload a screenshot to generate the text version."}</div><div className="mt-4 flex gap-3"><Button onClick={copyText} disabled={!textVersion}><Copy className="mr-2 h-4 w-4" />Copy text</Button><Button variant="outline" onClick={() => { setImageUrl(null); setOcrText(""); setRows([]); setSelectedStore(""); setError(""); }}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button></div></CardContent></Card>{!!ocrText && <Card><CardHeader><CardTitle>Raw OCR text</CardTitle></CardHeader><CardContent><div className="max-h-56 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{ocrText}</div></CardContent></Card>}</div></div></div></div>;
}
