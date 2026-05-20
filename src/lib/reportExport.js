import * as XLSX from 'xlsx';
import { CHURCH_NAME } from './constants';

/**
 * Build and download a multi-sheet Excel workbook for the annual report.
 * `report` is the assembled data object from the Reports page.
 */
export function exportReportExcel(report) {
  const { year, summary, byMonth, byType, welfareByCat, expensesByCat, topContributors } = report;
  const wb = XLSX.utils.book_new();

  // ---- Summary sheet ----
  const summaryAOA = [
    [`${CHURCH_NAME} — Annual Financial Report`],
    [`Year: ${year}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['SUMMARY', 'Amount (KSh)'],
    ['Total Contributions (In)', summary.totalContrib],
    ['Welfare Disbursed (Out)', summary.totalWelfare],
    ['General Expenses (Out)', summary.totalGeneralExpenses],
    ['Project Expenses (Out)', summary.totalProjectExpenses],
    ['Total Out', summary.totalOut],
    ['Net Position', summary.netPosition],
    [],
    ['Number of contribution entries', summary.contribCount],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ---- Monthly sheet ----
  const monthlyAOA = [
    ['Month', 'Contributions (KSh)'],
    ...byMonth.map((m) => [m.name, m.total]),
    ['TOTAL', byMonth.reduce((s, m) => s + m.total, 0)],
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyAOA);
  wsMonthly['!cols'] = [{ wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly');

  // ---- By Type sheet ----
  const typeAOA = [
    ['Contribution Type', 'Amount (KSh)'],
    ...byType.map((t) => [t.name, t.value]),
  ];
  const wsType = XLSX.utils.aoa_to_sheet(typeAOA);
  wsType['!cols'] = [{ wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsType, 'By Type');

  // ---- Welfare sheet ----
  const welfareAOA = [
    ['Welfare Category', 'Disbursed (KSh)'],
    ...welfareByCat.map((w) => [w.name, w.value]),
    ['TOTAL', welfareByCat.reduce((s, w) => s + w.value, 0)],
  ];
  const wsWelfare = XLSX.utils.aoa_to_sheet(welfareAOA);
  wsWelfare['!cols'] = [{ wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsWelfare, 'Welfare');

  // ---- Expenses sheet ----
  const expensesAOA = [
    ['Expense Category', 'Amount (KSh)'],
    ...expensesByCat.map((e) => [e.name, e.value]),
    ['TOTAL', expensesByCat.reduce((s, e) => s + e.value, 0)],
  ];
  const wsExpenses = XLSX.utils.aoa_to_sheet(expensesAOA);
  wsExpenses['!cols'] = [{ wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  // ---- Top Contributors sheet ----
  const topAOA = [
    ['Rank', 'Member', 'Total (KSh)'],
    ...topContributors.map((c, i) => [i + 1, c.name, c.total]),
  ];
  const wsTop = XLSX.utils.aoa_to_sheet(topAOA);
  wsTop['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsTop, 'Top Contributors');

  XLSX.writeFile(wb, `${CHURCH_NAME.replace(/\s+/g, '-').toLowerCase()}-report-${year}.xlsx`);
}

/**
 * Open a clean, print-optimized report in a new window and trigger the
 * browser's print dialog (which offers "Save as PDF").
 */
export function exportReportPDF(report) {
  const { year, summary, byMonth, byType, welfareByCat, expensesByCat, topContributors } = report;
  const fmt = (n) => 'KSh ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 });

  const row = (label, value, opts = {}) =>
    `<tr${opts.bold ? ' style="font-weight:600"' : ''}>
       <td>${label}</td>
       <td style="text-align:right">${fmt(value)}</td>
     </tr>`;

  const monthlyRows = byMonth.map((m) =>
    `<tr><td>${m.name}</td><td style="text-align:right">${fmt(m.total)}</td></tr>`).join('');
  const typeRows = byType.map((t) =>
    `<tr><td>${t.name}</td><td style="text-align:right">${fmt(t.value)}</td></tr>`).join('') || '<tr><td colspan="2">No data</td></tr>';
  const welfareRows = welfareByCat.map((w) =>
    `<tr><td>${w.name}</td><td style="text-align:right">${fmt(w.value)}</td></tr>`).join('') || '<tr><td colspan="2">No disbursements</td></tr>';
  const expenseRows = expensesByCat.map((e) =>
    `<tr><td>${e.name}</td><td style="text-align:right">${fmt(e.value)}</td></tr>`).join('') || '<tr><td colspan="2">No expenses</td></tr>';
  const topRows = topContributors.map((c, i) =>
    `<tr><td>${i + 1}</td><td>${c.name}</td><td style="text-align:right">${fmt(c.total)}</td></tr>`).join('') || '<tr><td colspan="3">No contributions</td></tr>';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${CHURCH_NAME} Welfare Management System - Annual Report ${year}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 40px; line-height: 1.5; }
  h1 { font-size: 24px; margin: 0 0 4px; color: #0F4A3C; }
  h2 { font-size: 15px; margin: 28px 0 10px; color: #0F4A3C; border-bottom: 2px solid #D4A24E; padding-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  th, td { padding: 6px 10px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #f4efe6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
  .summary td:last-child, .summary th:last-child { text-align: right; }
  .net { font-size: 16px; font-weight: 700; }
  .net.positive { color: #0F4A3C; }
  .net.negative { color: #b91c1c; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { margin: 20px; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
</style>
</head>
<body>

  <h1>${CHURCH_NAME}</h1>
  <p class="sub">Annual Financial Report — ${year}</p>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

  <h2>Financial Summary</h2>
  <table class="summary">
    <tr><td>Total Contributions (Money In)</td><td style="text-align:right">${fmt(summary.totalContrib)}</td></tr>
    <tr><td>Welfare Disbursed</td><td style="text-align:right">${fmt(summary.totalWelfare)}</td></tr>
    <tr><td>General Expenses</td><td style="text-align:right">${fmt(summary.totalGeneralExpenses)}</td></tr>
    <tr><td>Project Expenses</td><td style="text-align:right">${fmt(summary.totalProjectExpenses)}</td></tr>
    <tr style="font-weight:600"><td>Total Money Out</td><td style="text-align:right">${fmt(summary.totalOut)}</td></tr>
    <tr><td colspan="2" style="padding-top:10px">
      <span class="net ${summary.netPosition < 0 ? 'negative' : 'positive'}">
        Net Position: ${summary.netPosition < 0 ? '−' : ''}${fmt(Math.abs(summary.netPosition))}
      </span>
    </td></tr>
  </table>

  <h2>Monthly Contributions</h2>
  <table>
    <thead><tr><th>Month</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${monthlyRows}</tbody>
  </table>

  <h2>Contributions by Type</h2>
  <table>
    <thead><tr><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${typeRows}</tbody>
  </table>

  <h2>Welfare by Category</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Disbursed</th></tr></thead>
    <tbody>${welfareRows}</tbody>
  </table>

  <h2>General Expenses by Category</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>

  <h2>Top Contributors</h2>
  <table>
    <thead><tr><th>Rank</th><th>Member</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>

  <p class="footer">${CHURCH_NAME} Welfare Management System · Confidential — for committee use</p>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export the PDF report.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
