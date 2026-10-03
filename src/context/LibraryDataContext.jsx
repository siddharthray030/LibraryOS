/**
 * LibraryDataContext
 *
 * Provides a single shared real-time subscription to the three primary
 * Firestore collections: books, students, and issuedBooks.
 *
 * Previously, GlobalSearch, NotificationsContext, Dashboard, Books,
 * Members, IssueReturn, LoanHistory, and Overdue pages each created
 * their own onSnapshot listeners. This context consolidates them into
 * ONE set of listeners, dramatically reducing Firestore reads.
 *
 * Usage:
 *   const { books, students, issuedBooks, loading } = useLibraryData();
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeBooks, subscribeStudents, subscribeIssuedBooks } from '../services/firestore';

const LibraryDataContext = createContext(null);

export function LibraryDataProvider({ children }) {
  const [books,       setBooks]       = useState([]);
  const [students,    setStudents]    = useState([]);
  const [issuedBooks, setIssuedBooks] = useState([]);
  const [booksLoaded,    setBooksLoaded]    = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [issuesLoaded,   setIssuesLoaded]   = useState(false);

  useEffect(() => {
    const u1 = subscribeBooks(data => { setBooks(data); setBooksLoaded(true); });
    const u2 = subscribeStudents(data => { setStudents(data); setStudentsLoaded(true); });
    const u3 = subscribeIssuedBooks(data => { setIssuedBooks(data); setIssuesLoaded(true); });
    return () => { u1(); u2(); u3(); };
  }, []);

  const loading = !booksLoaded || !studentsLoaded || !issuesLoaded;

  return (
    <LibraryDataContext.Provider value={{ books, students, issuedBooks, loading }}>
      {children}
    </LibraryDataContext.Provider>
  );
}

export function useLibraryData() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('useLibraryData must be used inside <LibraryDataProvider>');
  return ctx;
}
