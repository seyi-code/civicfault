"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/api";
import { ImageOff } from "lucide-react";

export function ReportImage({
  path,
  className = "",
}: {
  path: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(path);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}
      >
        <ImageOff className="w-8 h-8 opacity-50" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
