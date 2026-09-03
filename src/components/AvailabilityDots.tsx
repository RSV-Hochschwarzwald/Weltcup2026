export function AvailabilityDots({ capacity, activeCount }: { capacity: number; activeCount: number }) {
  const dots = Array.from({ length: capacity }, (_, i) => i < activeCount);
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {dots.map((filled, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full border-2 ${
            filled ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"
          }`}
        />
      ))}
    </div>
  );
}
