import { useState, useEffect, useRef, useCallback } from 'react';
import {
  subscribeStudents,
  addStudent, updateStudent, deleteStudent,
  studentIdExists, getStudentHistory, updateStudentStatus, renewBook,
} from '../services/firestore';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { calcOverdueDays, calculateFine } from '../services/settings';
import { sendLibraryEmail, REMINDER_TYPES } from '../services/emailReminders';
import {
  UserPlus, Download, Search, X,
  Pencil, Trash2, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight,
  Users, AlertTriangle, BookOpen, History,
  Mail, RefreshCw, ShieldAlert,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;
const EMPTY_FORM = { name: '', studentId: '', email: '', phone: '', course: '' };

const AVATAR_PALETTE = [
  '#7c3aed','#be185d','#b91c1c','#1d4ed8','#065f46',
  '#92400e','#0e7490','#7e22ce','#15803d','#c2410c',
];
function avatarColor(name = '') {
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-[#1e2330] animate-pulse">
      {[160, 80, 100, 80, 90, 70].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 rounded bg-[#1e2330]" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Validation ───────────────────────────────────────────────────────────────
function validate(form) {
  const e = {};
  if (!form.name.trim())      e.name      = 'Full name is required.';
  if (!form.studentId.trim()) e.studentId = 'Student ID is required.';
  if (!form.email.trim()) {
    e.email = 'Email is required.';
  } else if (!form.email.includes('@') || !form.email.includes('.')) {
    e.email = 'Enter a valid email address.';
  }
  if (!form.course.trim())    e.course    = 'Class / Course is required.';
  return e;
}

// Status badge for history panel
function StatusBadge({ status }) {
  const cfg = {
    issued:   { color: '#60a5fa', bg: 'rgba(30,58,95,0.5)',  border: 'rgba(37,99,235,0.3)' },
    Issued:   { color: '#60a5fa', bg: 'rgba(30,58,95,0.5)',  border: 'rgba(37,99,235,0.3)' },
    returned: { color: '#6ee7b7', bg: 'rgba(6,78,59,0.5)',   border: 'rgba(4,120,87,0.3)'  },
    Returned: { color: '#6ee7b7', bg: 'rgba(6,78,59,0.5)',   border: 'rgba(4,120,87,0.3)'  },
    overdue:  { color: '#fca5a5', bg: 'rgba(127,29,29,0.5)', border: 'rgba(185,28,28,0.3)' },
    Overdue:  { color: '#fca5a5', bg: 'rgba(127,29,29,0.5)', border: 'rgba(185,28,28,0.3)' },
  }[status] || { color: '#9ca3af', bg: 'rgba(55,65,81,0.5)', border: 'rgba(75,85,99,0.3)' };
  return (
    <span style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Students() {
  const toast        = useToast();
  const { settings } = useSettings();
  const { canDeleteStudents, canManageStudents, canChangeStudentStatus, canRenewBooks, canSendReminders } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('All');

  // Search + sort
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey]   = useState('name');
  const [sortDir, setSortDir]   = useState('asc');
  const debounceRef = useRef(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Modal
  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // History panel
  const [historyStudent, setHistoryStudent] = useState(null);
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [renewingId, setRenewingId]         = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);

  useEffect(() => {
    const unsub = subscribeStudents(data => { setStudents(data); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => { setPage(1); }, [searchQuery, sortKey, sortDir]);

  const handleSearchChange = useCallback(e => {
    setSearchInput(e.target.value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(e.target.value), 300);
  }, []);

  // Filter + sort
  const allFiltered = [...students]
    .filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentId || s.rollNo || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.course || s.class || '').toLowerCase().includes(q)
      );
      const matchesStatus = statusFilter === 'All' || (s.status || 'ACTIVE').toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const av = sortKey === 'joined' ? (a.joined || '') : (a.name || '');
      const bv = sortKey === 'joined' ? (b.joined || '') : (b.name || '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
  const pageStart  = (page - 1) * PAGE_SIZE;
  const pageStudents = allFiltered.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Add / Edit ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null); setForm(EMPTY_FORM); setErrors({}); setShowModal(true);
  };
  const openEdit = s => {
    setEditTarget(s);
    setForm({
      name:      s.name      || '',
      studentId: s.studentId || s.rollNo || '',
      email:     s.email     || '',
      phone:     s.phone     || s.contact || '',
      course:    s.course    || s.class   || '',
    });
    setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      // Duplicate studentId check
      const isDup = await studentIdExists(form.studentId.trim(), editTarget?.id);
      if (isDup) {
        setErrors(e => ({ ...e, studentId: 'This Student ID already exists.' }));
        setSaving(false);
        return;
      }
      if (editTarget) {
        await updateStudent(editTarget.id, form);
        toast.success('Student updated successfully.');
      } else {
        await addStudent(form);
        toast.success('Student registered successfully.');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save student.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStudent(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" removed.`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Borrowing history ────────────────────────────────────────────────────
  const openHistory = async student => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const records = await getStudentHistory(student.id);
      setHistory(records);
    } catch {
      toast.error('Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStatusChange = async (studentId, newStatus) => {
    try {
      await updateStudentStatus(studentId, newStatus);
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s));
      if (historyStudent && historyStudent.id === studentId) {
        setHistoryStudent(prev => ({ ...prev, status: newStatus }));
      }
      toast.success(`Student status updated to ${newStatus}.`);
    } catch {
      toast.error('Failed to update student status.');
    }
  };

  const handleRenewInHistory = async (record) => {
    setRenewingId(record.id);
    try {
      await renewBook(record.id);
      toast.success(`"${record.bookTitle || record.book}" loan renewed.`);
      if (historyStudent) {
        const records = await getStudentHistory(historyStudent.id);
        setHistory(records);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to renew book.');
    } finally {
      setRenewingId(null);
    }
  };

  const handleSendReminder = async (record) => {
    if (!historyStudent?.email) {
      toast.error('Student does not have an email address.');
      return;
    }
    setSendingReminderId(record.id);
    try {
      const isOverdue = calcOverdueDays(record.dueDate) > 0;
      const res = await sendLibraryEmail({
        to: historyStudent.email,
        studentName: historyStudent.name,
        bookTitle: record.bookTitle || record.book,
        type: isOverdue ? REMINDER_TYPES.OVERDUE : REMINDER_TYPES.DUE_SOON,
        dueDate: record.dueDate,
        daysOverdue: isOverdue ? calcOverdueDays(record.dueDate) : 0,
        fine: isOverdue ? calculateFine(record.dueDate, settings) : 0,
        issueId: record.id,
      });

      if (res.success) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err) {
      toast.error('Failed to send reminder.');
    } finally {
      setSendingReminderId(null);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Name','Student ID','Email','Phone','Course','Status','Joined'],
      ...students.map(s => [
        s.name, s.studentId || s.rollNo, s.email,
        s.phone || s.contact, s.course || s.class, s.status || 'ACTIVE', s.joined,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)),
    ];
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map(r => r.join(',')).join('\n'))}`;
    a.download = 'students.csv'; a.click();
    toast.success('CSV exported.');
  };

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Students</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">
            {loading ? 'Loading…' : `${students.length} registered student${students.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2330] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">
            <Download size={14} /> Export
          </button>
          {canManageStudents() && (
            <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] transition-colors">
              <UserPlus size={14} /> Register
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
          <input
            value={searchInput} onChange={handleSearchChange}
            placeholder="Search by name, student ID, email, class…"
            className="w-full bg-[#131720] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm pl-9 pr-8 py-2 rounded-lg outline-none focus:border-[#374151]"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearchQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#131720] border border-[#1e2330] p-1 rounded-lg text-xs">
          {['All', 'ACTIVE', 'SUSPENDED', 'BLOCKED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === st ? 'bg-[#f5a623] text-black font-bold' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {st === 'All' ? 'All Statuses' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[#4b5563] text-xs">Sort:</span>
          {[{ key: 'name', label: 'Name' }, { key: 'joined', label: 'Joined' }].map(({ key, label }) => (
            <button key={key} onClick={() => toggleSort(key)}
              className={`flex items-center gap-0.5 px-2.5 py-1 rounded text-xs border transition-colors ${
                sortKey === key ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a62310]' : 'border-[#1e2330] text-[#6b7280] hover:border-[#374151] hover:text-[#d1d5db]'
              }`}
            >
              {label}
              {sortKey === key
                ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                : <ChevronUp size={11} className="text-[#374151]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[#1e2330]">
              {['Name / Email', 'Student ID', 'Course', 'Status', 'Phone', 'Joined', 'Actions'].map(col => (
                <th key={col} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [0,1,2,3,4].map(i => <SkeletonRow key={i} />)}

            {!loading && pageStudents.length === 0 && (
              <tr><td colSpan={7}>
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#1e2330] flex items-center justify-center">
                    <Users size={24} className="text-[#4b5563]" />
                  </div>
                  <p className="text-[#d1d5db] text-sm font-medium">
                    {searchQuery ? 'No students match your search' : 'No students registered yet'}
                  </p>
                  <p className="text-[#4b5563] text-xs">
                    {searchQuery ? 'Try a different name or ID.' : 'Click "+ Register" to add a student.'}
                  </p>
                </div>
              </td></tr>
            )}

            {!loading && pageStudents.map(student => {
              const status = (student.status || 'ACTIVE').toUpperCase();
              return (
                <tr key={student.id}
                  className={`border-b border-[#1e2330] last:border-0 transition-colors ${deleteTarget?.id === student.id ? 'bg-[#1f1215]' : 'hover:bg-[#1a2035]'}`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none" style={{ backgroundColor: avatarColor(student.name) }}>
                        {initials(student.name)}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{student.name}</div>
                        <div className="text-[#4b5563] text-xs">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[#f5a623] text-sm font-mono">{student.studentId || student.rollNo || '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 bg-[#1e2330] text-[#d1d5db] text-xs rounded font-medium">
                      {student.course || student.class || '—'}
                    </span>
                  </td>
                  {/* Status Column */}
                  <td className="px-4 py-3.5">
                    {canChangeStudentStatus() ? (
                      <select
                        value={status}
                        onChange={e => handleStatusChange(student.id, e.target.value)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border outline-none bg-[#0b0f1a] cursor-pointer ${
                          status === 'BLOCKED'
                            ? 'text-[#ef4444] border-red-800/40'
                            : status === 'SUSPENDED'
                              ? 'text-[#f5a623] border-amber-800/40'
                              : 'text-[#10b981] border-emerald-800/40'
                        }`}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="BLOCKED">BLOCKED</option>
                      </select>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        status === 'BLOCKED'
                          ? 'text-[#ef4444] bg-red-950/40 border-red-800/40'
                          : status === 'SUSPENDED'
                            ? 'text-[#f5a623] bg-amber-950/40 border-amber-800/40'
                            : 'text-[#10b981] bg-emerald-950/40 border-emerald-800/40'
                      }`}>
                        {status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[#9ca3af] text-sm">{student.phone || student.contact || '—'}</td>
                  <td className="px-4 py-3.5 text-[#6b7280] text-sm whitespace-nowrap">{student.joined || '—'}</td>
                  <td className="px-4 py-3.5">
                    {deleteTarget?.id === student.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#ef4444] text-xs font-medium flex items-center gap-1">
                          <AlertTriangle size={12} /> Delete?
                        </span>
                        <button onClick={handleDelete} disabled={deleting}
                          className="px-2.5 py-1 bg-[#ef4444] text-white text-xs rounded hover:bg-[#dc2626] disabled:opacity-50 transition-colors">
                          {deleting ? 'Removing…' : 'Yes, delete'}
                        </button>
                        <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                          className="px-2.5 py-1 border border-[#374151] text-[#d1d5db] text-xs rounded hover:bg-[#1e2330] disabled:opacity-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => openHistory(student)} className="p-1.5 rounded hover:bg-[#1e2330] text-[#6b7280] hover:text-[#f5a623] transition-colors" title="Borrowing history">
                          <History size={14} />
                        </button>
                        {canManageStudents() && (
                          <button onClick={() => openEdit(student)} className="p-1.5 rounded hover:bg-[#1e2330] text-[#6b7280] hover:text-[#d1d5db] transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDeleteStudents() && (
                          <button onClick={() => setDeleteTarget({ id: student.id, name: student.name })} className="p-1.5 rounded hover:bg-[#2d1515] text-[#6b7280] hover:text-[#ef4444] transition-colors" title="Delete">
                            <Trash2 size={14} />
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

      {/* Pagination */}
      {!loading && allFiltered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[#4b5563] text-xs">Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, allFiltered.length)} of {allFiltered.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-1.5 rounded border border-[#1e2330] text-[#6b7280] hover:bg-[#1e2330] disabled:opacity-30 transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-[#9ca3af] text-xs px-3">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-1.5 rounded border border-[#1e2330] text-[#6b7280] hover:bg-[#1e2330] disabled:opacity-30 transition-colors"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
      {!loading && allFiltered.length <= PAGE_SIZE && (
        <p className="text-[#4b5563] text-xs mt-3">Showing {allFiltered.length} of {students.length} students</p>
      )}

      {/* ── Add/Edit Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-[440px] shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e2330]">
              <div>
                <h2 className="text-white font-semibold text-base">{editTarget ? 'Edit Student' : 'Register Student'}</h2>
                <p className="text-[#4b5563] text-xs mt-0.5">{editTarget ? 'Update student details.' : 'Add a new student to the library.'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#4b5563] hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'name',      label: 'Full Name *',   placeholder: 'Ananya Sharma',    type: 'text'  },
                { key: 'studentId', label: 'Student ID *',  placeholder: 'STU-2024-001',     type: 'text'  },
                { key: 'email',     label: 'Email *',       placeholder: 'ananya@school.in', type: 'email' },
                { key: 'course',    label: 'Class / Course *', placeholder: '10-A',          type: 'text'  },
                { key: 'phone',     label: 'Phone',         placeholder: '+91 98765 43210',  type: 'tel'   },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-[#6b7280] text-[11px] uppercase tracking-wider font-medium mb-1.5">{label}</label>
                  <input
                    type={type} value={form[key]} placeholder={placeholder}
                    onChange={e => {
                      setForm(p => ({ ...p, [key]: e.target.value }));
                      if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
                    }}
                    className={`w-full bg-[#0f1117] text-white text-sm px-3 py-2.5 rounded-lg outline-none transition-colors placeholder-[#374151] border ${errors[key] ? 'border-[#ef4444]' : 'border-[#1e2330] focus:border-[#374151]'}`}
                  />
                  {errors[key] && <p className="text-[#ef4444] text-xs mt-1">{errors[key]}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-[#1e2330] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Borrowing History Panel ──────────────────────────────────── */}
      {historyStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) setHistoryStudent(null); }}>
          <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-[560px] shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e2330] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: avatarColor(historyStudent.name) }}>
                  {initials(historyStudent.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-semibold text-base">{historyStudent.name}</h2>
                    {canChangeStudentStatus() ? (
                      <select
                        value={(historyStudent.status || 'ACTIVE').toUpperCase()}
                        onChange={e => handleStatusChange(historyStudent.id, e.target.value)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none bg-[#0b0f1a] cursor-pointer ${
                          (historyStudent.status || 'ACTIVE').toUpperCase() === 'BLOCKED'
                            ? 'text-[#ef4444] border-red-800/40'
                            : (historyStudent.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
                              ? 'text-[#f5a623] border-amber-800/40'
                              : 'text-[#10b981] border-emerald-800/40'
                        }`}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="BLOCKED">BLOCKED</option>
                      </select>
                    ) : (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        (historyStudent.status || 'ACTIVE').toUpperCase() === 'BLOCKED'
                          ? 'text-[#ef4444] bg-red-950/40 border-red-800/40'
                          : (historyStudent.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
                            ? 'text-[#f5a623] bg-amber-950/40 border-amber-800/40'
                            : 'text-[#10b981] bg-emerald-950/40 border-emerald-800/40'
                      }`}>
                        {(historyStudent.status || 'ACTIVE').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[#4b5563] text-xs mt-0.5">{historyStudent.studentId || historyStudent.rollNo} · {historyStudent.course || historyStudent.class || ''} · {historyStudent.email || 'No email'}</p>
                </div>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="text-[#4b5563] hover:text-white p-1"><X size={18} /></button>
            </div>

            {/* Student stats summary */}
            {!historyLoading && history.length > 0 && (() => {
              const totalBorrowed  = history.length;
              const currentlyOut   = history.filter(r => r.status === 'issued' || r.status === 'Issued').length;
              const overdueCount   = history.filter(r => (r.status === 'issued' || r.status === 'Issued') && calcOverdueDays(r.dueDate) > 0).length;
              const historicalFine = history.filter(r => r.status === 'returned' || r.status === 'Returned').reduce((s, r) => s + (Number(r.fine) || 0), 0);
              const activeFine     = history
                .filter(r => (r.status === 'issued' || r.status === 'Issued') && calcOverdueDays(r.dueDate) > 0)
                .reduce((s, r) => s + calculateFine(r.dueDate, settings), 0);
              return (
                <div className="grid grid-cols-4 gap-px bg-[#1e2330] border-b border-[#1e2330] flex-shrink-0">
                  {[
                    { label: 'Total Borrowed', value: totalBorrowed, color: 'text-white' },
                    { label: 'Currently Out',  value: currentlyOut,  color: 'text-[#f5a623]' },
                    { label: 'Overdue',        value: overdueCount,  color: overdueCount > 0 ? 'text-[#ef4444]' : 'text-[#10b981]' },
                    { label: 'Total Fines',    value: `₹${historicalFine + activeFine}`, color: 'text-[#f97316]' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#131720] px-4 py-3 text-center">
                      <div className={`text-lg font-bold ${color}`}>{value}</div>
                      <div className="text-[#4b5563] text-[10px] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <h3 className="text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                <History size={12} /> Borrowing History ({history.length})
              </h3>
              {historyLoading && (
                <div className="space-y-2">
                  {[0,1,2].map(i => <div key={i} className="h-14 bg-[#1e2330] rounded-lg animate-pulse" />)}
                </div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="text-center py-10">
                  <BookOpen size={28} className="mx-auto text-[#374151] mb-2" />
                  <p className="text-[#6b7280] text-sm">No borrowing history yet.</p>
                </div>
              )}
              {!historyLoading && history.map(record => {
                const isActive  = record.status === 'issued' || record.status === 'Issued';
                const od        = isActive ? calcOverdueDays(record.dueDate) : 0;
                const fineAmt   = isActive && od > 0 ? calculateFine(record.dueDate, settings) : (Number(record.fine) || 0);
                const displayStatus = isActive && od > 0 ? 'Overdue' : record.status;
                const renewals = record.renewalCount || 0;
                const maxRenewals = settings.renewalLimit ?? 2;
                const canRenew = isActive && renewals < maxRenewals && (!settings.preventOverdueRenewal || od === 0);

                return (
                  <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-[#1e2330] last:border-0 gap-2">
                    <div className="min-w-0 mr-2">
                      <div className="text-white text-sm font-medium truncate">{record.bookTitle || record.book}</div>
                      <div className="text-[#6b7280] text-xs mt-0.5">
                        Issued: {record.issueDate} · Due: {record.dueDate}
                        {record.returnDate && ` · Returned: ${record.returnDate}`}
                        {od > 0 && <span className="text-[#ef4444] ml-1">· {od}d overdue</span>}
                        {fineAmt > 0 && <span className="text-[#f5a623] ml-1">· Fine: ₹{fineAmt}</span>}
                        {isActive && <span className="text-[#6b7280] ml-1">· Renewals: {renewals}/{maxRenewals}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && canRenewBooks() && (
                        <button
                          onClick={() => handleRenewInHistory(record)}
                          disabled={!canRenew || renewingId === record.id}
                          className="px-2 py-1 text-[11px] border border-[#374151] text-[#d1d5db] rounded hover:bg-[#1e2330] transition-colors disabled:opacity-40"
                          title={!canRenew ? 'Renewal limit reached or overdue' : 'Renew loan'}
                        >
                          {renewingId === record.id ? '…' : 'Renew'}
                        </button>
                      )}
                      {isActive && canSendReminders() && historyStudent?.email && (
                        <button
                          onClick={() => handleSendReminder(record)}
                          disabled={sendingReminderId === record.id}
                          className="px-2 py-1 text-[11px] border border-blue-800/40 text-[#60a5fa] rounded hover:bg-blue-950/40 transition-colors disabled:opacity-40 flex items-center gap-1"
                          title="Send Email Reminder"
                        >
                          <Mail size={11} /> {sendingReminderId === record.id ? '…' : 'Remind'}
                        </button>
                      )}
                      <StatusBadge status={displayStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
