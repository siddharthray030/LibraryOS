import { useState, useEffect, useMemo } from 'react';
import { subscribeBooks, subscribeStudents, subscribeIssuedBooks } from '../services/firestore';
import { useSettings } from '../context/SettingsContext';
import { calculateFine, calcOverdueDays } from '../services/settings';
import { useToast } from '../context/ToastContext';
import { Download, FileText, Printer } from 'lucide-react';

// ── Date range helpers ────────────────────────────────────────────────────────
function getRange(rangeKey, custom) {
  const today = new Date(new Date().toDateString());
  if (rangeKey === 'today')      return [today, today];
  if (rangeKey === 'week') {
    const s = new Date(today); s.setDate(today.getDate() - 6);
    return [s, today];
  }
  if (rangeKey === 'month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return [s, today];
  }
  if (rangeKey === 'last_month') {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    return [s, e];
  }
  if (rangeKey === 'custom' && custom.from && custom.to) {
    return [new Date(custom.from), new Date(custom.to)];
  }
  return [null, null];
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
}

// ── Export helpers ────────────────────────────────────────────────────────────
function toCSV(headers, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

function downloadCSV(content, filename) {
  const a   = document.createElement('a');
  a.href    = `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
  a.download = filename;
  a.click();
}

function printReport(title, rangeLabel, headers, rows) {
  const tableRows = rows.map(r =>
    `<tr>${r.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${c ?? '—'}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${title} — LibraryOS</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; margin: 0; padding: 20px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 2px solid #f5a623; padding-bottom: 12px; }
  .logo { width: 40px; height: 40px; background: linear-gradient(135deg,#f5a623,#e08910); border-radius: 10px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; }
  h1 { margin: 0; font-size: 20px; } 
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; background: #f9fafb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">LI</div>
  <div>
    <h1>${title}</h1>
    <div class="meta">LibraryOS · Generated: ${new Date().toLocaleString('en-IN')} · Range: ${rangeLabel}</div>
  </div>
</div>
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</body>
</html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 300);
}

// ── Report card ───────────────────────────────────────────────────────────────
function ReportSection({ title, subtitle, rows, headers, csvName, reportTitle, rangeLabel }) {
  const toast = useToast();
  return (
    <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2330]">
        <div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <p className="text-[#4b5563] text-xs mt-0.5">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { downloadCSV(toCSV(headers, rows), csvName); toast.success('CSV exported.'); }}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[#374151] text-[#9ca3af] text-xs rounded-lg hover:bg-[#1e2330] transition-colors"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => printReport(reportTitle || title, rangeLabel, headers, rows)}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[#374151] text-[#9ca3af] text-xs rounded-lg hover:bg-[#1e2330] transition-colors"
          >
            <Printer size={12} /> PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2330]">
              {headers.map(h => (
                <th key={h} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-[#4b5563] text-sm">No data for this period.</td></tr>
            ) : (
              rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-[#1e2330] last:border-0 hover:bg-[#1a2035] transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 text-[#d1d5db] text-sm">{cell ?? '—'}</td>
                  ))}
                </tr>
              ))
            )}
            {rows.length > 50 && (
              <tr><td colSpan={headers.length} className="px-4 py-3 text-center text-[#4b5563] text-xs">
                Showing 50 of {rows.length} — export CSV for full data.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { value: 'today',      label: 'Today'      },
  { value: 'week',       label: 'This Week'  },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all',        label: 'All Time'   },
  { value: 'custom',     label: 'Custom'     },
];

export default function Reports() {
  const { settings } = useSettings();
  const [books,    setBooks]    = useState([]);
  const [students, setStudents] = useState([]);
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [rangeKey, setRangeKey] = useState('month');
  const [custom, setCustom]     = useState({ from: '', to: '' });

  useEffect(() => {
    let b = false, s = false, i = false;
    const done = () => { if (b && s && i) setLoading(false); };
    const u1 = subscribeBooks(d   => { setBooks(d);    b = true; done(); });
    const u2 = subscribeStudents(d => { setStudents(d); s = true; done(); });
    const u3 = subscribeIssuedBooks(d => { setIssues(d); i = true; done(); });
    return () => { u1(); u2(); u3(); };
  }, []);

  const [from, to] = useMemo(() => getRange(rangeKey, custom), [rangeKey, custom]);

  const rangeLabel = useMemo(() => {
    if (rangeKey === 'all') return 'All Time';
    if (!from) return 'All Time';
    if (from.getTime() === to?.getTime()) return from.toLocaleDateString('en-IN');
    return `${from.toLocaleDateString('en-IN')} – ${to?.toLocaleDateString('en-IN')}`;
  }, [rangeKey, from, to]);

  // Filter issues by date range
  const filteredIssues = useMemo(() => {
    if (rangeKey === 'all' || !from) return issues;
    return issues.filter(l => inRange(l.issueDate, from, to));
  }, [issues, from, to, rangeKey]);

  const filteredReturns = useMemo(() => {
    if (rangeKey === 'all' || !from) return issues.filter(l => l.status === 'returned' || l.status === 'Returned');
    return issues.filter(l => (l.status === 'returned' || l.status === 'Returned') && inRange(l.returnDate, from, to));
  }, [issues, from, to, rangeKey]);

  // A) Book inventory
  const inventoryRows = books.map(b => [
    b.title, b.author, b.isbn || '—', b.category || '—',
    b.totalQuantity ?? 0,
    b.availableQuantity ?? 0,
    (b.totalQuantity ?? 0) - (b.availableQuantity ?? 0),
  ]);

  // B) Currently issued (not date-filtered)
  const activeIssues = issues.filter(l => l.status === 'issued' || l.status === 'Issued');
  const issuedRows   = activeIssues.map(l => [
    l.bookTitle || '', l.studentName || '', l.studentIdNo || '—',
    l.issueDate, l.dueDate,
    calcOverdueDays(l.dueDate) > 0 ? `${calcOverdueDays(l.dueDate)}d overdue` : 'On time',
  ]);

  // C) Overdue
  const overdueList = issues.filter(l => {
    if (l.status === 'returned' || l.status === 'Returned') return false;
    return calcOverdueDays(l.dueDate) > 0;
  });
  const overdueRows = overdueList.map(l => [
    l.bookTitle || '', l.studentName || '', l.studentIdNo || '—',
    l.issueDate, l.dueDate,
    `${calcOverdueDays(l.dueDate)}d`,
    `₹${calculateFine(l.dueDate, settings)}`,
  ]);

  // D) Returned books (date-filtered)
  const returnedRows = filteredReturns.map(l => [
    l.bookTitle || '', l.studentName || '', l.studentIdNo || '—',
    l.issueDate, l.dueDate, l.returnDate || '—',
    l.fine > 0 ? `₹${l.fine}` : '—',
  ]);

  // E) Most borrowed
  const borrowCount = {};
  filteredIssues.forEach(l => {
    const t = l.bookTitle || l.book;
    if (t) borrowCount[t] = (borrowCount[t] || 0) + 1;
  });
  const mostBorrowedRows = Object.entries(borrowCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([title, count]) => [title, count]);

  // F) Most active students
  const stuCount = {};
  filteredIssues.forEach(l => {
    const k = l.studentName || l.member;
    if (k) stuCount[k] = (stuCount[k] || 0) + 1;
  });
  const activeStudentsRows = Object.entries(stuCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => [name, count]);

  // G) Fines
  const fineRows = filteredReturns
    .filter(l => (l.fine ?? 0) > 0)
    .map(l => [
      l.bookTitle || '', l.studentName || '', l.studentIdNo || '—',
      l.returnDate || '—', `₹${l.fine}`,
    ]);
  const totalFinesAmt = fineRows.reduce((s, r) => s + parseFloat((r[4] || '₹0').replace('₹', '')), 0);

  // H) Monthly circulation
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyMap = {};
  issues.forEach(l => {
    if (!l.issueDate) return;
    const key = l.issueDate.slice(0, 7);
    monthlyMap[key] = (monthlyMap[key] || 0) + 1;
  });
  const monthlyRows = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([ym, count]) => {
      const [y, m] = ym.split('-');
      return [`${months[parseInt(m) - 1]} ${y}`, count];
    });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
        <div className="mb-6">
          <div className="h-8 w-32 bg-[#1e2330] rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-[#1e2330] rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-[#131720] border border-[#1e2330] rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Reports</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">Library analytics and exportable reports</p>
        </div>
        <div className="flex items-center gap-2 text-[#6b7280] text-xs">
          <FileText size={13} />
          <span>Range: <span className="text-white">{rangeLabel}</span></span>
        </div>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRangeKey(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              rangeKey === opt.value
                ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a623]/10'
                : 'border-[#1e2330] text-[#6b7280] hover:bg-[#131720]'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={custom.from} onChange={e => setCustom(p => ({ ...p, from: e.target.value }))}
              className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-xs px-2 py-1.5 rounded-lg outline-none" />
            <span className="text-[#4b5563]">to</span>
            <input type="date" value={custom.to} onChange={e => setCustom(p => ({ ...p, to: e.target.value }))}
              className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-xs px-2 py-1.5 rounded-lg outline-none" />
          </div>
        )}
      </div>

      {/* Reports */}
      <div className="space-y-5">
        <ReportSection
          title="A. Book Inventory"
          subtitle={`${books.length} books in catalogue`}
          headers={['Title', 'Author', 'ISBN', 'Category', 'Total', 'Available', 'Issued']}
          rows={inventoryRows}
          csvName="report-inventory.csv"
          rangeLabel="All Time"
        />
        <ReportSection
          title="B. Currently Issued Books"
          subtitle={`${activeIssues.length} books currently out`}
          headers={['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Status']}
          rows={issuedRows}
          csvName="report-issued.csv"
          rangeLabel="Current"
        />
        <ReportSection
          title="C. Overdue Books"
          subtitle={`${overdueList.length} books overdue`}
          headers={['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Days Overdue', 'Fine']}
          rows={overdueRows}
          csvName="report-overdue.csv"
          rangeLabel="Current"
        />
        <ReportSection
          title="D. Returned Books"
          subtitle={`${filteredReturns.length} returns in range`}
          headers={['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Return Date', 'Fine']}
          rows={returnedRows}
          csvName="report-returned.csv"
          rangeLabel={rangeLabel}
        />
        <ReportSection
          title="E. Most Borrowed Books"
          subtitle={`Top books by borrow count (${rangeLabel})`}
          headers={['Book Title', 'Times Borrowed']}
          rows={mostBorrowedRows}
          csvName="report-most-borrowed.csv"
          rangeLabel={rangeLabel}
        />
        <ReportSection
          title="F. Most Active Students"
          subtitle={`Top borrowers (${rangeLabel})`}
          headers={['Student Name', 'Books Borrowed']}
          rows={activeStudentsRows}
          csvName="report-active-students.csv"
          rangeLabel={rangeLabel}
        />
        <ReportSection
          title="G. Fines Collected"
          subtitle={`₹${totalFinesAmt} in fines (${rangeLabel})`}
          headers={['Book', 'Student', 'Student ID', 'Return Date', 'Fine']}
          rows={fineRows}
          csvName="report-fines.csv"
          rangeLabel={rangeLabel}
        />
        <ReportSection
          title="H. Monthly Circulation"
          subtitle="Books issued per month (all time)"
          headers={['Month', 'Books Issued']}
          rows={monthlyRows}
          csvName="report-monthly.csv"
          rangeLabel="All Time"
        />
      </div>
    </div>
  );
}
