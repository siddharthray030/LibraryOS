import { useState, useEffect } from 'react';
import { subscribeIssuedBooks } from '../services/firestore';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { calcOverdueDays, calculateFine } from '../services/settings';
import { sendLibraryEmail, REMINDER_TYPES } from '../services/emailReminders';
import { AlertTriangle, Download, Search, X, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#1e2330]">
      {[120, 100, 80, 80, 60, 70, 70].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 rounded bg-[#1e2330]" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function Overdue() {
  const { settings } = useSettings();
  const { canSendReminders } = useAuth();
  const toast        = useToast();

  const [issued, setIssued]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sendingId, setSendingId]     = useState(null);

  useEffect(() => {
    const unsub = subscribeIssuedBooks(data => { setIssued(data); setLoading(false); });
    return unsub;
  }, []);

  // Only active (not returned) issues that are past due date
  const overdueRecords = issued
    .filter(l => {
      if (l.status === 'returned' || l.status === 'Returned') return false;
      return l.dueDate && calcOverdueDays(l.dueDate) > 0;
    })
    .map(l => ({
      ...l,
      overdueDays: calcOverdueDays(l.dueDate),
      fineAmount:  calculateFine(l.dueDate, settings),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays);

  const filtered = overdueRecords.filter(l => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (l.bookTitle || '').toLowerCase().includes(q) ||
      (l.studentName || '').toLowerCase().includes(q) ||
      (l.studentIdNo || '').toLowerCase().includes(q)
    );
  });

  const totalFines = filtered.reduce((s, l) => s + l.fineAmount, 0);

  const handleSendReminder = async (record) => {
    // Determine student email: check record or prompt
    const studentEmail = record.studentEmail || record.email;
    if (!studentEmail) {
      toast.info(`No email recorded for ${record.studentName || 'student'}. View student profile to update email.`);
      return;
    }

    setSendingId(record.id);
    try {
      const res = await sendLibraryEmail({
        to:          studentEmail,
        studentName: record.studentName || 'Student',
        bookTitle:   record.bookTitle   || 'Book',
        type:        REMINDER_TYPES.OVERDUE,
        dueDate:     record.dueDate,
        daysOverdue: record.overdueDays,
        fine:        record.fineAmount,
        issueId:     record.id,
      });

      if (res.success) {
        toast.success(`Overdue reminder sent to ${studentEmail}.`);
      } else {
        toast.info(res.message);
      }
    } catch {
      toast.error('Failed to send email reminder.');
    } finally {
      setSendingId(null);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Days Overdue', 'Fine (₹)'],
      ...filtered.map(l => [
        l.bookTitle || '', l.studentName || '',
        l.studentIdNo || '', l.issueDate, l.dueDate,
        l.overdueDays, l.fineAmount,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)),
    ];
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map(r => r.join(',')).join('\n'))}`;
    a.download = 'overdue-books.csv';
    a.click();
    toast.success('CSV exported.');
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Overdue Books</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">
            {loading ? 'Loading…' : `${overdueRecords.length} overdue · Fine: ₹${settings.finePerDay}/day${settings.gracePeriod > 0 ? ` · ${settings.gracePeriod}d grace` : ''}`}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary banner */}
      {!loading && overdueRecords.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-5 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-[#ef4444] flex-shrink-0" />
            <div>
              <span className="text-[#ef4444] font-semibold text-sm">{overdueRecords.length} overdue books</span>
              <span className="text-[#9ca3af] text-sm"> · Outstanding fines: </span>
              <span className="text-[#f5a623] font-semibold text-sm">₹{totalFines}</span>
            </div>
          </div>
          <div className="bg-[#131720] border border-[#1e2330] rounded-xl px-5 py-3 text-sm text-[#9ca3af]">
            Max fine cap: <span className="text-white font-semibold">₹{settings.maximumFine}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
        <input
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value); }}
          placeholder="Search book, student, ID…"
          className="w-full pl-9 pr-8 py-2 bg-[#131720] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm rounded-lg outline-none focus:border-[#374151]"
        />
        {searchInput && (
          <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-white">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#1e2330]">
                {['Book', 'Student', 'Issue Date', 'Due Date', 'Days Overdue', 'Fine', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [0,1,2,3,4].map(i => <SkeletonRow key={i} />)}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">🎉</span>
                    <p className="text-[#6b7280] text-sm font-medium">
                      {search ? 'No overdue books match your search.' : 'No overdue books!'}
                    </p>
                    {!search && <p className="text-[#4b5563] text-xs">All issued books are within their due dates.</p>}
                  </div>
                </td></tr>
              )}

              {!loading && filtered.map(record => (
                <tr key={record.id} className="border-b border-[#1e2330] last:border-0 hover:bg-[#1a2035] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="text-white text-sm font-medium">{record.bookTitle || record.book}</div>
                    <div className="text-[#6b7280] text-xs">{record.bookAuthor || ''}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-[#d1d5db] text-sm">{record.studentName || record.member}</div>
                    <div className="text-[#f5a623] text-xs font-mono">{record.studentIdNo || record.rollNo || ''}</div>
                  </td>
                  <td className="px-4 py-3.5 text-[#9ca3af] text-sm">{record.issueDate}</td>
                  <td className="px-4 py-3.5 text-[#ef4444] text-sm font-medium">{record.dueDate}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 bg-red-950/50 border border-red-800/40 text-[#ef4444] text-xs font-bold px-2.5 py-1 rounded-full">
                      <AlertTriangle size={10} />
                      {record.overdueDays}d overdue
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[#f5a623] font-semibold text-sm">₹{record.fineAmount}</span>
                    {record.fineAmount >= settings.maximumFine && (
                      <span className="ml-1 text-[#9ca3af] text-[10px]">(max)</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {canSendReminders() && (
                      <button
                        onClick={() => handleSendReminder(record)}
                        disabled={sendingId === record.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-blue-800/40 text-[#60a5fa] hover:bg-blue-950/40 rounded-lg transition-colors disabled:opacity-50"
                        title="Send Overdue Notice"
                      >
                        <Mail size={12} /> {sendingId === record.id ? 'Sending…' : 'Remind'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && (
        <p className="text-[#4b5563] text-xs mt-3">
          Showing {filtered.length} of {overdueRecords.length} overdue records
        </p>
      )}
    </div>
  );
}
