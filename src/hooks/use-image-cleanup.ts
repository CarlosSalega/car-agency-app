"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Imported from the specific files, never the module barrel: the barrel also
// exports the node-oriented server pieces, which must not reach this bundle.
import { mapWithConcurrency } from "@/modules/image-uploads/core/concurrency";
import { getPublicIdFromUrl } from "@/modules/image-uploads/core/url";

// One request deletes one key, so the server-side batch bound does not apply
// here; the browser would otherwise fire one request per removed image.
const DELETE_CONCURRENCY = 4;

const CLOUDINARY_HOST = "res.cloudinary.com";

// `getPublicIdFromUrl` answers with this placeholder when it cannot derive a
// key, and the route deletes by `public_id` only.
const PUBLIC_ID_FALLBACK = "placeholder";

interface UseImageCleanupReturn {
  tempUploaded: string[];
  setTempUploaded: React.Dispatch<React.SetStateAction<string[]>>;
  cleanupUsedImages: (usedImages: string[]) => void;
}

/**
 * The storage key of one temporary upload, or `null` when it cannot be derived.
 *
 * A bare key is already what `Car.images` stores, so it is forwarded as it is.
 * A Cloudinary delivery URL is reduced with `getPublicIdFromUrl`. Anything that
 * derivation cannot resolve is skipped rather than guessed: a wrong key can
 * only produce a 403, and guessing closer would risk naming someone else's key.
 */
const toStorageKey = (value: string): string | null => {
  if (!value) return null;
  if (!value.includes(CLOUDINARY_HOST)) return value;

  const derived = getPublicIdFromUrl(value);

  if (!derived || derived === PUBLIC_ID_FALLBACK) return null;

  return derived;
};

const deleteImages = async (keys: string[]) => {
  // `mapWithConcurrency` rejects as soon as one worker throws, so each worker
  // absorbs its own failure: one failed delete must not abort the rest.
  await mapWithConcurrency(keys, DELETE_CONCURRENCY, async (key) => {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    } catch {
      // Ignored on purpose: the cleanup is best-effort.
    }
  });
};

export function useImageCleanup(): UseImageCleanupReturn {
  const [tempUploaded, setTempUploaded] = useState<string[]>([]);

  // The `beforeunload` and unmount listeners are registered once, so the list
  // they read at firing time comes from here instead of from a closure over the
  // state of the render that registered them.
  const latestTempUploadedRef = useRef(tempUploaded);

  useEffect(() => {
    latestTempUploadedRef.current = tempUploaded;
  });

  const usedImagesRef = useRef<Set<string>>(new Set());

  const markUsed = useCallback((images: string[]) => {
    images.forEach((image) => {
      const key = toStorageKey(image);

      usedImagesRef.current.add(image);
      if (key) usedImagesRef.current.add(key);
    });
  }, []);

  const deleteUnused = useCallback((images: string[]) => {
    const used = usedImagesRef.current;
    const unusedKeys: string[] = [];

    images.forEach((image) => {
      const key = toStorageKey(image);

      if (!key || used.has(image) || used.has(key)) return;

      unusedKeys.push(key);
    });

    if (!unusedKeys.length) return;

    void deleteImages(unusedKeys);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () =>
      deleteUnused(latestTempUploadedRef.current);

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      deleteUnused(latestTempUploadedRef.current);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [deleteUnused]);

  const cleanupUsedImages = (usedImages: string[]) => {
    markUsed(usedImages);
    // Deletes run now, before the list is cleared, and keep running whatever
    // the following state change does: a pending delete is never cancelled.
    deleteUnused(latestTempUploadedRef.current);
    setTempUploaded([]);
  };

  return {
    tempUploaded,
    setTempUploaded,
    cleanupUsedImages,
  };
}
