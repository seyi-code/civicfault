"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { createReport, mediaUrl, API_BASE } from "@/lib/api";
import type { FaultReport } from "@/types";

function ReportForm() {
  const search = useSearchParams();
  const orgSlug = search.get("org") || "";

  const [lat, setLat] = useState("0.3476");
  const [lng, setLng] = useState("32.5825");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaultReport | null>(null);
  const [locating, setLocating] = useState(false);
  const [orgLabel, setOrgLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug) return;
    fetch(`${API_BASE}/api/v1/orgs/by-slug/${orgSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOrgLabel(o.brand_name || o.name))
      .catch(() => {});
  }, [orgSlug]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError("Could not get location — enter coordinates manually");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Please choose a photo");
      return;
    }
    const form = new FormData();
    form.append("latitude", lat);
    form.append("longitude", lng);
    form.append("file", file);
    if (description.trim()) form.append("description", description.trim());
    if (orgSlug) form.append("org_slug", orgSlug);

    setLoading(true);
    try {
      const data = await createReport(form);
      setResult(data);
      setFile(null);
      setDescription("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Report a fault</h1>
      <p className="text-slate-500 text-sm mb-6">
        {orgLabel
          ? `Reporting to ${orgLabel}`
          : "Snap a photo of a pothole, leak, waste pile, or other infrastructure issue."}
      </p>

      <form onSubmit={onSubmit} className="space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Photo</label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 transition">
            <Camera className="w-8 h-8 text-slate-400" />
            <span className="text-sm text-slate-500">
              {file ? file.name : "Tap to take or choose a photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
            <input type="number" step="any" required value={lat} onChange={(e) => setLat(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
            <input type="number" step="any" required value={lng} onChange={(e) => setLng(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>

        <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex items-center gap-2 text-sm text-amber-700 font-medium">
          <MapPin className="w-4 h-4" />
          {locating ? "Getting location…" : "Use my current location"}
        </button>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Large pothole near the junction" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition">
          {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>) : "Submit report"}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-3">
            <CheckCircle2 className="w-5 h-5" /> Report submitted
          </div>
          <dl className="text-sm space-y-1 text-slate-700">
            <div><span className="text-slate-500">ID:</span> {result.id}</div>
            <div>
              <span className="text-slate-500">Category:</span>{" "}
              <span className="font-medium">{result.category.replace(/_/g, " ")}</span>
            </div>
          </dl>
          {mediaUrl(result.image_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(result.image_url)!} alt="Report" className="mt-3 rounded-lg max-h-48 object-cover w-full" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <ReportForm />
    </Suspense>
  );
}
