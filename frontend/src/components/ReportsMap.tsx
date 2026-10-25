"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FaultReport } from "@/types";
import { mediaUrl } from "@/lib/api";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** One map pin per cluster_id (or report id) so nearby duplicates share a pin. */
function clusterPins(reports: FaultReport[]) {
  const map = new Map<
    number,
    { lat: number; lng: number; items: FaultReport[] }
  >();
  for (const r of reports) {
    const key = r.cluster_id ?? r.id;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(r);
      // average position slightly for multi-report clusters
      const n = existing.items.length;
      existing.lat = (existing.lat * (n - 1) + r.latitude) / n;
      existing.lng = (existing.lng * (n - 1) + r.longitude) / n;
    } else {
      map.set(key, { lat: r.latitude, lng: r.longitude, items: [r] });
    }
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

export function ReportsMap({ reports }: { reports: FaultReport[] }) {
  const pins = useMemo(() => clusterPins(reports), [reports]);
  const center: [number, number] =
    pins.length > 0 ? [pins[0].lat, pins[0].lng] : [0.3476, 32.5825];

  return (
    <div className="h-72 sm:h-96 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => {
          const head = p.items[0];
          const count = p.items.length;
          return (
            <Marker key={p.key} position={[p.lat, p.lng]} icon={icon}>
              <Popup>
                <div className="text-sm min-w-[140px]">
                  <p className="font-semibold capitalize">
                    {head.category.replace(/_/g, " ")}
                    {count > 1 ? ` · ${count} reports` : ""}
                  </p>
                  <p className="text-slate-500">{head.status}</p>
                  {count > 1 && (
                    <ul className="mt-1 text-xs text-slate-500 list-disc pl-4">
                      {p.items.slice(0, 5).map((r) => (
                        <li key={r.id}>
                          #{r.id} {r.status}
                        </li>
                      ))}
                    </ul>
                  )}
                  {mediaUrl(head.image_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(head.image_url)!}
                      alt=""
                      className="mt-1 rounded max-h-24 w-full object-cover"
                    />
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
