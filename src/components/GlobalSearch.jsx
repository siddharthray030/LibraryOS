import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeBooks, subscribeStudents } from '../services/firestore';
import { Search, BookOpen, GraduationCap, X, ChevronRight } from 'lucide-react';

export default function GlobalSearch({ onNavigate, onSelectBook, onSelectStudent }) {
  const [queryText, setQueryText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Subscribe to books and students for instant client-side index lookup
  useEffect(() => {
    const unsubBooks = subscribeBooks(setBooks);
    const unsubStudents = subscribeStudents(setStudents);
    return () => {
      unsubBooks();
      unsubStudents();
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(queryText.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(handler);
  }, [queryText]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter books and students
  const filteredBooks = debouncedQuery ? books.filter(b => {
    const title = (b.title || '').toLowerCase();
    const author = (b.author || '').toLowerCase();
    const isbn = (b.isbn || '').toLowerCase();
    const libId = (b.libraryId || '').toLowerCase();
    const barcode = (b.barcode || '').toLowerCase();
    return title.includes(debouncedQuery) || author.includes(debouncedQuery) || isbn.includes(debouncedQuery) || libId.includes(debouncedQuery) || barcode.includes(debouncedQuery);
  }).slice(0, 5) : [];

  const filteredStudents = debouncedQuery ? students.filter(s => {
    const name = (s.name || '').toLowerCase();
    const id = (s.studentId || s.rollNo || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const course = (s.course || s.class || '').toLowerCase();
    return name.includes(debouncedQuery) || id.includes(debouncedQuery) || email.includes(debouncedQuery) || course.includes(debouncedQuery);
  }).slice(0, 5) : [];

  const totalResults = filteredBooks.length + filteredStudents.length;

  const handleSelectBook = (book) => {
    setIsOpen(false);
    setQueryText('');
    if (onSelectBook) onSelectBook(book);
    else if (onNavigate) onNavigate('books');
  };

  const handleSelectStudent = (student) => {
    setIsOpen(false);
    setQueryText('');
    if (onSelectStudent) onSelectStudent(student);
    else if (onNavigate) onNavigate('members');
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      {/* Search Input Box */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none" />
        <input
          type="text"
          value={queryText}
          onChange={e => {
            setQueryText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (queryText.trim()) setIsOpen(true);
          }}
          placeholder="Global search (Books, Authors, ISBN, Students, IDs)..."
          className="w-full bg-[#131720] border border-[#1e2330] text-sm text-[#e5e7eb] placeholder-[#4b5563] pl-10 pr-8 py-2 rounded-xl outline-none focus:border-[#f5a623] transition-colors"
        />
        {queryText && (
          <button
            onClick={() => {
              setQueryText('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-white p-0.5 rounded"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && debouncedQuery && (
        <div className="absolute left-0 right-0 top-12 z-50 bg-[#131720] border border-[#1e2330] rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
          {totalResults === 0 ? (
            <div className="p-6 text-center text-xs text-[#6b7280]">
              No results found for <span className="text-white font-medium">"{queryText}"</span>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2330]">
              {/* BOOKS SECTION */}
              {filteredBooks.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-[#f5a623] flex items-center gap-1.5">
                    <BookOpen size={12} /> Books ({filteredBooks.length})
                  </div>
                  {filteredBooks.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleSelectBook(b)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1a2035] text-left transition-colors group"
                    >
                      <div className="min-w-0 mr-2">
                        <div className="text-sm font-medium text-white truncate group-hover:text-[#f5a623] transition-colors">
                          {b.title}
                        </div>
                        <div className="text-xs text-[#6b7280] truncate">
                          {b.author} · ISBN: <span className="font-mono text-[#9ca3af]">{b.isbn || '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          (b.availableQuantity ?? b.available ?? 0) > 0 ? 'text-[#10b981] bg-emerald-950/40' : 'text-[#ef4444] bg-red-950/40'
                        }`}>
                          {b.availableQuantity ?? b.available ?? 0} avail
                        </span>
                        <ChevronRight size={14} className="text-[#4b5563] group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* STUDENTS SECTION */}
              {filteredStudents.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-[#60a5fa] flex items-center gap-1.5">
                    <GraduationCap size={12} /> Students ({filteredStudents.length})
                  </div>
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1a2035] text-left transition-colors group"
                    >
                      <div className="min-w-0 mr-2">
                        <div className="text-sm font-medium text-white truncate group-hover:text-[#60a5fa] transition-colors">
                          {s.name}
                        </div>
                        <div className="text-xs text-[#6b7280] truncate">
                          ID: <span className="font-mono text-[#f5a623]">{s.studentId || s.rollNo || '—'}</span> · {s.course || s.class || 'Student'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          s.status === 'BLOCKED' ? 'text-[#ef4444] bg-red-950/40' : s.status === 'SUSPENDED' ? 'text-[#f5a623] bg-amber-950/40' : 'text-[#10b981] bg-emerald-950/40'
                        }`}>
                          {s.status || 'ACTIVE'}
                        </span>
                        <ChevronRight size={14} className="text-[#4b5563] group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
