import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeBooks, addBook, updateBook, deleteBook } from '../services/firestore';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import BarcodeQRGenerator from '../components/barcode/BarcodeQRGenerator';
import PrintLabelModal from '../components/barcode/PrintLabelModal';
import BookScannerModal from '../components/scanner/BookScannerModal';
import {
  Search, Plus, Download, BookOpen,
  Pencil, Trash2, X, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Barcode as BarcodeIcon,
  Printer, QrCode as QrIcon,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Fiction', 'Science', 'Philosophy', 'History',
  'Computer Science', 'Biography', 'Self-Help', 'Mathematics',
  'Language', 'Arts', 'Other',
];

const CAT_COLORS = {
  Fiction:           { text: '#f5a623', bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.3)' },
  Science:           { text: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)'  },
  Philosophy:        { text: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.3)' },
  History:           { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'  },
  'Computer Science':{ text: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  Biography:         { text: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  'Self-Help':       { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Mathematics:       { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
};

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  title: '', author: '', isbn: '', category: 'Fiction',
  publisher: '', publicationYear: '',
  totalQuantity: 1, availableQuantity: 1,
};

// ── Helper components (module-level — never inside render) ────────────────────
function CategoryBadge({ cat }) {
  const c = CAT_COLORS[cat] || { text: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)' };
  return (
    <span style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
      {cat || '—'}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[160, 100, 80, 60, 60, 70].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 rounded bg-[#1e2330]" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// Field component — must stay at module scope to keep stable React identity
function FormField({ fieldKey, label, required, type = 'text', min, form, setForm, errors, setErrors }) {
  return (
    <div>
      <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-1.5">
        {label}{required && <span className="text-[#ef4444] ml-0.5">*</span>}
      </label>
      <input
        type={type} min={min}
        value={form[fieldKey] ?? ''}
        onChange={e => {
          setForm(p => ({ ...p, [fieldKey]: e.target.value }));
          setErrors(p => ({ ...p, [fieldKey]: '' }));
        }}
        className="w-full bg-[#0b0f1a] border text-[#e5e7eb] placeholder-[#374151] text-sm px-3 py-2.5 rounded-lg outline-none transition-colors"
        style={{ borderColor: errors[fieldKey] ? '#ef4444' : '#1e2330' }}
      />
      {errors[fieldKey] && <p className="text-[#ef4444] text-xs mt-1">{errors[fieldKey]}</p>}
    </div>
  );
}

// ── Validation ───────────────────────────────────────────────────────────────
function validate(form) {
  const e = {};
  if (!form.title?.trim())    e.title    = 'Title is required.';
  if (!form.author?.trim())   e.author   = 'Author is required.';
  if (!form.category?.trim()) e.category = 'Category is required.';
  const tq = Number(form.totalQuantity), aq = Number(form.availableQuantity);
  if (!tq || tq < 1)          e.totalQuantity     = 'Must be at least 1.';
  if (aq < 0)                 e.availableQuantity = 'Cannot be negative.';
  if (aq > tq)                e.availableQuantity = 'Cannot exceed total copies.';
  return e;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Books() {
  const toast            = useToast();
  const { settings }     = useSettings();
  const { canDeleteBooks, canManageBooks } = useAuth();

  // Data
  const [books, setBooks]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Scanner & Print Modals
  const [scannerOpen, setScannerOpen]         = useState(false);
  const [printModalBooks, setPrintModalBooks] = useState(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter]     = useState('All');
  const [availFilter, setAvailFilter] = useState('All');
  const [sortDir, setSortDir]         = useState('asc');

  // Pagination
  const [page, setPage]   = useState(1);
  const PAGE_SIZE_CLIENT  = PAGE_SIZE; // client-side pagination on subscribed data

  // Modal
  const [modal, setModal]     = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]           = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeBooks(data => { setBooks(data); setLoading(false); });
    return unsub;
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchQuery, catFilter, availFilter, sortDir]);

  const handleSearchChange = useCallback(val => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val), 300);
  }, []);

  // Filter + sort
  const allFiltered = books
    .filter(b => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q ||
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.isbn?.toLowerCase().includes(q);
      const cat = b.category || b.genre || '';
      const matchC = catFilter === 'All' || cat === catFilter;
      const avail = b.availableQuantity ?? b.available ?? 0;
      const matchA = availFilter === 'All' ||
        (availFilter === 'Available' ? avail > 0 : avail === 0);
      return matchQ && matchC && matchA;
    })
    .sort((a, b) =>
      sortDir === 'asc'
        ? (a.title || '').localeCompare(b.title || '')
        : (b.title || '').localeCompare(a.title || '')
    );

  // Paginate
  const totalPages  = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE_CLIENT));
  const pageStart   = (page - 1) * PAGE_SIZE_CLIENT;
  const pageBooks   = allFiltered.slice(pageStart, pageStart + PAGE_SIZE_CLIENT);

  // Modal helpers
  const openAdd = () => {
    setEditBook(null); setForm(EMPTY_FORM); setErrors({}); setModal(true);
  };
  const openEdit = book => {
    setEditBook(book);
    setForm({
      title:             book.title || '',
      author:            book.author || '',
      isbn:              book.isbn || '',
      category:          book.category || book.genre || 'Fiction',
      publisher:         book.publisher || '',
      publicationYear:   book.publicationYear || '',
      totalQuantity:     book.totalQuantity ?? book.copies ?? 1,
      availableQuantity: book.availableQuantity ?? book.available ?? 1,
    });
    setErrors({}); setModal(true);
  };

  const handleSave = async () => {
    const e = validate(form);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const data = {
        ...form,
        totalQuantity:     Number(form.totalQuantity),
        availableQuantity: Number(form.availableQuantity),
      };
      if (editBook) {
        await updateBook(editBook.id, data);
        toast.success('Book updated successfully.');
      } else {
        await addBook(data);
        toast.success('Book added to catalogue.');
      }
      setModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save book.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteBook(confirmDelete.id);
      toast.success(`"${confirmDelete.title}" deleted.`);
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to delete book.');
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Title','Author','ISBN','Category','Publisher','Year','Total Copies','Available'],
      ...books.map(b => [
        b.title, b.author, b.isbn, b.category || b.genre,
        b.publisher, b.publicationYear,
        b.totalQuantity ?? b.copies,
        b.availableQuantity ?? b.available,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)),
    ];
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map(r => r.join(',')).join('\n'))}`;
    a.download = 'books.csv'; a.click();
    toast.success('CSV exported.');
  };

  const fieldProps = { form, setForm, errors, setErrors };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Books</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">
            {loading ? 'Loading…' : `${books.length} book${books.length !== 1 ? 's' : ''} in catalogue`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#f5a623]/40 text-[#f5a623] text-sm rounded-lg hover:bg-[#1a2035] transition-colors"
          >
            <BarcodeIcon size={14} /> Scan Book
          </button>
          <button
            onClick={() => setPrintModalBooks(allFiltered.length > 0 ? allFiltered : books)}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors"
          >
            <Printer size={14} /> Print Labels
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">
            <Download size={14} /> Export
          </button>
          {canManageBooks() && (
            <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] transition-colors">
              <Plus size={14} /> Add Book
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563] pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search title, author, ISBN…"
            className="w-full pl-9 pr-8 py-2 bg-[#131720] border border-[#1e2330] text-[#d1d5db] placeholder-[#4b5563] text-sm rounded-lg outline-none focus:border-[#374151]"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearchQuery(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-sm px-3 py-2 rounded-lg outline-none">
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={availFilter} onChange={e => setAvailFilter(e.target.value)} className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-sm px-3 py-2 rounded-lg outline-none">
          <option value="All">All Availability</option>
          <option value="Available">Available</option>
          <option value="Unavailable">Unavailable</option>
        </select>
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="flex items-center gap-1.5 px-3 py-2 border border-[#1e2330] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">
          Title {sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px]">
            <thead>
              <tr className="border-b border-[#1e2330]">
                {['Title / Author', 'ISBN', 'Category', 'Total', 'Available', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [0,1,2,3,4].map(i => <SkeletonRow key={i} />)}

              {!loading && pageBooks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <BookOpen size={32} className="mx-auto text-[#374151] mb-3" />
                  <p className="text-[#6b7280] text-sm font-medium">No books found</p>
                  <p className="text-[#4b5563] text-xs mt-1">
                    {searchQuery || catFilter !== 'All' || availFilter !== 'All'
                      ? 'Try adjusting your search or filters.'
                      : 'Click "+ Add Book" to get started.'}
                  </p>
                </td></tr>
              )}

              {pageBooks.map(book => {
                const avail = book.availableQuantity ?? book.available ?? 0;
                const total = book.totalQuantity ?? book.copies ?? 0;
                return (
                  <tr key={book.id} className="border-b border-[#1e2330] last:border-0 hover:bg-[#1a2035] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="text-white text-sm font-medium">{book.title}</div>
                      <div className="text-[#6b7280] text-xs">{book.author}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[#6b7280] text-xs font-mono">{book.isbn || '—'}</td>
                    <td className="px-4 py-3.5"><CategoryBadge cat={book.category || book.genre} /></td>
                    <td className="px-4 py-3.5 text-[#d1d5db] text-sm">{total}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${avail === 0 ? 'text-[#ef4444]' : avail === 1 ? 'text-[#f5a623]' : 'text-[#10b981]'}`}>
                          {avail}
                        </span>
                        {avail > 0 && avail <= (settings.lowStockThreshold ?? 2) && (
                          <span className="text-[10px] font-semibold text-[#f5a623] bg-amber-950/30 border border-amber-800/30 px-1.5 py-0.5 rounded">⚠ Low</span>
                        )}
                        {avail === 0 && (
                          <span className="text-[10px] font-semibold text-[#ef4444] bg-red-950/30 border border-red-800/30 px-1.5 py-0.5 rounded">Out</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPrintModalBooks([book])}
                          className="p-1.5 text-[#6b7280] hover:text-[#f5a623] hover:bg-[#f5a623]/10 rounded-lg transition-colors"
                          title="Print Barcode & QR Label"
                        >
                          <Printer size={14} />
                        </button>
                        {canManageBooks() && (
                          <button
                            onClick={() => openEdit(book)}
                            className="p-1.5 text-[#6b7280] hover:text-[#3b82f6] hover:bg-[#1e3a5f]/40 rounded-lg transition-colors"
                            title="Edit Book"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDeleteBooks() && (
                          <button
                            onClick={() => setConfirmDelete(book)}
                            className="p-1.5 text-[#6b7280] hover:text-[#ef4444] hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete Book"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && allFiltered.length > PAGE_SIZE_CLIENT && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[#4b5563] text-xs">
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE_CLIENT, allFiltered.length)} of {allFiltered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded border border-[#1e2330] text-[#6b7280] hover:bg-[#1e2330] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[#9ca3af] text-xs px-3">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-[#1e2330] text-[#6b7280] hover:bg-[#1e2330] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
      {!loading && allFiltered.length <= PAGE_SIZE_CLIENT && (
        <p className="text-[#4b5563] text-xs mt-3">Showing {allFiltered.length} of {books.length} books</p>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-6" onClick={() => setModal(false)}>
          <div className="bg-[#131720] border border-[#1e2330] rounded-xl w-full max-w-[520px] shadow-2xl overflow-y-auto max-h-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e2330]">
              <div>
                <h2 className="text-white font-semibold text-base">{editBook ? 'Edit Book' : 'Add Book'}</h2>
                <p className="text-[#4b5563] text-xs mt-0.5">{editBook ? 'Update book details.' : 'Add a new book to the catalogue.'}</p>
              </div>
              <button onClick={() => setModal(false)} className="text-[#6b7280] hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <FormField fieldKey="title"  label="Title"  required {...fieldProps} />
              <FormField fieldKey="author" label="Author" required {...fieldProps} />
              <div className="grid grid-cols-2 gap-4">
                <FormField fieldKey="isbn" label="ISBN" {...fieldProps} />
                <div>
                  <label className="block text-[#6b7280] text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                    Category <span className="text-[#ef4444]">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={e => { setForm(p => ({ ...p, category: e.target.value })); setErrors(p => ({ ...p, category: '' })); }}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-[#e5e7eb] text-sm px-3 py-2.5 rounded-lg outline-none"
                    style={{ borderColor: errors.category ? '#ef4444' : '#1e2330' }}
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {errors.category && <p className="text-[#ef4444] text-xs mt-1">{errors.category}</p>}
                </div>
                <FormField fieldKey="publisher"       label="Publisher" {...fieldProps} />
                <FormField fieldKey="publicationYear" label="Pub. Year" type="number" min="1000" {...fieldProps} />
                <FormField fieldKey="totalQuantity"   label="Total Copies *" type="number" min="1" {...fieldProps} />
                <FormField fieldKey="availableQuantity" label="Available *"  type="number" min="0" {...fieldProps} />
              </div>

              {/* Barcode & QR Code Preview when viewing/editing a book */}
              {editBook && (
                <div className="pt-2 border-t border-[#1e2330]">
                  <BarcodeQRGenerator book={editBook} />
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-[#374151] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editBook ? 'Save Changes' : 'Add Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-950/50 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete Book</h3>
                <p className="text-[#6b7280] text-sm">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-[#9ca3af] text-sm mb-5">
              Delete <span className="text-white font-medium">"{confirmDelete.title}"</span>? Existing issue records will remain for history but the book will no longer be available.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-[#374151] text-[#d1d5db] text-sm rounded-lg hover:bg-[#1e2330] transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-[#991b1b] text-white text-sm font-semibold rounded-lg hover:bg-[#7f1d1d] disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode & QR Scanner Modal */}
      <BookScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSelectBook={(b) => openEdit(b)}
      />

      {/* Batch & Single Print Label Modal */}
      {printModalBooks && (
        <PrintLabelModal
          books={printModalBooks}
          onClose={() => setPrintModalBooks(null)}
        />
      )}
    </div>
  );
}
