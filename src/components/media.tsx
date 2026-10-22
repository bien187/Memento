"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/local/db";
import { supabase, cloudConfigured } from "@/lib/supabase/browser";
import { ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal, Button } from "./ui";
export function useMediaUrl(id: string | null | undefined) {
  const media = useLiveQuery(
    () => (id ? db.entry_media.get(id) : undefined),
    [id],
  );
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true,
      object = "";
    setUrl("");
    setError(false);
    async function load() {
      if (media?.blob) {
        object = URL.createObjectURL(media.blob);
        if (active) setUrl(object);
      } else if (media?.storage_path && cloudConfigured) {
        const { data, error } = await supabase()
          .storage.from("diary-media")
          .download(media.storage_path);
        if (!active) return;
        if (error) {
          setError(true);
          return;
        }
        object = URL.createObjectURL(data);
        setUrl(object);
        await db.entry_media.update(media.id, { blob: data });
      }
    }
    void load();
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [media?.id, media?.blob, media?.storage_path]);
  return { url, error };
}
export function Photo({
  id,
  alt = "",
  className = "",
  onClick,
}: {
  id: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}) {
  const { url, error } = useMediaUrl(id);
  return url ? (
    <img
      className={className}
      src={url}
      alt={alt}
      loading="lazy"
      onClick={onClick}
    />
  ) : (
    <div
      className={`photo-loading ${className}`}
      role="img"
      aria-label={error ? "Bild derzeit nicht verfügbar" : "Bild wird geladen"}
    >
      {error ? <ImageOff size={22} /> : <span />}
    </div>
  );
}
export function Gallery({
  ids,
  start = 0,
  onClose,
}: {
  ids: string[];
  start?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start),
    [touch, setTouch] = useState<number | null>(null);
  const shift = (d: number) =>
    setIndex((i) => (i + d + ids.length) % ids.length);
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`Bild ${index + 1} von ${ids.length}`}
      wide
    >
      <div
        className="gallery"
        onTouchStart={(e) => setTouch(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (
            touch !== null &&
            Math.abs(e.changedTouches[0].clientX - touch) > 50
          )
            shift(e.changedTouches[0].clientX < touch ? 1 : -1);
        }}
      >
        <Photo
          id={ids[index]}
          alt={`Tagebuchfoto ${index + 1}`}
          className="gallery-photo"
        />
        {ids.length > 1 && (
          <div className="gallery-controls">
            <Button
              variant="outline"
              size="icon"
              aria-label="Vorheriges Bild"
              onClick={() => shift(-1)}
            >
              <ChevronLeft />
            </Button>
            <span>
              {index + 1} / {ids.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Nächstes Bild"
              onClick={() => shift(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
