"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FaultReport } from "@/types";
import { mediaUrl } from "@/lib/api";

// Fix default marker icons in Next bundlers
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function ReportsMap({ reports }: { reports: FaultReport[] }) {
  const center: [number, number] =
    reports.length > 0
      ? [reports[0].latitude, reports[0].longitude]
      : [0.3476, 32.5825]; // Kampala default

  useEffect(() => {
    // no-op: ensures client-only mount
  }, []);

  return (
    <div className="h-72 sm:h-96 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reports.map((r) => (
          <Marker key={r.id} position={[r.latitude, r.longitude]} icon={icon}>
            <Popup>
              <div className="text-sm min-w-[140px]">
                <p className="font-semibold capitalize">{r.category.replace(/_/g, " ")}</p>
                <p className="text-slate-500">{r.status}</p>
                {mediaUrl(r.image_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(r.image_url)!}
                    alt=""
                    className="mt-1 rounded max-h-24 w-full object-cover"
                  />
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
