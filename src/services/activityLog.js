import {
  collection, addDoc, getDocs, query,
  orderBy, limit, where, startAfter,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { auth } from "../firebase";

const activityCol = collection(db, "activityLogs");

/**
 * Write an activity log entry.
 * NEVER log: passwords, tokens, secrets or credentials.
 *
 * @param {object} entry
 * @param {string} entry.action       - e.g. ACTIONS.BOOK_CREATED
 * @param {string} entry.description  - human-readable description
 * @param {string} [entry.entityId]   - affected record ID
 * @param {string} [entry.entityType] - "book" | "student" | "issue" | "setting" | "user" | "backup"
 * @param {string} [entry.userName]   - actor name
 * @param {object} [entry.meta]       - safe metadata (no secrets)
 */
export async function logActivity(entry) {
  try {
    const uid   = auth.currentUser?.uid ?? "system";
    const email = auth.currentUser?.email ?? null;
    await addDoc(activityCol, {
      action:      entry.action,
      description: entry.description,
      entityId:    entry.entityId   ?? null,
      entityType:  entry.entityType ?? null,
      actorUid:    uid,
      userId:      uid,
      actorEmail:  email,
      userName:    entry.userName   ?? email ?? "Staff Member",
      timestamp:   serverTimestamp(),
      meta:        entry.meta ?? null,
    });
  } catch {
    // Never let audit log failures crash user flows
  }
}

/**
 * Fetch one page of activity logs with optional filtering.
 * @param {number} pageSize
 * @param {object|null} afterDoc - last Firestore doc snapshot for pagination
 * @param {object} filters       - { action, entityType, userEmail, dateFrom, dateTo }
 */
export async function fetchActivityLogs(pageSize = 20, afterDoc = null, filters = {}) {
  const filterConstraints = [];

  if (filters.action && filters.action !== 'All') {
    filterConstraints.push(where("action", "==", filters.action));
  }
  if (filters.entityType && filters.entityType !== 'All') {
    filterConstraints.push(where("entityType", "==", filters.entityType));
  }
  if (filters.userEmail && filters.userEmail !== 'All') {
    filterConstraints.push(where("actorEmail", "==", filters.userEmail));
  }

  // Order + pagination
  const paginationConstraints = [orderBy("timestamp", "desc")];
  if (afterDoc) paginationConstraints.push(startAfter(afterDoc));
  paginationConstraints.push(limit(pageSize));

  const q    = query(activityCol, ...filterConstraints, ...paginationConstraints);
  const snap = await getDocs(q);

  return {
    logs:    snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}

// ── Action constants ─────────────────────────────────────────────────────────
export const ACTIONS = {
  // Books
  BOOK_CREATED:           "book_created",
  BOOK_UPDATED:           "book_updated",
  BOOK_DELETED:           "book_deleted",
  // Backward compat aliases
  BOOK_ADDED:             "book_created",
  BOOK_EDITED:            "book_updated",

  // Students
  STUDENT_CREATED:        "student_created",
  STUDENT_UPDATED:        "student_updated",
  STUDENT_DELETED:        "student_deleted",
  STUDENT_STATUS_CHANGED: "student_status_changed",
  STUDENT_BLOCKED:        "student_blocked",
  STUDENT_UNBLOCKED:      "student_unblocked",
  // Backward compat aliases
  STUDENT_ADDED:          "student_created",
  STUDENT_EDITED:         "student_updated",

  // Circulation
  BOOK_ISSUED:            "book_issued",
  BOOK_RETURNED:          "book_returned",
  BOOK_RENEWED:           "book_renewed",
  FINE_CREATED:           "fine_created",
  FINE_UPDATED:           "fine_updated",
  FINE_RECORDED:          "fine_recorded",

  // Staff / Users
  USER_CREATED:           "user_created",
  USER_UPDATED:           "user_updated",
  ROLE_CHANGED:           "role_changed",
  USER_STATUS_CHANGED:    "user_status_changed",

  // Settings
  SETTINGS_UPDATED:       "settings_updated",
  SETTINGS_CHANGED:       "settings_updated",

  // Backup / Restore
  BACKUP_EXPORTED:        "backup_exported",
  BACKUP_IMPORTED:        "backup_imported",

  // Reminders
  REMINDER_SENT:          "reminder_sent",

  // Auth
  LOGIN:                  "login",
  LOGOUT:                 "logout",
};

export const ENTITY_TYPES = {
  BOOK:    "book",
  STUDENT: "student",
  ISSUE:   "issue",
  SETTING: "setting",
  USER:    "user",
  BACKUP:  "backup",
  REMINDER: "reminder",
  AUTH:    "auth",
};
