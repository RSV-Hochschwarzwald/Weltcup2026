"use client";

import { useEffect, useRef, useState } from "react";
import { prepareJpeg } from "@/lib/photoClient";

export interface PickedPhoto {
  blob: Blob;
  previewUrl: string;
}

/**
 * Button "Bild hinzufügen" mit Hinweis-Dialog (Vorgaben des Akkreditierungs-
 * büros) und kleiner Vorschau. Das Foto wird erst beim Absenden übertragen
 * und ist nur für das Organisationsteam sichtbar.
 */
export function PhotoPicker({
  value,
  onChange,
  hasExisting = false,
  disabled = false,
}: {
  value: PickedPhoto | null;
  onChange: (photo: PickedPhoto | null) => void;
  hasExisting?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await prepareJpeg(file);
      if (value) URL.revokeObjectURL(value.previewUrl);
      onChange({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch {
      setError("Dieses Bild konnte nicht gelesen werden. Bitte wähle ein Foto im Format JPG oder PNG.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 p-4">
      <p className="text-sm font-semibold text-slate-800">Foto für die Akkreditierung</p>
      <p className="mt-1 text-xs text-slate-500">
        Nur für das Organisationsteam sichtbar, nicht öffentlich. Du kannst es auch später über deinen
        persönlichen Link nachreichen.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt="Vorschau deines Fotos" className="h-28 w-24 rounded-lg object-cover" />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Anderes Bild wählen
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={remove}
              className="text-left text-sm font-semibold text-red-700 underline"
            >
              Entfernen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => setShowHint(true)}
          className="mt-3 w-full rounded-xl border-2 border-brand-600 bg-white px-4 py-3 text-base font-semibold text-brand-700 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Foto wird vorbereitet …" : hasExisting ? "Neues Bild hinzufügen" : "Bild hinzufügen"}
        </button>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}

      {showHint && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-hint-title"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl">
            <h3 id="photo-hint-title" className="text-lg font-bold text-slate-900">
              Wichtig für dein Foto
            </h3>
            <p className="mt-3 text-sm text-slate-700">
              Für jede Helferin und jeden Helfer muss ein <strong>aktuelles Foto</strong> eingereicht werden –
              auch wenn bereits aus den vergangenen Jahren eine Akkreditierung vorhanden ist. Im System des
              Akkreditierungsbüros befinden sich zahlreiche ältere Fotos, die nicht mehr aktuell sind. Daher
              benötigen wir in diesem Jahr von allen Personen ein neues Bild.
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-800">Bitte achte bei der Aufnahme auf:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>einfarbiger, möglichst neutraler Hintergrund</li>
              <li>Gesicht gerade und frontal zur Kamera, kein seitliches Foto</li>
              <li>keine Kopfbedeckung oder Sonnenbrille</li>
              <li>der Bildausschnitt sollte Kopf und Hals vollständig erfassen</li>
              <li>gute Bildqualität und ausreichende Beleuchtung</li>
            </ul>
            <p className="mt-3 text-sm text-slate-700">
              Du musst die Datei nicht umbenennen – wir ordnen sie automatisch deinem Namen zu. Dein Foto wird
              ausschließlich für die Akkreditierung beim Weltcup verwendet und dazu an das Akkreditierungsbüro
              weitergegeben.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowHint(false)}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 font-semibold text-slate-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHint(false);
                  inputRef.current?.click();
                }}
                className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white"
              >
                Foto auswählen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Gibt eine Vorschau-URL beim Entfernen der Komponente frei. */
export function useRevokePreviewOnUnmount(photo: PickedPhoto | null) {
  const ref = useRef(photo);
  useEffect(() => {
    ref.current = photo;
  }, [photo]);
  useEffect(() => {
    return () => {
      if (ref.current) URL.revokeObjectURL(ref.current.previewUrl);
    };
  }, []);
}
