import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

// ── Audit Logging ─────────────────────────────────────────────────────────
/**
 * Write a structured audit event to Firestore.
 * NEVER log: passwords, session tokens, or secrets.
 */
async function writeAuditLog(event) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      timestamp:  serverTimestamp(),
      event:      event.event,           // "login_success" | "login_failure" | "logout" | "access_denied"
      identifier: event.identifier ?? null,  // email/uid only — never a password
      userAgent:  navigator.userAgent ?? null,
      details:    event.details ?? null,
    });
  } catch {
    // Never let audit-log failures crash the auth flow
  }
}

// ── Authentication ────────────────────────────────────────────────────────
/**
 * Sign in with email + password.
 * Returns the Firebase user on success.
 * Always throws a generic message — never reveals whether the
 * email exists or the password was wrong (prevents user enumeration).
 */
export async function loginWithEmail(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await writeAuditLog({
      event:      "login_success",
      identifier: credential.user.uid,   // UID only, not the password
      details:    "Admin login succeeded",
    });
    return credential.user;
  } catch (err) {
    await writeAuditLog({
      event:      "login_failure",
      identifier: email,                 // email is not a secret
      details:    `Firebase error code: ${err.code ?? "unknown"}`,
    });
    // Always throw the same generic message
    throw new Error("Invalid email or password.");
  }
}

/**
 * Fetch the Firestore user profile for a given UID.
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

/**
 * Sign out the current user and write an audit log entry.
 */
export async function logout() {
  const uid = auth.currentUser?.uid;
  await signOut(auth);
  await writeAuditLog({ event: "logout", identifier: uid, details: "Admin logout" });
}

/**
 * Subscribe to Firebase auth state changes.
 * Returns the unsubscribe function.
 */
export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Write an access-denied audit event (non-admin tried to log in).
 */
export async function logAccessDenied(uid) {
  await writeAuditLog({
    event:      "access_denied",
    identifier: uid,
    details:    "User authenticated but lacks admin role",
  });
}
