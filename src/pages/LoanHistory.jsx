import { useState, useEffect, useRef, useCallback } from 'react';
import { renewBook } from '../services/firestore';
import { useLibraryData } from '../context/LibraryDataContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { calculateFine, calcOverdueDays } from '../services/settings';
import { sendLibraryEmail, REMINDER_TYPES } from '../services/emailReminders';
import { useToast } from '../context/ToastContext';
import { Search, Download, History, X, RefreshCw, Mail } from 'lucide-react';

function StatusBadge({ status }) {
  const map = {
    issued:   { color: '#60a5fa', bg: 'rgba(30,58,95,0.5)',   border: 'rgba(37,99,235,0.3)' },
    Issued:   { color: '#60a5fa', bg: 'rgba(30,58,95,0.5)',   border: 'rgba(37,99,235,0.3)' },
    returned: { color: '#6ee7b7', bg: 'rgba(6,78,59,0.5)',    border: 'rgba(4,120,87,0.3)'  },
    Returned: { color: '#6ee7b7', bg: 'rgba(6,78,59,0.5)',    border: 'rgba(4,120,87,0.3)'  },
    overdue:  { color: '#fca5a5', bg: 'rgba(127,29,29,0.5)',  border: 'rgba(185,28,28,0.3)' },
    Overdue:  { color: '#fca5a5', bg: 'rgba(127,29,29,0.5)',  border: 'rgba(185,28,28,0.3)' },
  };
  const s = map[status] || { color: '#9ca3af', bg: 'rgba(55,65,81,0.5)', border: 'rgba(75,85,99,0.3)' };
  return (
    <span style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[130, 100, 80, 80, 80, 80, 70, 70].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded bg-[#1e2330]" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function computeStatus(loan) {
  if (loan.status === 'returned' || loan.status === 'Returned') return 'returned';
  if (loan.dueDate && new Date(loan.dueDate) < new Date(new Date().toDateString())) return 'Overdue';
  return 'issued';
}

export default function LoanHistory() {
  const toast        = useToast();
  const { settings } = useSettings();
  const { canRenewBooks, canSendReminders } = useAuth();

  const { issuedBooks: loans, loading } = useLibraryData();
  const [searchInput, setSearchInput]   = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [renewingId, setRenewingId]     = useState(null);
  const [remindingId, setRemindingId]   = useState(null);
  const debounceRef = useRef(null);

  const handleSearch = useCallback(val => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val), 300);
  }, []);

  const handleRenew = async (loan) => {
    setRenewingId(loan.id);
    try {
      await renewBook(loan.id);
      toast.success(`Loan renewed for "${loan.bookTitle || loan.book}".`);
    } catch (err) {
      toast.error(err.message || 'Failed to renew book.');
    } finally {
      setRenewingId(null);
    }
  };

  const handleRemind = async (loan) => {
    const email = loan.studentEmail || loan.email;
    if (!email) {
      toast.info(`No email recorded for ${loan.studentName || 'student'}.`);
      return;
    }
    setRemindingId(loan.id);
    try {
      const isOverdue = loan.computedStatus === 'Overdue';
      const res = await sendLibraryEmail({
        to: email,
        studentName: loan.studentName || loan.member,
        bookTitle: loan.bookTitle || loan.book,
        type: isOverdue ? REMINDER_TYPES.OVERDUE : REMINDER_TYPES.DUE_SOON,
        dueDate: loan.dueDate,
        daysOverdue: isOverdue ? calcOverdueDays(loan.dueDate) : 0,
        fine: isOverdue ? calculateFine(loan.dueDate, settings) : 0,
        issueId: loan.id,
      });

      if (res.success) toast.success(res.message);
      else toast.info(res.message);
    } catch {
      toast.error('Failed to send reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  const withStatus = loans.map(l => ({ ...l, computedStatus: computeStatus(l) }));

  const filtered = withStatus.filter(l => {
    const q = searchQuery.toLowerCase();
    const title   = (l.bookTitle || l.book || '').toLowerCase();
    const student = (l.studentName || l.member || '').toLowerCase();
    const sid     = (l.studentIdNo || l.rollNo || '').toLowerCase();
    const matchQ  = !q || title.includes(q) || student.includes(q) || sid.includes(q);
    const matchS  = statusFilter === 'All' || l.computedStatus.toLowerCase() === statusFilter.toLowerCase();
    return matchQ && matchS;
  });

  const totalFines = filtered.reduce((s, l) => s + (Number(l.fine) || 0), 0);

  const exportCSV = () => {
    const rows = [
      ['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Return Date', 'Status', 'Fine'],
      ...filtered.map(l => [
        l.bookTitle || l.book, l.studentName || l.member,
        l.studentIdNo || l.rollNo, l.issueDate, l.dueDate,
        l.returnDate || l.returned || '', l.computedStatus,
        l.fine > 0 ? `₹${l.fine}` : '—',
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)),
    ];
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map(r => r.join(',')).join('\n'))}`;
    a.download = 'loan-history.csv'; a.click();
    toast.success('CSV exported.');
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Loan History</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">
            {loans.length} total transactions{totalFines > 0 ? ` · ₹${totalFines} in fines` : ''}
          </p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
          <input
            value={searchInput} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by book or student…"
            className="w-full pl-9 pr-8 py-2 bg-[#131720] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm rounded-lg outline-none focus:border-[#374151]"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); handleSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        {['All', 'issued', 'Overdue', 'returned'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${statusFilter === s ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a623]/10' : 'border-[#1e2330] text-[#6b7280] hover:bg-[#131720]'}`}>
            {s === 'issued' ? 'Active' : s === 'returned' ? 'Returned' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-[#1e2330]">
                {['Book', 'Student', 'Student ID', 'Issue Date', 'Due Date', 'Returned', 'Status', 'Fine', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center">
                  <History size={32} className="mx-auto text-[#374151] mb-3" />
                  <p className="text-[#6b7280] text-sm font-medium">No transactions found</p>
                  <p className="text-[#4b5563] text-xs mt-1">Loan history appears here once books are issued.</p>
                </td></tr>
              )}
              {filtered.map(loan => {
                const isActive = loan.computedStatus !== 'returned';
                const od = isActive ? calcOverdueDays(loan.dueDate) : 0;
                const renewals = loan.renewalCount || 0;
                const canRenew = isActive && renewals < (settings.renewalLimit ?? 2) && (!settings.preventOverdueRenewal || od === 0);

                return (
                  <tr key={loan.id} className="border-b border-[#1e2330] last:border-0 hover:bg-[#1a2035] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white text-sm font-medium">{loan.bookTitle || loan.book}</div>
                      <div className="text-[#6b7280] text-xs">{loan.bookAuthor}</div>
                    </td>
                    <td className="px-4 py-3 text-[#d1d5db] text-sm">{loan.studentName || loan.member}</td>
                    <td className="px-4 py-3 text-[#f5a623] text-xs font-mono">{loan.studentIdNo || loan.rollNo || '—'}</td>
                    <td className="px-4 py-3 text-[#9ca3af] text-sm">{loan.issueDate}</td>
                    <td className="px-4 py-3 text-[#9ca3af] text-sm">{loan.dueDate}</td>
                    <td className="px-4 py-3 text-[#9ca3af] text-sm">{loan.returnDate || loan.returned || <span className="text-[#4b5563]">—</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={loan.computedStatus} /></td>
                    <td className="px-4 py-3">
                      {(() => {
                        const isReturned = loan.computedStatus === 'returned';
                        const fineAmt    = isReturned
                          ? (Number(loan.fine) || 0)
                          : calculateFine(loan.dueDate, settings);
                        return fineAmt > 0
                          ? <span className="text-[#ef4444] text-sm font-semibold">₹{fineAmt}{!isReturned && <span className="text-[10px] text-[#6b7280] ml-1">(live)</span>}</span>
                          : <span className="text-[#4b5563] text-sm">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          {canRenewBooks() && (
                            <button
                              onClick={() => handleRenew(loan)}
                              disabled={!canRenew || renewingId === loan.id}
                              className="px-2 py-1 text-xs border border-[#374151] text-[#d1d5db] rounded hover:bg-[#1e2330] disabled:opacity-40 transition-colors"
                              title={!canRenew ? 'Renewal limit reached or overdue' : 'Renew loan'}
                            >
                              {renewingId === loan.id ? '…' : 'Renew'}
                            </button>
                          )}
                          {canSendReminders() && (loan.studentEmail || loan.email) && (
                            <button
                              onClick={() => handleRemind(loan)}
                              disabled={remindingId === loan.id}
                              className="p-1 text-[#60a5fa] hover:bg-blue-950/40 rounded transition-colors"
                              title="Send Reminder"
                            >
                              <Mail size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[#4b5563] text-xs mt-3">Showing {filtered.length} of {loans.length} records</p>
    </div>
  );
}
