import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

export default function DataTable({
  columns,
  rows,
  loading,
  emptyTitle = 'Nothing to show',
  emptyDescription = '',
  emptyAction = null,
  onRowClick,
}) {
  if (loading) {
    return (
      <div className="card-padded flex items-center justify-center py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-100/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-ink-600 ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-cream-100 last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-cream-50/80' : ''
                } transition-colors`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3.5 text-sm text-ink-800 ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
