export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}) {
  const accents = {
    primary: "bg-primary-50 text-primary-900",
    accent: "bg-accent-100 text-accent-800",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
  };

  return (
    <div className="card p-5 hover:shadow-lift transition-shadow duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] font-semibold text-ink-500">
            {label}
          </p>

          <p className="font-display text-sm sm:text-base font-semibold text-ink-900 mt-1.5">
            {value}
          </p>

          {hint && <p className="text-xs text-ink-600 mt-1.5">{hint}</p>}
        </div>

        {Icon && (
          <div
            className={`shrink-0 rounded-xl w-11 h-11 grid place-items-center ${accents[accent]}`}
          >
            <Icon size={20} strokeWidth={1.6} />
          </div>
        )}
      </div>
    </div>
  );
}
