import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { logActivity, ACTIONS, ENTITY_TYPES } from "./activityLog";

const BACKUP_COLLECTIONS = ["books", "students", "issuedBooks", "settings", "activityLogs"];

/**
 * Sanitize a document object to ensure NO secrets, passwords, or tokens are ever exported.
 */
function sanitizeDocData(data) {
  if (!data || typeof data !== "object") return data;
  const clone = { ...data };
  const sensitiveKeys = [
    "password", "pass", "secret", "token", "accessToken",
    "refreshToken", "privateKey", "clientSecret", "apiKey",
    "credential", "credentials", "serviceAccount",
  ];

  for (const k of Object.keys(clone)) {
    const lower = k.toLowerCase();
    if (sensitiveKeys.some(s => lower.includes(s.toLowerCase()))) {
      delete clone[k];
    }
  }
  return clone;
}

/**
 * Export complete application data backup (sanitized JSON).
 */
export async function generateApplicationBackup() {
  const backup = {
    version: "3.0.0",
    appName: "LibraryOS",
    createdAt: new Date().toISOString(),
    collections: {},
    stats: {},
  };

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      backup.collections[colName] = snap.docs.map(d => ({
        id: d.id,
        data: sanitizeDocData(d.data()),
      }));
      backup.stats[colName] = snap.docs.length;
    } catch {
      backup.collections[colName] = [];
      backup.stats[colName] = 0;
    }
  }

  await logActivity({
    action:      ACTIONS.BACKUP_EXPORTED,
    description: `Database backup exported (${Object.entries(backup.stats).map(([k, v]) => `${v} ${k}`).join(', ')})`,
    entityType:  ENTITY_TYPES.BACKUP,
    meta:        { stats: backup.stats },
  });

  return backup;
}

/**
 * Validate backup JSON file structure before restoring.
 */
export function validateBackupFile(backupJson) {
  if (!backupJson || typeof backupJson !== "object") {
    return { valid: false, message: "Invalid JSON object." };
  }
  if (!backupJson.collections || typeof backupJson.collections !== "object") {
    return { valid: false, message: "Backup file is missing 'collections' payload." };
  }

  const collections = Object.keys(backupJson.collections);
  const foundKnown = collections.filter(c => BACKUP_COLLECTIONS.includes(c));
  if (foundKnown.length === 0) {
    return { valid: false, message: "No compatible LibraryOS collections found in backup." };
  }

  const counts = {};
  for (const col of foundKnown) {
    const items = backupJson.collections[col];
    if (Array.isArray(items)) {
      counts[col] = items.length;
    }
  }

  return {
    valid: true,
    version: backupJson.version || "Unknown",
    createdAt: backupJson.createdAt || "Unknown",
    counts,
  };
}

/**
 * Restore backup data into Firestore safely using batched writes.
 */
export async function restoreApplicationBackup(backupJson) {
  const validation = validateBackupFile(backupJson);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  let totalRestored = 0;

  for (const colName of Object.keys(backupJson.collections)) {
    if (!BACKUP_COLLECTIONS.includes(colName)) continue;

    const items = backupJson.collections[colName];
    if (!Array.isArray(items)) continue;

    // Process in batches of 400 (Firestore limit is 500 per batch)
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item.id || !item.data) continue;
        const ref = doc(db, colName, String(item.id));
        const sanitized = sanitizeDocData(item.data);
        batch.set(ref, sanitized, { merge: true });
        totalRestored++;
      }

      await batch.commit();
    }
  }

  await logActivity({
    action:      ACTIONS.BACKUP_IMPORTED,
    description: `Database backup restored successfully (${totalRestored} documents restored)`,
    entityType:  ENTITY_TYPES.BACKUP,
    meta:        { totalRestored, stats: validation.counts },
  });

  return { totalRestored, stats: validation.counts };
}
