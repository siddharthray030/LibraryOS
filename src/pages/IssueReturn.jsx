import { useState, useEffect } from 'react';
import {
  subscribeIssuedBooks, subscribeBooks, subscribeStudents,
  issueBook, returnBook, renewBook,
} from '../services/firestore';
import { useSettings } from '../context/SettingsContext';
import { calculateFine, calcOverdueDays } from '../services/settings';
import { useToast } from '../context/ToastContext';
import BookScannerModal from '../components/scanner/BookScannerModal';
import {
  BookOpen, Users, CheckCircle,
  Search, AlertTriangle, RefreshCw,
  Barcode as BarcodeIcon, ShieldAlert,
} from 'lucide-react';

export default function IssueReturn() {
  const toast        = useToast();
  const { settings } = useSettings();

  const [tab, setTab]         = useState('issue');
  const [issued, setIssued]   = useState([]);
  const [books, setBooks]     = useState([]);
  const [students, setStudents] = useState([]);

  // Issue form
  const [selBook, setSelBook]         = useState(null);
  const [selStudent, setSelStudent]   = useState(null);
  const [bookSearch, setBookSearch]   = useState('');
  const [stuSearch, setStuSearch]     = useState('');
  const [showBookDD, setShowBookDD]   = useState(false);
  const [showStuDD, setShowStuDD]     = useState(false);
  const [dueDate, setDueDate]         = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (settings?.defaultLoanDuration ?? settings?.loanPeriodDays ?? 14));
    return d.toISOString().slice(0, 10);
  });

  const [issuing, setIssuing]         = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [renewingId, setRenewingId]   = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Update default due date when settings change
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + (settings.defaultLoanDuration ?? settings.loanPeriodDays ?? 14));
    setDueDate(d.toISOString().slice(0, 10));
  }, [settings.defaultLoanDuration, settings.loanPeriodDays]);

  useEffect(() => {
    const u1 = subscribeIssuedBooks(setIssued);
    const u2 = subscribeBooks(setBooks);
    const u3 = subscribeStudents(setStudents);
    return () => { u1(); u2(); u3(); };
  }, []);

  const activeIssues   = issued.filter(l => l.status === 'issued' || l.status === 'Issued');
  const availableBooks = books.filter(b => (b.availableQuantity ?? b.available ?? 0) > 0);

  const filteredBooks = availableBooks.filter(b =>
    b.title?.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author?.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.isbn?.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.barcode?.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.libraryId?.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(stuSearch.toLowerCase()) ||
    (s.studentId || s.rollNo)?.toLowerCase().includes(stuSearch.toLowerCase())
  );

  const handleIssue = async () => {
    if (!selBook)    { toast.error('Please select a book.'); return; }
    if (!selStudent) { toast.error('Please select a student.'); return; }

    // Check student status
    const stuStatus = (selStudent.status || 'ACTIVE').toUpperCase();
    if (stuStatus === 'BLOCKED') {
      toast.error('Cannot issue book: Student account is BLOCKED.');
      return;
    }
    if (stuStatus === 'SUSPENDED') {
      toast.error('Cannot issue book: Student account is SUSPENDED.');
      return;
    }

    if (!dueDate) { toast.error('Please set a due date.'); return; }
    if (new Date(dueDate) <= new Date(new Date().toDateString())) {
      toast.error('Due date must be in the future.');
      return;
    }

    setIssuing(true);
    try {
      await issueBook({
        bookId:      selBook.id,
        studentId:   selStudent.id,
        bookTitle:   selBook.title,
        studentName: selStudent.name,
        studentIdNo: selStudent.studentId || selStudent.rollNo,
        issueDate:   new Date().toISOString().slice(0, 10),
        dueDate,
      });
      toast.success(`"${selBook.title}" issued to ${selStudent.name}.`);
      setSelBook(null);
      setSelStudent(null);
      setBookSearch('');
      setStuSearch('');
      const d = new Date();
      d.setDate(d.getDate() + (settings.defaultLoanDuration ?? 14));
      setDueDate(d.toISOString().slice(0, 10));
    } catch (err) {
      toast.error(err.message || 'Failed to issue book.');
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = async (record) => {
    setReturningId(record.id);
    try {
      await returnBook(record.id, record.bookId);
      const fine = calculateFine(record.dueDate, settings);
      toast.success(`"${record.bookTitle || record.book}" returned.${fine > 0 ? ` Fine: ₹${fine}` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Failed to return book.');
    } finally {
      setReturningId(null);
    }
  };

  const handleRenew = async (record) => {
    setRenewingId(record.id);
    try {
      await renewBook(record.id);
      toast.success(`"${record.bookTitle || record.book}" successfully renewed.`);
    } catch (err) {
      toast.error(err.message || 'Failed to renew book.');
    } finally {
      setRenewingId(null);
    }
  };

  // Callback when scanner selects a book
  const handleScannerBookFound = (scannedBook) => {
    setSelBook(scannedBook);
    setBookSearch(scannedBook.title);
    setTab('issue');
    toast.info(`Selected "${scannedBook.title}" from scanner.`);
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Circulation Desk</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">
            Default Loan: {settings.defaultLoanDuration ?? 14} days · Fine: ₹{settings.finePerDay}/day · Renewal limit: {settings.renewalLimit ?? 2} · {activeIssues.length} currently issued
          </p>
        </div>

        {/* Scan Book Button */}
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#131720] border border-[#f5a623]/40 text-[#f5a623] hover:bg-[#1a2035] text-xs font-bold rounded-xl transition-colors shadow-lg"
        >
          <BarcodeIcon size={16} /> Scan Barcode / QR
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'issue',  label: '↑ Issue Book' },
          { id: 'return', label: '✓ Return & Renew' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-[#f5a623] text-black' : 'border border-[#1e2330] text-[#9ca3af] hover:bg-[#131720]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left panel ── */}
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-5">
          <h2 className="text-white font-semibold text-base mb-5">
            {tab === 'issue' ? 'Issue a Book' : 'Return or Renew a Book'}
          </h2>

          {/* ISSUE TAB */}
          {tab === 'issue' && (
            <div className="space-y-4">
              {/* Book search */}
              <div className="relative">
                <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                  Select Book (Search Title, ISBN, Barcode, or ID)
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
                  <input
                    value={selBook ? selBook.title : bookSearch}
                    onChange={e => { setBookSearch(e.target.value); setSelBook(null); setShowBookDD(true); }}
                    onFocus={() => setShowBookDD(true)}
                    onBlur={() => setTimeout(() => setShowBookDD(false), 180)}
                    placeholder="Search available books…"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0b0f1a] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm rounded-xl outline-none focus:border-[#f5a623]"
                  />
                </div>
                {showBookDD && filteredBooks.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-[#1a2035] border border-[#374151] rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                    {filteredBooks.slice(0, 8).map(b => {
                      const avail = b.availableQuantity ?? b.available ?? 0;
                      const isLow = avail <= (settings.lowStockThreshold ?? 2);
                      return (
                        <button
                          key={b.id}
                          onMouseDown={() => { setSelBook(b); setBookSearch(b.title); setShowBookDD(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#131720] transition-colors border-b border-[#1e2330] last:border-0"
                        >
                          <span className="text-white font-medium block">{b.title}</span>
                          <span className="text-[#6b7280] text-xs">
                            {b.author} · <span className="font-mono text-[#9ca3af]">ID: {b.libraryId || b.isbn || '—'}</span> · {avail} copies
                            {isLow && <span className="ml-1.5 text-[#f5a623] font-semibold">⚠ Low stock</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Student search with status check */}
              <div className="relative">
                <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                  Select Student
                </label>
                <div className="relative">
                  <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
                  <input
                    value={selStudent ? selStudent.name : stuSearch}
                    onChange={e => { setStuSearch(e.target.value); setSelStudent(null); setShowStuDD(true); }}
                    onFocus={() => setShowStuDD(true)}
                    onBlur={() => setTimeout(() => setShowStuDD(false), 180)}
                    placeholder="Search student by name or ID…"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0b0f1a] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm rounded-xl outline-none focus:border-[#f5a623]"
                  />
                </div>
                {showStuDD && filteredStudents.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-[#1a2035] border border-[#374151] rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                    {filteredStudents.slice(0, 8).map(s => {
                      const status = (s.status || 'ACTIVE').toUpperCase();
                      const isBlocked = status === 'BLOCKED';
                      const isSuspended = status === 'SUSPENDED';

                      return (
                        <button
                          key={s.id}
                          disabled={isBlocked || isSuspended}
                          onMouseDown={() => {
                            if (!isBlocked && !isSuspended) {
                              setSelStudent(s);
                              setStuSearch(s.name);
                              setShowStuDD(false);
                            }
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-[#1e2330] last:border-0 ${
                            isBlocked || isSuspended
                              ? 'opacity-50 cursor-not-allowed bg-[#181115]'
                              : 'hover:bg-[#131720]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{s.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isBlocked ? 'text-[#ef4444] bg-red-950/60' : isSuspended ? 'text-[#f5a623] bg-amber-950/60' : 'text-[#10b981] bg-emerald-950/60'
                            }`}>
                              {status}
                            </span>
                          </div>
                          <span className="text-[#6b7280] text-xs">
                            {s.studentId || s.rollNo} · {s.course || s.class}
                            {(isBlocked || isSuspended) && ` — Account is ${status}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Due date */}
              <div>
                <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                  Due Date ({settings.defaultLoanDuration ?? 14} days default)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-[#d1d5db] text-sm px-3 py-2.5 rounded-xl outline-none focus:border-[#f5a623]"
                />
              </div>

              {/* Summary card */}
              {(selBook || selStudent) && (
                <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-xl p-3.5 space-y-2 text-xs">
                  {selBook && (
                    <div className="flex justify-between">
                      <span className="text-[#6b7280]">Selected Book:</span>
                      <span className="text-white font-medium text-right max-w-[200px] truncate">{selBook.title}</span>
                    </div>
                  )}
                  {selStudent && (
                    <div className="flex justify-between">
                      <span className="text-[#6b7280]">Borrower:</span>
                      <span className="text-white font-medium">{selStudent.name} ({selStudent.studentId || '—'})</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#6b7280]">Scheduled Return Date:</span>
                    <span className="text-[#f5a623] font-bold font-mono">{dueDate}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleIssue}
                disabled={issuing}
                className="w-full py-2.5 bg-[#f5a623] text-black text-xs font-bold rounded-xl hover:bg-[#e09515] transition-colors disabled:opacity-50"
              >
                {issuing ? 'Processing Issue…' : 'Issue Book →'}
              </button>
            </div>
          )}

          {/* RETURN & RENEW TAB */}
          {tab === 'return' && (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {activeIssues.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle size={32} className="mx-auto text-[#374151] mb-3" />
                  <p className="text-[#6b7280] text-sm">No books currently issued.</p>
                </div>
              )}
              {activeIssues.map(record => {
                const od = calcOverdueDays(record.dueDate);
                const fine = od > 0 ? calculateFine(record.dueDate, settings) : 0;
                const renewals = record.renewalCount || 0;
                const maxRenewals = settings.renewalLimit ?? 2;
                const canRenewLoan = renewals < maxRenewals && (!settings.preventOverdueRenewal || od === 0);

                return (
                  <div
                    key={record.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      od > 0 ? 'bg-red-950/20 border-red-800/40' : 'bg-[#0b0f1a] border-[#1e2330]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-semibold truncate">{record.bookTitle || record.book}</div>
                      <div className="text-xs text-[#6b7280] mt-0.5">
                        {record.studentName || record.member} ({record.studentIdNo || '—'}) · Due {record.dueDate}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {od > 0 ? (
                          <span className="text-[#ef4444] text-[11px] font-bold">
                            ⚠️ {od}d overdue · Fine: ₹{fine}
                          </span>
                        ) : (
                          <span className="text-[#10b981] text-[11px]">On schedule</span>
                        )}
                        <span className="text-[10px] text-[#6b7280] bg-[#131720] px-1.5 py-0.5 rounded border border-[#1e2330]">
                          Renewed: {renewals}/{maxRenewals}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Renew button */}
                      <button
                        onClick={() => handleRenew(record)}
                        disabled={!canRenewLoan || renewingId === record.id}
                        title={!canRenewLoan ? (od > 0 ? 'Cannot renew overdue book' : 'Max renewal limit reached') : 'Renew loan'}
                        className="px-3 py-1.5 border border-[#374151] text-[#d1d5db] text-xs font-semibold rounded-lg hover:bg-[#1a2035] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {renewingId === record.id ? 'Renewing…' : 'Renew'}
                      </button>

                      {/* Return button */}
                      <button
                        onClick={() => handleReturn(record)}
                        disabled={returningId === record.id}
                        className="px-3 py-1.5 bg-[#10b981] text-black text-xs font-bold rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-50"
                      >
                        {returningId === record.id ? 'Returning…' : 'Return'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right panel: currently issued ── */}
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-base">
              Active Loans <span className="text-[#6b7280] font-normal text-sm">({activeIssues.length})</span>
            </h2>
            <span className="text-xs text-[#6b7280]">Live circulation</span>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 flex-1">
            {activeIssues.length === 0 && (
              <p className="text-[#6b7280] text-sm py-12 text-center">All books are accounted for.</p>
            )}
            {activeIssues.map(record => {
              const od = calcOverdueDays(record.dueDate);
              return (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    od > 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-[#0b0f1a] border-[#1e2330]'
                  }`}
                >
                  <div className="min-w-0 mr-2">
                    <div className="text-white text-xs font-semibold truncate">{record.bookTitle || record.book}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      {record.studentName || record.member} · Due {record.dueDate}
                    </div>
                  </div>
                  {od > 0 ? (
                    <span className="ml-2 shrink-0 flex items-center gap-1 bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <AlertTriangle size={9} /> {od}d
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#10b981] font-mono shrink-0">Active</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      <BookScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSelectBook={handleScannerBookFound}
        onIssueBook={handleScannerBookFound}
      />
    </div>
  );
}
