export default function PageHeader({ kicker, title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        {kicker && <p className="kicker mb-1.5">{kicker}</p>}
        <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-ink-900 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-ink-600 mt-1.5 max-w-2xl text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
