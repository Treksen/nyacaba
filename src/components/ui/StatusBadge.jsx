export default function StatusBadge({ status, statusMap }) {
  const cfg = statusMap?.[status] || { label: status || '—', className: 'badge-slate' };
  return <span className={cfg.className}>{cfg.label}</span>;
}
