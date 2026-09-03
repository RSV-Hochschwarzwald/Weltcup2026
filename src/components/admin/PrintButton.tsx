"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white"
    >
      Drucken
    </button>
  );
}
