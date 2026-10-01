import {
  collection, doc,
  getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot,
  query, orderBy, where, limit, startAfter,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { logActivity, ACTIONS, ENTITY_TYPES } from "./activityLog";
import { getSettings, calculateFine } from "./settings";

// ── Collection refs ──────────────────────────────────────────────────────────
const booksCol    = collection(db, "books");
const studentsCol = collection(db, "students");
const issuedCol   = collection(db, "issuedBooks");
const usersCol    = collection(db, "users");

// Legacy aliases
const loansCol   = collection(db, "issuedBooks");
const membersCol = collection(db, "students");

// ═══════════════════════════════════════════════════════════════════════════
// BOOKS
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeBooks = (callback) => {
  const q = query(booksCol, orderBy("title"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
};

/** Fetch one page of books (for pagination). */
export const fetchBooksPage = async (pageSize = 20, afterDoc = null) => {
  let q = query(booksCol, orderBy("title"), limit(pageSize));
  if (afterDoc) q = query(booksCol, orderBy("title"), startAfter(afterDoc), limit(pageSize));
  const snap = await getDocs(q);
  return {
    books:   snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
};

export const addBook = async (data) => {
  const isbn = (data.isbn || "").trim();
  const barcode = (data.barcode || isbn || "").trim();
  const libraryId = (data.libraryId || (isbn ? `LIB-${isbn}` : `LIB-${Date.now().toString().slice(-6)}`)).trim();

  const ref = await addDoc(booksCol, {
    title:             data.title,
    author:            data.author,
    isbn:              isbn,
    barcode:           barcode,
    libraryId:         libraryId,
    qrCode:            data.qrCode || barcode || isbn,
    category:          data.category || data.genre || "Other",
    publisher:         data.publisher || "",
    publicationYear:   data.publicationYear || "",
    totalQuantity:     Number(data.totalQuantity ?? data.copies ?? 1),
    availableQuantity: Number(data.availableQuantity ?? data.available ?? 1),
    createdAt:         serverTimestamp(),
    updatedAt:         serverTimestamp(),
  });

  await logActivity({
    action:      ACTIONS.BOOK_CREATED,
    description: `Book added: "${data.title}" by ${data.author}`,
    entityId:    ref.id,
    entityType:  ENTITY_TYPES.BOOK,
    meta:        { title: data.title, author: data.author, isbn, barcode, libraryId },
  });
  return ref;
};

export const updateBook = async (id, data) => {
  const updatePayload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (data.totalQuantity !== undefined) updatePayload.totalQuantity = Number(data.totalQuantity);
  if (data.availableQuantity !== undefined) updatePayload.availableQuantity = Number(data.availableQuantity);
  if (data.isbn && !data.barcode) updatePayload.barcode = data.isbn;

  await updateDoc(doc(db, "books", id), updatePayload);
  await logActivity({
    action:      ACTIONS.BOOK_UPDATED,
    description: `Book updated: "${data.title || id}"`,
    entityId:    id,
    entityType:  ENTITY_TYPES.BOOK,
    meta:        { title: data.title, author: data.author },
  });
};

export const deleteBook = async (id) => {
  const snap = await getDoc(doc(db, "books", id));
  const title = snap.data()?.title || id;
  await deleteDoc(doc(db, "books", id));
  await logActivity({
    action:      ACTIONS.BOOK_DELETED,
    description: `Book deleted: "${title}"`,
    entityId:    id,
    entityType:  ENTITY_TYPES.BOOK,
    meta:        { title },
  });
};

export const getBookById = (id) =>
  getDoc(doc(db, "books", id)).then(s => s.exists() ? { id: s.id, ...s.data() } : null);

/**
 * Find a book by Barcode, ISBN, Library ID, or Document ID.
 * Returns book object or null.
 */
export const findBookByCode = async (code) => {
  if (!code) return null;
  const clean = String(code).trim();

  // Try direct document ID first
  try {
    const directDoc = await getDoc(doc(db, "books", clean));
    if (directDoc.exists()) {
      return { id: directDoc.id, ...directDoc.data() };
    }
  } catch {}

  // Query by barcode
  const qBarcode = query(booksCol, where("barcode", "==", clean), limit(1));
  const snapBarcode = await getDocs(qBarcode);
  if (!snapBarcode.empty) {
    const d = snapBarcode.docs[0];
    return { id: d.id, ...d.data() };
  }

  // Query by ISBN
  const qIsbn = query(booksCol, where("isbn", "==", clean), limit(1));
  const snapIsbn = await getDocs(qIsbn);
  if (!snapIsbn.empty) {
    const d = snapIsbn.docs[0];
    return { id: d.id, ...d.data() };
  }

  // Query by libraryId
  const qLib = query(booksCol, where("libraryId", "==", clean), limit(1));
  const snapLib = await getDocs(qLib);
  if (!snapLib.empty) {
    const d = snapLib.docs[0];
    return { id: d.id, ...d.data() };
  }

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeStudents = (callback) => {
  const q = query(studentsCol, orderBy("name"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
};

export const subscribeMembers = subscribeStudents;

/** Check whether a studentId already exists (for duplicate prevention). */
export const studentIdExists = async (studentId, excludeDocId = null) => {
  const q    = query(studentsCol, where("studentId", "==", studentId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  return snap.docs.some(d => d.id !== excludeDocId);
};

export const addStudent = async (data) => {
  const ref = await addDoc(studentsCol, {
    name:      data.name,
    studentId: data.studentId || data.rollNo || "",
    email:     data.email || "",
    phone:     data.phone || data.contact || "",
    course:    data.course || data.class || "",
    status:    data.status || "ACTIVE", // ACTIVE, SUSPENDED, BLOCKED
    createdAt: serverTimestamp(),
    joined:    new Date().toISOString().slice(0, 10),
  });
  await logActivity({
    action:      ACTIONS.STUDENT_CREATED,
    description: `Student registered: ${data.name} (${data.studentId || ""})`,
    entityId:    ref.id,
    entityType:  ENTITY_TYPES.STUDENT,
    meta:        { name: data.name, studentId: data.studentId, course: data.course, status: data.status || "ACTIVE" },
  });
  return ref;
};

export const addMember = addStudent;

export const updateMember = async (id, data) => {
  await updateDoc(doc(db, "students", id), { ...data, updatedAt: serverTimestamp() });
  await logActivity({
    action:      ACTIONS.STUDENT_UPDATED,
    description: `Student updated: ${data.name || id}`,
    entityId:    id,
    entityType:  ENTITY_TYPES.STUDENT,
    meta:        { name: data.name },
  });
};

export const deleteMember = async (id) => {
  const snap = await getDoc(doc(db, "students", id));
  const name = snap.data()?.name || id;
  await deleteDoc(doc(db, "students", id));
  await logActivity({
    action:      ACTIONS.STUDENT_DELETED,
    description: `Student deleted: ${name}`,
    entityId:    id,
    entityType:  ENTITY_TYPES.STUDENT,
    meta:        { name },
  });
};

export const updateStudent = updateMember;
export const deleteStudent = deleteMember;

export const getStudentById = (id) =>
  getDoc(doc(db, "students", id)).then(s => s.exists() ? { id: s.id, ...s.data() } : null);

/**
 * Update student account status (ACTIVE, SUSPENDED, BLOCKED)
 */
export const updateStudentStatus = async (studentId, status, reason = "") => {
  const upper = String(status).toUpperCase();
  await updateDoc(doc(db, "students", studentId), {
    status: upper,
    statusReason: reason || null,
    statusUpdatedAt: serverTimestamp(),
  });
  await logActivity({
    action:      ACTIONS.STUDENT_STATUS_CHANGED,
    description: `Student account status changed to ${upper}${reason ? ` (${reason})` : ""}`,
    entityId:    studentId,
    entityType:  ENTITY_TYPES.STUDENT,
    meta:        { status: upper, reason },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ISSUED BOOKS & CIRCULATION (Issue, Return, Renewal)
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeIssuedBooks = (callback) => {
  const q = query(issuedCol, orderBy("issueDate", "desc"));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
};

export const subscribeLoans = subscribeIssuedBooks;

/**
 * Issue a book using a Firestore TRANSACTION for atomicity.
 * Checks:
 *  - Book exists and availableQuantity > 0
 *  - Student exists and is not BLOCKED or SUSPENDED
 *  - Student does not exceed maxBooksPerStudent setting
 *  - Student does not already have an active issue for this book
 */
export const issueBook = async ({ bookId, studentId, issueDate, dueDate, bookTitle, studentName, studentIdNo }) => {
  const settings = await getSettings();

  const newId = await runTransaction(db, async (tx) => {
    const bookRef    = doc(db, "books",    bookId);
    const studentRef = doc(db, "students", studentId);

    const [bookSnap, studentSnap] = await Promise.all([tx.get(bookRef), tx.get(studentRef)]);

    if (!bookSnap.exists())    throw new Error("Book not found.");
    if (!studentSnap.exists()) throw new Error("Student not found.");

    const book    = bookSnap.data();
    const student = studentSnap.data();

    // Check student status
    const studentStatus = (student.status || "ACTIVE").toUpperCase();
    if (studentStatus === "BLOCKED") {
      throw new Error(`Cannot issue book: Student account is BLOCKED.${student.statusReason ? ` Reason: ${student.statusReason}` : ""}`);
    }
    if (studentStatus === "SUSPENDED") {
      throw new Error(`Cannot issue book: Student account is SUSPENDED.${student.statusReason ? ` Reason: ${student.statusReason}` : ""}`);
    }

    const avail = book.availableQuantity ?? book.available ?? 0;
    if (avail <= 0) throw new Error("No copies available for this book.");

    // Check student's current active borrow count against limit
    const activeStudentIssues = await getDocs(
      query(issuedCol,
        where("studentId", "==", studentId),
        where("status", "==", "issued")
      )
    );
    const maxAllowed = settings.maxBooksPerStudent || 3;
    if (activeStudentIssues.size >= maxAllowed) {
      throw new Error(`Student has reached the maximum allowed limit of ${maxAllowed} borrowed books.`);
    }

    // Check for duplicate active issue of the same book
    const duplicate = activeStudentIssues.docs.some(d => d.data().bookId === bookId);
    if (duplicate) throw new Error("Student already has an active issue for this book.");

    // Calculate due date if not provided
    const issueDateStr = issueDate || new Date().toISOString().slice(0, 10);
    let finalDueDate = dueDate;
    if (!finalDueDate) {
      const d = new Date();
      d.setDate(d.getDate() + (settings.defaultLoanDuration || 14));
      finalDueDate = d.toISOString().slice(0, 10);
    }

    // Create the issued record
    const newIssueRef = doc(issuedCol);
    tx.set(newIssueRef, {
      bookId,
      studentId,
      bookTitle:        bookTitle  || book.title  || "",
      bookAuthor:       book.author || "",
      bookCategory:     book.category || book.genre || "",
      studentName:      studentName || student.name || "",
      studentIdNo:      studentIdNo || student.studentId || "",
      issueDate:        issueDateStr,
      dueDate:          finalDueDate,
      originalDueDate:  finalDueDate,
      currentDueDate:   finalDueDate,
      renewalCount:     0,
      status:           "issued",
      returnDate:       null,
      fine:             0,
      createdAt:        serverTimestamp(),
    });

    // Decrement available quantity — never below 0
    const newAvail = Math.max(0, avail - 1);
    tx.update(bookRef, { availableQuantity: newAvail, updatedAt: serverTimestamp() });

    return newIssueRef.id;
  });

  await logActivity({
    action:      ACTIONS.BOOK_ISSUED,
    description: `"${bookTitle}" issued to ${studentName} (due ${dueDate})`,
    entityId:    newId,
    entityType:  ENTITY_TYPES.ISSUE,
    meta:        { bookId, studentId, dueDate, issueDate },
  });

  return newId;
};

export const addLoan = async (loanData) => {
  const { bookId, memberId: studentId, studentId: sid,
          book: bookTitle, member: studentName, rollNo: studentIdNo,
          dueDate, issueDate } = loanData;
  return issueBook({
    bookId, studentId: studentId || sid,
    issueDate, dueDate,
    bookTitle, studentName, studentIdNo,
  });
};

/**
 * Return a book using a Firestore TRANSACTION.
 * Atomic: marks returned, freezes fine, increments available copies, logs activity.
 */
export const returnBook = async (issueId, bookId) => {
  const settings = await getSettings();

  return runTransaction(db, async (tx) => {
    const issueRef = doc(db, "issuedBooks", issueId);
    const bookRef  = doc(db, "books", bookId);

    const [issueSnap, bookSnap] = await Promise.all([tx.get(issueRef), tx.get(bookRef)]);

    if (!issueSnap.exists()) throw new Error("Issue record not found.");

    const issue = issueSnap.data();
    if (issue.status === "returned") throw new Error("Book has already been returned.");

    // Fine frozen at return time
    const today = new Date().toISOString().slice(0, 10);
    const fine  = calculateFine(issue.dueDate, settings);

    tx.update(issueRef, {
      status:     "returned",
      returnDate: today,
      fine,
      updatedAt:  serverTimestamp(),
    });

    if (bookSnap.exists()) {
      const book     = bookSnap.data();
      const total    = book.totalQuantity ?? book.copies ?? 999;
      const newAvail = Math.min(total, (book.availableQuantity ?? book.available ?? 0) + 1);
      tx.update(bookRef, { availableQuantity: newAvail, updatedAt: serverTimestamp() });
    }

    return { issue, fine, today };
  }).then(async ({ issue, fine, today }) => {
    await logActivity({
      action:      ACTIONS.BOOK_RETURNED,
      description: `"${issue.bookTitle}" returned by ${issue.studentName}${fine > 0 ? ` · Fine: ₹${fine}` : ""}`,
      entityId:    issueId,
      entityType:  ENTITY_TYPES.ISSUE,
      meta:        { bookId, fine, returnDate: today },
    });
    if (fine > 0) {
      await logActivity({
        action:      ACTIONS.FINE_RECORDED,
        description: `Fine of ₹${fine} recorded for "${issue.bookTitle}" returned by ${issue.studentName}`,
        entityId:    issueId,
        entityType:  ENTITY_TYPES.ISSUE,
        meta:        { fine, bookId, studentId: issue.studentId },
      });
    }
  });
};

export const returnLoan = returnBook;
export const deleteLoan = (id) => deleteDoc(doc(db, "issuedBooks", id));

/**
 * Renew an active book loan using a Firestore TRANSACTION.
 * Validates:
 *  - Issue is active
 *  - Renewal count < renewalLimit from settings
 *  - Student is not blocked/suspended
 *  - Overdue rule: if preventOverdueRenewal is true, blocks renewal if overdue
 * Updates:
 *  - dueDate extended by defaultLoanDuration
 *  - renewalCount incremented
 *  - lastRenewedAt timestamp recorded
 */
export const renewBook = async (issueId) => {
  const settings = await getSettings();

  return runTransaction(db, async (tx) => {
    const issueRef = doc(db, "issuedBooks", issueId);
    const issueSnap = await tx.get(issueRef);

    if (!issueSnap.exists()) throw new Error("Issue record not found.");
    const issue = issueSnap.data();

    if (issue.status === "returned") {
      throw new Error("Cannot renew a book that has already been returned.");
    }

    // Check student status
    if (issue.studentId) {
      const studentSnap = await tx.get(doc(db, "students", issue.studentId));
      if (studentSnap.exists()) {
        const sStatus = (studentSnap.data().status || "ACTIVE").toUpperCase();
        if (sStatus === "BLOCKED" || sStatus === "SUSPENDED") {
          throw new Error(`Cannot renew: Student account is ${sStatus}.`);
        }
      }
    }

    // Check renewal count
    const currentRenewals = Number(issue.renewalCount || 0);
    const limit = Number(settings.renewalLimit ?? 2);
    if (currentRenewals >= limit) {
      throw new Error(`Maximum renewal limit (${limit}) has been reached for this loan.`);
    }

    // Check overdue renewal restriction
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = issue.dueDate && (new Date(today) > new Date(issue.dueDate));
    if (settings.preventOverdueRenewal && isOverdue) {
      throw new Error("Overdue books cannot be renewed. Please return the book and clear any applicable fine.");
    }

    // Calculate new due date (extend by default loan duration)
    const baseDate = new Date(issue.dueDate && new Date(issue.dueDate) > new Date(today) ? issue.dueDate : today);
    baseDate.setDate(baseDate.getDate() + (settings.defaultLoanDuration || 14));
    const newDueDate = baseDate.toISOString().slice(0, 10);

    tx.update(issueRef, {
      dueDate:          newDueDate,
      currentDueDate:   newDueDate,
      originalDueDate:  issue.originalDueDate || issue.dueDate || today,
      renewalCount:     currentRenewals + 1,
      lastRenewedAt:    serverTimestamp(),
      updatedAt:        serverTimestamp(),
    });

    return { issue, newDueDate, renewalCount: currentRenewals + 1 };
  }).then(async ({ issue, newDueDate, renewalCount }) => {
    await logActivity({
      action:      ACTIONS.BOOK_RENEWED,
      description: `"${issue.bookTitle}" loan renewed for ${issue.studentName} (Renewal #${renewalCount}, new due date: ${newDueDate})`,
      entityId:    issueId,
      entityType:  ENTITY_TYPES.ISSUE,
      meta:        { bookId: issue.bookId, studentId: issue.studentId, newDueDate, renewalCount },
    });
  });
};

/** Get all issued books for a specific student. */
export const getStudentHistory = async (studentId) => {
  const q    = query(issuedCol, where("studentId", "==", studentId), orderBy("issueDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** Get all active issues for a specific book. */
export const getBookActiveIssues = async (bookId) => {
  const q    = query(issuedCol, where("bookId", "==", bookId), where("status", "==", "issued"), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** Fetch issued books with filters and pagination. */
export const fetchIssuedPage = async (pageSize = 50, afterDoc = null, filters = {}) => {
  let constraints = [orderBy("issueDate", "desc"), limit(pageSize)];

  if (filters.status && filters.status !== "All") {
    if (filters.status === "issued") {
      constraints = [where("status", "==", "issued"), ...constraints];
    } else if (filters.status === "returned") {
      constraints = [where("status", "==", "returned"), ...constraints];
    }
  }

  if (afterDoc) {
    constraints = [...constraints.filter(c => c !== constraints[constraints.length - 1]), startAfter(afterDoc), limit(pageSize)];
  }

  const q    = query(issuedCol, ...constraints);
  const snap = await getDocs(q);
  return {
    records: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// STAFF MANAGEMENT (Admin Only)
// ═══════════════════════════════════════════════════════════════════════════

export const fetchStaffMembers = async () => {
  const snap = await getDocs(usersCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateStaffRole = async (userId, newRole) => {
  const upper = String(newRole).toUpperCase();
  await updateDoc(doc(db, "users", userId), {
    role: upper,
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    action:      ACTIONS.ROLE_CHANGED,
    description: `Staff member role updated to ${upper}`,
    entityId:    userId,
    entityType:  ENTITY_TYPES.USER,
    meta:        { role: upper },
  });
};

export const updateStaffStatus = async (userId, newStatus) => {
  const status = String(newStatus).toLowerCase(); // 'active' | 'disabled'
  await updateDoc(doc(db, "users", userId), {
    status,
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    action:      ACTIONS.USER_STATUS_CHANGED,
    description: `Staff account status changed to ${status}`,
    entityId:    userId,
    entityType:  ENTITY_TYPES.USER,
    meta:        { status },
  });
};

export const createStaffProfile = async (userId, { name, email, role, status = "active" }) => {
  const upperRole = String(role || "ASSISTANT").toUpperCase();
  await setDoc(doc(db, "users", userId), {
    name:      name.trim(),
    email:     email.trim().toLowerCase(),
    role:      upperRole,
    status:    status.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await logActivity({
    action:      ACTIONS.USER_CREATED,
    description: `Staff profile created: ${name} (${email}) as ${upperRole}`,
    entityId:    userId,
    entityType:  ENTITY_TYPES.USER,
    meta:        { name, email, role: upperRole },
  });
};
