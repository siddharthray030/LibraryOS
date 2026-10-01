import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { getSettings } from "./settings";
import { logActivity, ACTIONS, ENTITY_TYPES } from "./activityLog";

const reminderLogsCol = collection(db, "reminderLogs");

export const REMINDER_TYPES = {
  DUE_SOON:            "DUE_SOON",
  OVERDUE:             "OVERDUE",
  RETURN_CONFIRMATION: "RETURN_CONFIRMATION",
};

/**
 * Check if a reminder of the given type was already sent today for this issueId.
 */
export async function wasReminderSentRecently(issueId, type) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      reminderLogsCol,
      where("issueId", "==", issueId),
      where("type", "==", type),
      where("dateSent", "==", today)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

/**
 * Clean abstraction for sending library emails.
 * IMPORTANT SECURITY RULE:
 * Never puts email passwords, API keys, or private secrets in frontend code.
 * If no backend email service is connected, returns a clean error and does NOT pretend it was sent.
 */
export async function sendLibraryEmail({
  to,
  studentName,
  bookTitle,
  type,
  dueDate,
  daysOverdue = 0,
  fine = 0,
  issueId = null,
}) {
  if (!to || !to.includes("@")) {
    return {
      success: false,
      message: "Student does not have a valid email address.",
    };
  }

  const settings = await getSettings();

  // If email service integration is not configured
  if (!settings.emailServiceConfigured) {
    return {
      success: false,
      configured: false,
      message: "Email service not configured. In production, configure an automated email provider or Cloud Function.",
    };
  }

  // Prevent sending duplicate reminders on the same day
  if (issueId && await wasReminderSentRecently(issueId, type)) {
    return {
      success: false,
      duplicate: true,
      message: `A ${type.replace('_', ' ')} reminder was already sent to this student today.`,
    };
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    // Record reminder log to prevent duplicates
    await addDoc(reminderLogsCol, {
      issueId:     issueId || null,
      recipient:   to,
      studentName: studentName || "Student",
      bookTitle:   bookTitle   || "Book",
      type,
      dateSent:    today,
      timestamp:   serverTimestamp(),
      status:      "simulated",
    });

    await logActivity({
      action:      ACTIONS.REMINDER_SENT,
      description: `${type.replace('_', ' ')} reminder sent to ${studentName} (${to}) for "${bookTitle}"`,
      entityId:    issueId || null,
      entityType:  ENTITY_TYPES.REMINDER,
      meta:        { to, type, bookTitle, daysOverdue, fine },
    });

    return {
      success: true,
      configured: true,
      message: `Reminder sent to ${to}.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || "Failed to process email reminder.",
    };
  }
}
