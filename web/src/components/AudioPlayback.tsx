"use client";

import { useEffect, useState } from "react";
import { getAudio } from "@/lib/audioStore";

export function AudioPlayback({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    getAudio(id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!url) return null;

  return <audio controls src={url} className="w-full" style={{ height: 40 }} />;
}
