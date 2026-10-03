"use client";

import { useState } from "react";
import { PhotoPicker, useRevokePreviewOnUnmount, type PickedPhoto } from "@/components/PhotoPicker";
import { uploadPhoto } from "@/lib/photoClient";

/**
 * Eigenständiger Foto-Upload (Auswahl + "Foto speichern") für den
 * persönlichen Änderungslink und den Adminbereich.
 */
export function PhotoUploader({
  uploadUrl,
  hasPhoto,
  onUploaded,
}: {
  uploadUrl: string;
  hasPhoto: boolean;
  onUploaded?: () => void;
}) {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useRevokePreviewOnUnmount(photo);

  async function save() {
    if (!photo) return;
    setSaving(true);
    setMessage(null);
    const result = await uploadPhoto(uploadUrl, photo.blob);
    setSaving(false);

    if (result.ok) {
      URL.revokeObjectURL(photo.previewUrl);
      setPhoto(null);
      setMessage({ ok: true, text: "Foto gespeichert." });
      onUploaded?.();
    } else {
      setMessage({ ok: false, text: result.message });
    }
  }

  return (
    <div className="space-y-3">
      {hasPhoto && !photo && (
        <p className="text-sm font-semibold text-emerald-700">✓ Ein Foto ist hinterlegt.</p>
      )}
      <PhotoPicker value={photo} onChange={setPhoto} hasExisting={hasPhoto} disabled={saving} />
      {photo && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white disabled:opacity-70"
        >
          {saving ? "Foto wird gespeichert …" : "Foto speichern"}
        </button>
      )}
      {message && (
        <p className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
      )}
    </div>
  );
}
