'use client';

/**
 * Minimal tags for due-deck retention mix (#131312 panel, dark-mode friendly).
 * @param {{ learning: number; familiar: number; mastered: number }} counts
 */
export default function CourseRetentionDueBadges({ counts }) {
  if (!counts) return null;
  const { learning = 0, familiar = 0, mastered = 0 } = counts;
  const total = learning + familiar + mastered;
  if (total <= 0) return null;

  const items = [
    { key: 'learning', label: 'Learning', n: learning, className: 'text-[#93c5fd] border-[#1d4ed8]/45 bg-[#0b1220]' },
    { key: 'familiar', label: 'Familiar', n: familiar, className: 'text-[#fdba74] border-[#9a3412]/45 bg-[#1f120b]' },
    { key: 'mastered', label: 'Mastered', n: mastered, className: 'text-[#86efac] border-[#166534]/45 bg-[#0f1a12]' },
  ];

  return (
    <div
      className="mt-3 flex flex-wrap gap-1.5 rounded-lg px-2 py-2"
      style={{ backgroundColor: '#131312' }}
    >
      {items
        .filter((x) => x.n > 0)
        .map((x) => (
          <span
            key={x.key}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${x.className}`}
          >
            <span>{x.label}</span>
            <span className="opacity-80 tabular-nums">{x.n}</span>
          </span>
        ))}
    </div>
  );
}
