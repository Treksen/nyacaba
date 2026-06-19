/**
 * reportExport.js
 * Opens a fully-styled, print-optimised report in a new tab and triggers
 * the browser's print dialog. Choose "Save as PDF" from there.
 *
 * Works on desktop (Chrome, Firefox, Safari, Edge) and mobile
 * (Android Chrome → share → print; iOS Safari → share → print).
 *
 * No external libraries required.
 */

const CHURCH = import.meta.env.VITE_CHURCH_NAME || 'Nyacaba';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return 'KSh ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(part, whole) {
  if (!whole || whole === 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

function statusBadge(status) {
  const map = {
    active:    'background:#d1fae5;color:#065f46',
    completed: 'background:#dbeafe;color:#1e40af',
    planning:  'background:#fef9c3;color:#713f12',
    cancelled: 'background:#fee2e2;color:#991b1b',
  };
  const style = map[status] || 'background:#f3f4f6;color:#374151';
  return `<span style="font-size:9px;padding:2px 6px;border-radius:999px;font-weight:600;text-transform:uppercase;${style}">${status}</span>`;
}

function progressBar(value, max, color = '#0F4A3C') {
  const w = pct(value, max);
  return `
    <div style="height:6px;background:#e5e7eb;border-radius:999px;margin-top:4px;overflow:hidden">
      <div style="height:6px;width:${w}%;background:${color};border-radius:999px"></div>
    </div>`;
}

function section(title, content) {
  return `
    <div class="section">
      <h2>${title}</h2>
      ${content}
    </div>`;
}

function twoCol(left, right) {
  return `<div class="two-col">${left}${right}</div>`;
}

function kpiGrid(items) {
  return `<div class="kpi-grid">${items.map(({ label, value, sub, color }) => `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" style="color:${color || '#0F4A3C'}">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`).join('')}</div>`;
}

function table(headers, rows, opts = {}) {
  if (!rows || rows.length === 0) return `<p class="empty">No data for this period.</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th${h.right ? ' style="text-align:right"' : ''}>${h.label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr class="${ri % 2 === 0 ? '' : 'alt'}">${r.map((c, ci) => `<td${headers[ci]?.right ? ' style="text-align:right"' : ''}>${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      ${opts.footer ? `<tfoot><tr>${opts.footer.map((c, ci) => `<td${headers[ci]?.right ? ' style="text-align:right"' : ''}><strong>${c}</strong></td>`).join('')}</tr></tfoot>` : ''}
    </table>`;
}

// ─── main export ──────────────────────────────────────────────────────────────

export function exportReportPDF(report) {
  const {
    year,
    summary,
    byMonth,
    byType,
    welfareByCat,
    expensesByCat,
    projectsSummary,
    topContributors,
    memberGrowth,
    welfareStats,
    meetingStats,
    pendingContribs,
  } = report;

  const net      = (summary.netPosition || 0);
  const netColor = net >= 0 ? '#065f46' : '#991b1b';
  const netSign  = net < 0 ? '−' : '';

  // ── 1. Summary KPIs ──────────────────────────────────────────────────────
  const summarySection = section('Financial Summary',
    kpiGrid([
      { label: 'Total Contributions (In)', value: fmt(summary.totalContrib), sub: `${summary.contribCount} entries`, color: '#065f46' },
      { label: 'Total Money Out',          value: fmt(summary.totalOut),     sub: 'welfare + expenses + projects', color: '#991b1b' },
      { label: 'Active Members',           value: summary.activeMembers,     sub: `+${summary.newMembers} joined ${year}` },
      { label: 'Net Position',             value: `${netSign}${fmt(Math.abs(net))}`, color: netColor },
    ]) +
    kpiGrid([
      { label: 'Welfare Disbursed',   value: fmt(summary.totalWelfare),      color: '#92400e' },
      { label: 'General Expenses',    value: fmt(summary.totalGenExpenses),   color: '#92400e' },
      { label: 'Project Expenses',    value: fmt(summary.totalProjExpenses),  color: '#92400e' },
    ])
  );

  // ── 2. Monthly contributions ──────────────────────────────────────────────
  const monthlySection = section('Monthly Contributions vs Welfare Out',
    table(
      [{ label: 'Month' }, { label: 'Contributions (In)', right: true }, { label: 'Welfare Out', right: true }, { label: 'Net', right: true }],
      byMonth.map((m) => [
        m.name,
        fmt(m.total),
        fmt(m.out || 0),
        `<span style="color:${(m.total - (m.out || 0)) >= 0 ? '#065f46' : '#991b1b'}">${fmt(m.total - (m.out || 0))}</span>`,
      ]),
      {
        footer: [
          'TOTAL',
          fmt(byMonth.reduce((s, m) => s + m.total, 0)),
          fmt(byMonth.reduce((s, m) => s + (m.out || 0), 0)),
          fmt(byMonth.reduce((s, m) => s + m.total - (m.out || 0), 0)),
        ]
      }
    )
  );

  // ── 3. By type ────────────────────────────────────────────────────────────
  const byTypeSection = section('Contributions by Type',
    table(
      [{ label: 'Type' }, { label: 'Amount (KSh)', right: true }, { label: '% of Total', right: true }],
      byType.map((t) => [
        t.name,
        fmt(t.value),
        `${pct(t.value, summary.totalContrib)}%`,
      ]),
      { footer: ['TOTAL', fmt(summary.totalContrib), '100%'] }
    )
  );

  // ── 4. Welfare ────────────────────────────────────────────────────────────
  const welfareSection = section('Welfare',
    `<div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Total Requests</div><div class="kpi-value">${welfareStats.total}</div></div>
      <div class="kpi-card"><div class="kpi-label">Approved</div><div class="kpi-value" style="color:#065f46">${welfareStats.approved}</div></div>
      <div class="kpi-card"><div class="kpi-label">Rejected</div><div class="kpi-value" style="color:#991b1b">${welfareStats.rejected}</div></div>
      <div class="kpi-card"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:#92400e">${welfareStats.pending}</div></div>
      <div class="kpi-card"><div class="kpi-label">Amount Requested</div><div class="kpi-value">${fmt(welfareStats.requested)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Amount Disbursed</div><div class="kpi-value" style="color:#991b1b">${fmt(welfareStats.disbursed)}</div></div>
    </div>` +
    (welfareStats.requested > 0 ? `
      <p style="font-size:11px;color:#6b7280;margin-bottom:4px">
        Disbursement rate: <strong>${pct(welfareStats.disbursed, welfareStats.requested)}%</strong> of requested amount disbursed
      </p>
      ${progressBar(welfareStats.disbursed, welfareStats.requested)}
      <div style="margin-top:16px"></div>` : '') +
    (welfareByCat.length > 0 ? table(
      [{ label: 'Category' }, { label: 'Disbursed (KSh)', right: true }, { label: '%', right: true }],
      welfareByCat.map((w) => [w.name, fmt(w.value), `${pct(w.value, summary.totalWelfare)}%`]),
      { footer: ['TOTAL', fmt(summary.totalWelfare), ''] }
    ) : '<p class="empty">No disbursements this year.</p>')
  );

  // ── 5. General expenses ───────────────────────────────────────────────────
  const expensesSection = section('General Expenses by Category',
    expensesByCat.length === 0
      ? '<p class="empty">No general expenses recorded this year.</p>'
      : table(
          [{ label: 'Category' }, { label: 'Amount (KSh)', right: true }, { label: '%', right: true }],
          expensesByCat.map((e) => [e.name, fmt(e.value), `${pct(e.value, summary.totalGenExpenses)}%`]),
          { footer: ['TOTAL', fmt(summary.totalGenExpenses), ''] }
        )
  );

  // ── 6. Projects ───────────────────────────────────────────────────────────
  const projectsSection = section('Projects — Budget vs Spent',
    projectsSummary.length === 0
      ? '<p class="empty">No project financial data this year.</p>'
      : `<table>
          <thead><tr><th>Project</th><th>Status</th><th style="text-align:right">Budget</th><th style="text-align:right">Spent</th><th style="text-align:right">%</th></tr></thead>
          <tbody>${projectsSummary.map((p, i) => {
            const over  = p.budget > 0 && p.spent > p.budget;
            const pcPct = p.budget > 0 ? pct(p.spent, p.budget) : '—';
            return `<tr class="${i % 2 === 0 ? '' : 'alt'}">
              <td>${p.name}</td>
              <td>${statusBadge(p.status)}</td>
              <td style="text-align:right">${p.budget > 0 ? fmt(p.budget) : '—'}</td>
              <td style="text-align:right;color:${over ? '#991b1b' : 'inherit'}">${fmt(p.spent)}</td>
              <td style="text-align:right;color:${over ? '#991b1b' : '#065f46'}">${p.budget > 0 ? pcPct + '%' : '—'}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr>
            <td colspan="2"><strong>TOTAL</strong></td>
            <td style="text-align:right"><strong>${fmt(projectsSummary.reduce((s, p) => s + p.budget, 0))}</strong></td>
            <td style="text-align:right"><strong>${fmt(summary.totalProjExpenses)}</strong></td>
            <td></td>
          </tr></tfoot>
        </table>`
  );

  // ── 7. Top contributors ───────────────────────────────────────────────────
  const topSection = section(`Top ${topContributors.length} Contributors — ${year}`,
    topContributors.length === 0
      ? '<p class="empty">No confirmed contributions this year.</p>'
      : table(
          [{ label: 'Rank' }, { label: 'Member' }, { label: 'Total (KSh)', right: true }, { label: '% of Total', right: true }],
          topContributors.map((c, i) => [
            `#${i + 1}`,
            c.name,
            fmt(c.total),
            `${pct(c.total, summary.totalContrib)}%`,
          ])
        )
  );

  // ── 8. Member growth ─────────────────────────────────────────────────────
  const growthSection = section(`New Members by Month — ${year}`,
    summary.newMembers === 0
      ? '<p class="empty">No new members joined this year.</p>'
      : table(
          [{ label: 'Month' }, { label: 'New Members', right: true }],
          memberGrowth.filter((m) => m.new > 0).map((m) => [m.name, m.new]),
          { footer: ['TOTAL', summary.newMembers] }
        )
  );

  // ── 9. Meetings + pending ─────────────────────────────────────────────────
  const operationsSection = section('Operations',
    twoCol(
      `<div style="flex:1;margin-right:16px">
        <h3 style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px">Meetings — ${year}</h3>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Meetings Held</div><div class="kpi-value">${meetingStats.total}</div></div>
          <div class="kpi-card"><div class="kpi-label">Avg Attendance</div><div class="kpi-value">${meetingStats.avgAttendance}</div><div class="kpi-sub">per meeting</div></div>
        </div>
      </div>`,
      `<div style="flex:1">
        <h3 style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px">Pending Actions</h3>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Pending Contributions</div><div class="kpi-value" style="color:${pendingContribs > 0 ? '#92400e' : 'inherit'}">${pendingContribs}</div><div class="kpi-sub">awaiting verification</div></div>
          <div class="kpi-card"><div class="kpi-label">Pending Welfare</div><div class="kpi-value" style="color:${welfareStats.pending > 0 ? '#92400e' : 'inherit'}">${welfareStats.pending}</div><div class="kpi-sub">awaiting decision</div></div>
        </div>
      </div>`
    )
  );

  // ── Assemble HTML document ────────────────────────────────────────────────
  const logoSVG = `<svg width="72" height="72" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="250" fill="#064E3B"/>
  <circle cx="256" cy="256" r="210" stroke="#EAB54F" stroke-width="8" fill="none"/>
  <circle cx="170" cy="390" r="12" fill="#EAB54F"/>
  <circle cx="256" cy="410" r="12" fill="#EAB54F"/>
  <circle cx="342" cy="390" r="12" fill="#EAB54F"/>
  <path d="M220 360H292C305 360 315 370 320 382H192C197 370 207 360 220 360Z" fill="#EAB54F"/>
  <rect x="244" y="160" width="24" height="210" rx="12" fill="#EAB54F"/>
  <rect x="242" y="115" width="28" height="45" rx="10" fill="#EAB54F"/>
  <path d="M256 245C215 245 185 215 185 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 285C195 285 145 235 145 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 325C175 325 110 255 110 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 245C297 245 327 215 327 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 285C317 285 367 235 367 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <path d="M256 325C337 325 402 255 402 170" stroke="#EAB54F" stroke-width="18" stroke-linecap="round" fill="none"/>
  <rect x="96"  y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="131" y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="171" y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="242" y="100" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="313" y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="353" y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <rect x="388" y="150" width="28" height="16" rx="6" fill="#EAB54F"/>
  <path d="M110 115C120 128 122 138 110 148C98 138 100 128 110 115Z" fill="#F5C76B"/>
  <path d="M145 115C155 128 157 138 145 148C133 138 135 128 145 115Z" fill="#F5C76B"/>
  <path d="M185 115C195 128 197 138 185 148C173 138 175 128 185 115Z" fill="#F5C76B"/>
  <path d="M256 65C268 82 270 94 256 106C242 94 244 82 256 65Z" fill="#F5C76B"/>
  <path d="M327 115C337 128 339 138 327 148C315 138 317 128 327 115Z" fill="#F5C76B"/>
  <path d="M367 115C377 128 379 138 367 148C355 138 357 128 367 115Z" fill="#F5C76B"/>
  <path d="M402 115C412 128 414 138 402 148C390 138 392 128 402 115Z" fill="#F5C76B"/>
</svg>`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${CHURCH} — Annual Report ${year}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #1a1a1a;
    background: #fff;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }

  /* ── Cover ── */
  .cover {
    padding: 48px 48px 36px;
    border-bottom: 4px solid #D4A24E;
    text-align: center;
  }
  .cover-logo { margin: 0 auto 16px; display: block; }
  .cover-church {
    font-size: 26px;
    font-weight: 700;
    color: #0F4A3C;
    margin: 0 0 6px;
    font-family: Georgia, serif;
  }
  .cover-title { font-size: 15px; color: #6b7280; margin: 0 0 20px; }
  .cover-divider {
    width: 60px;
    height: 3px;
    background: #D4A24E;
    margin: 0 auto 16px;
    border-radius: 2px;
  }
  .cover-meta  { font-size: 11px; color: #9ca3af; }

  /* ── Sections ── */
  .content { padding: 0 48px 48px; }

  .section {
    margin-top: 32px;
    page-break-inside: avoid;
  }
  .section h2 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #0F4A3C;
    border-bottom: 2px solid #D4A24E;
    padding-bottom: 5px;
    margin: 0 0 12px;
    text-align: center;
    text-align: center;
  }

  /* ── KPI grid ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
    margin-bottom: 8px;
  }
  .kpi-card {
    background: #f9f6f0;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: #9ca3af; margin-bottom: 2px; }
  .kpi-value { font-size: 18px; font-weight: 700; color: #0F4A3C; font-family: Georgia, serif; }
  .kpi-sub   { font-size: 9px; color: #9ca3af; margin-top: 2px; }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 4px;
  }
  th {
    background: #f3ede0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #6b7280;
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  tr.alt td { background: #faf9f7; }
  tfoot td {
    border-top: 2px solid #e5e7eb;
    border-bottom: none;
    background: #f9f6f0;
    padding: 7px 10px;
  }

  /* ── Two-column ── */
  .two-col { display: flex; gap: 16px; }

  /* ── Empty state ── */
  .empty { color: #9ca3af; font-style: italic; font-size: 11px; margin: 8px 0; }

  /* ── Footer ── */
  .report-footer {
    margin-top: 40px;
    padding: 16px 48px;
    border-top: 1px solid #e5e7eb;
    font-size: 10px;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
  }

  /* ── Print ── */
  @page {
    size: A4;
    margin: 15mm 12mm;
  }
  @media print {
    .cover    { padding: 0 0 24px; }
    .content  { padding: 0; }
    .section  { page-break-inside: avoid; }
    .kpi-grid { page-break-inside: avoid; }
    table     { page-break-inside: auto; }
    tr        { page-break-inside: avoid; page-break-after: auto; }
    thead     { display: table-header-group; }
    .report-footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; }
  }
</style>
</head>
<body>

<div class="cover">
  ${logoSVG.replace('width="72" height="72"', 'class="cover-logo" width="80" height="80"')}
  <p class="cover-church">${CHURCH}</p>
  <div class="cover-divider"></div>
  <p class="cover-title">Annual Financial &amp; Operations Report — ${year}</p>
  <p class="cover-meta">
    Generated: ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp;
    Confidential — for committee use only
  </p>
</div>

<div class="content">
  ${summarySection}
  ${monthlySection}
  ${byTypeSection}
  ${welfareSection}
  ${expensesSection}
  ${projectsSection}
  ${topSection}
  ${growthSection}
  ${operationsSection}
</div>

<div class="report-footer">
  <span>${CHURCH} Welfare Management System</span>
  <span>Annual Report ${year}</span>
  <span>Confidential</span>
</div>

<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 400);
  });
</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups for this site to export the PDF report, then try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
