"use client";

import { useEffect, useRef, useState } from "react";

interface UseImageCleanupReturn {
  tempUploaded: string[];
  setTempUploaded: React.Dispatch<React.SetStateAction<string[]>>;
  cleanupUsedImages: (usedImages: string[]) => void;
}

const normalizeUrl = (url: string) => {
  try {
    const { protocol, host, pathname } = new URL(url);
    return `${protocol}//${host}${pathname}`;
  } catch {
    return url.trim();
  }
};

const deleteImages = async (urls: string[]) => {
  await Promise.allSettled(
    urls.map((url) =>
      fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    ),
  );
};

export function useImageCleanup(): UseImageCleanupReturn {
  const [tempUploaded, setTempUploaded] = useState<string[]>([]);

  const usedImagesRef = useRef<Set<string>>(new Set());
  const isCleaningRef = useRef(false);

  const cleanupUnused = (urls: string[]) => {
    if (!urls.length || isCleaningRef.current) return;

    const unused = urls.filter((url) => {
      const normalized = normalizeUrl(url);
      return (
        !usedImagesRef.current.has(url) &&
        !usedImagesRef.current.has(normalized)
      );
    });

    if (unused.length) {
      deleteImages(unused);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => cleanupUnused(tempUploaded);

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cleanupUnused(tempUploaded);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [tempUploaded]);

  const cleanupUsedImages = (usedImages: string[]) => {
    isCleaningRef.current = true;

    usedImages.forEach((url) => {
      usedImagesRef.current.add(url);
      usedImagesRef.current.add(normalizeUrl(url));
    });

    cleanupUnused(tempUploaded);

    setTempUploaded([]);

    setTimeout(() => {
      isCleaningRef.current = false;
      usedImagesRef.current.clear();
    }, 500);
  };

  return {
    tempUploaded,
    setTempUploaded,
    cleanupUsedImages,
  };
}
