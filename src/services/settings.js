import {
  doc, getDoc, setDoc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const PRIMARY_SETTINGS_DOC = doc(db, "settings", "library");
const LEGACY_SETTINGS_DOC  = doc(db, "settings", "librarySettings");

export const DEFAULT_SETTINGS = {
  // General Library Details
  libraryName:          "LibraryOS School Library",
  libraryEmail:         "library@school.edu",
  libraryPhone:         "+91 98765 43210",
  libraryAddress:       "Main Campus, Academic Block",

  // Borrowing Rules
  maxBooksPerStudent:   3,
  defaultLoanDuration:  14,
  loanPeriodDays:       14, // legacy alias
  renewalLimit:         2,
  preventOverdueRenewal: true,

  // Fine Rules
  finePerDay:           2,
  gracePeriod:          0,
  maximumFine:          100,

  // Inventory
  lowStockThreshold:    2,

  // Notifications
  dueSoonDays:                 3,
  enableOverdueNotifications:  true,
  enableDueSoonNotifications:  true,

  // System
  timezone:             "Asia/Kolkata",
  dateFormat:           "YYYY-MM-DD",

  // Email service state
  emailServiceConfigured: false,
};

/**
 * Subscribe to library settings in real-time.
 * Checks settings/library first, falls back to settings/librarySettings.
 */
export function subscribeSettings(callback) {
  return onSnapshot(PRIMARY_SETTINGS_DOC, (primarySnap) => {
    if (primarySnap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...primarySnap.data() });
    } else {
      // Check legacy doc once if primary doesn't exist yet
      getDoc(LEGACY_SETTINGS_DOC).then(legacySnap => {
        if (legacySnap.exists()) {
          callback({ ...DEFAULT_SETTINGS, ...legacySnap.data() });
        } else {
          callback(DEFAULT_SETTINGS);
        }
      }).catch(() => callback(DEFAULT_SETTINGS));
    }
  });
}

/**
 * Fetch settings once (for non-reactive service operations).
 */
export async function getSettings() {
  try {
    const primarySnap = await getDoc(PRIMARY_SETTINGS_DOC);
    if (primarySnap.exists()) {
      return { ...DEFAULT_SETTINGS, ...primarySnap.data() };
    }
    const legacySnap = await getDoc(LEGACY_SETTINGS_DOC);
    if (legacySnap.exists()) {
      return { ...DEFAULT_SETTINGS, ...legacySnap.data() };
    }
  } catch {
    // Return defaults on error
  }
  return DEFAULT_SETTINGS;
}

/**
 * Update library settings in Firestore (settings/library).
 * Also mirrors to legacy doc for full backward compatibility.
 * Admin only. NEVER include sensitive tokens or secrets.
 */
export async function updateSettings(data) {
  const sanitized = {
    // General
    libraryName:          String(data.libraryName || DEFAULT_SETTINGS.libraryName).trim(),
    libraryEmail:         String(data.libraryEmail || DEFAULT_SETTINGS.libraryEmail).trim(),
    libraryPhone:         String(data.libraryPhone || DEFAULT_SETTINGS.libraryPhone).trim(),
    libraryAddress:       String(data.libraryAddress || DEFAULT_SETTINGS.libraryAddress).trim(),

    // Borrowing rules
    maxBooksPerStudent:   Math.max(1, Number(data.maxBooksPerStudent ?? DEFAULT_SETTINGS.maxBooksPerStudent)),
    defaultLoanDuration:  Math.max(1, Number(data.defaultLoanDuration ?? data.loanPeriodDays ?? DEFAULT_SETTINGS.defaultLoanDuration)),
    loanPeriodDays:       Math.max(1, Number(data.defaultLoanDuration ?? data.loanPeriodDays ?? DEFAULT_SETTINGS.loanPeriodDays)),
    renewalLimit:         Math.max(0, Number(data.renewalLimit ?? DEFAULT_SETTINGS.renewalLimit)),
    preventOverdueRenewal: Boolean(data.preventOverdueRenewal ?? DEFAULT_SETTINGS.preventOverdueRenewal),

    // Fine rules
    finePerDay:           Math.max(0, Number(data.finePerDay ?? DEFAULT_SETTINGS.finePerDay)),
    gracePeriod:          Math.max(0, Number(data.gracePeriod ?? DEFAULT_SETTINGS.gracePeriod)),
    maximumFine:          Math.max(0, Number(data.maximumFine ?? DEFAULT_SETTINGS.maximumFine)),

    // Inventory
    lowStockThreshold:    Math.max(1, Number(data.lowStockThreshold ?? DEFAULT_SETTINGS.lowStockThreshold)),

    // Notifications
    dueSoonDays:          Math.max(1, Number(data.dueSoonDays ?? DEFAULT_SETTINGS.dueSoonDays)),
    enableOverdueNotifications: Boolean(data.enableOverdueNotifications ?? DEFAULT_SETTINGS.enableOverdueNotifications),
    enableDueSoonNotifications: Boolean(data.enableDueSoonNotifications ?? DEFAULT_SETTINGS.enableDueSoonNotifications),

    // System
    timezone:             String(data.timezone || DEFAULT_SETTINGS.timezone),
    dateFormat:           String(data.dateFormat || DEFAULT_SETTINGS.dateFormat),
    emailServiceConfigured: Boolean(data.emailServiceConfigured ?? DEFAULT_SETTINGS.emailServiceConfigured),

    updatedAt:            serverTimestamp(),
  };

  // Write to both primary and legacy locations
  await Promise.all([
    setDoc(PRIMARY_SETTINGS_DOC, sanitized, { merge: true }),
    setDoc(LEGACY_SETTINGS_DOC, sanitized, { merge: true }),
  ]);
}

/**
 * Calculate fine for an issued book using current settings.
 * @param {string} dueDate - ISO date string (YYYY-MM-DD)
 * @param {object} settings - settings object
 * @returns {number} fine amount in rupees
 */
export function calculateFine(dueDate, settings = DEFAULT_SETTINGS) {
  if (!dueDate) return 0;
  const today    = new Date(new Date().toDateString()); // midnight local
  const due      = new Date(dueDate);
  const diffMs   = today - due;
  if (diffMs <= 0) return 0;
  const daysLate = Math.floor(diffMs / 86400000);
  const afterGrace = Math.max(0, daysLate - (settings.gracePeriod ?? 0));
  if (afterGrace <= 0) return 0;
  const raw = afterGrace * (settings.finePerDay ?? 2);
  const max = (settings.maximumFine > 0) ? settings.maximumFine : Infinity;
  return Math.min(raw, max);
}

/**
 * Calculate overdue days dynamically (never stored).
 * @param {string} dueDate
 * @returns {number} 0 if not overdue, positive integer if overdue
 */
export function calcOverdueDays(dueDate) {
  if (!dueDate) return 0;
  const today = new Date(new Date().toDateString());
  const due   = new Date(dueDate);
  const diff  = Math.floor((today - due) / 86400000);
  return diff > 0 ? diff : 0;
}
