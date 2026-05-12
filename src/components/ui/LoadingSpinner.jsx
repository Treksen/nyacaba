export default function LoadingSpinner({ label, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-cream-200" />
        <div className="absolute inset-0 rounded-full border-2 border-primary-900 border-t-transparent animate-spin" />
      </div>
      {label && <p className="text-sm text-ink-600 font-medium">{label}</p>}
    </div>
  );
}
