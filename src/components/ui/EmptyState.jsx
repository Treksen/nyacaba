import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={`text-center py-16 px-6 ${className}`}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-100 text-primary-700 mb-4">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-display font-semibold text-ink-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-ink-600 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
