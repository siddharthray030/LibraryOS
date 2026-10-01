/**
 * Role-Based Access Control (RBAC) Permissions & Helpers
 * Supported roles:
 *  - ADMIN: Full access to all operations, staff management, settings, audit logs, backup/restore.
 *  - LIBRARIAN: Manage books, students, issue/return/renew, view analytics, reports, export. Cannot manage staff or change critical settings/backups.
 *  - ASSISTANT: View/search books, view students, issue/return/renew. Cannot delete books/students, cannot manage staff, settings, audit logs, or backups.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  LIBRARIAN: 'LIBRARIAN',
  ASSISTANT: 'ASSISTANT',
};

/**
 * Normalize role string to uppercase standard
 */
export function normalizeRole(role) {
  if (!role) return ROLES.ASSISTANT;
  const upper = String(role).trim().toUpperCase();
  if (upper === 'ADMIN') return ROLES.ADMIN;
  if (upper === 'LIBRARIAN') return ROLES.LIBRARIAN;
  if (upper === 'ASSISTANT') return ROLES.ASSISTANT;
  return ROLES.ASSISTANT;
}

export const PERMISSIONS = {
  // Books
  VIEW_BOOKS: 'view_books',
  ADD_BOOKS: 'add_books',
  EDIT_BOOKS: 'edit_books',
  DELETE_BOOKS: 'delete_books',

  // Students
  VIEW_STUDENTS: 'view_students',
  ADD_STUDENTS: 'add_students',
  EDIT_STUDENTS: 'edit_students',
  DELETE_STUDENTS: 'delete_students',
  CHANGE_STUDENT_STATUS: 'change_student_status',

  // Circulation
  ISSUE_BOOKS: 'issue_books',
  RETURN_BOOKS: 'return_books',
  RENEW_BOOKS: 'renew_books',

  // Analytics & Reports
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Administrative
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  BACKUP_RESTORE: 'backup_restore',
  SEND_REMINDERS: 'send_reminders',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_BOOKS,
    PERMISSIONS.ADD_BOOKS,
    PERMISSIONS.EDIT_BOOKS,
    PERMISSIONS.DELETE_BOOKS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ADD_STUDENTS,
    PERMISSIONS.EDIT_STUDENTS,
    PERMISSIONS.DELETE_STUDENTS,
    PERMISSIONS.CHANGE_STUDENT_STATUS,
    PERMISSIONS.ISSUE_BOOKS,
    PERMISSIONS.RETURN_BOOKS,
    PERMISSIONS.RENEW_BOOKS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.BACKUP_RESTORE,
    PERMISSIONS.SEND_REMINDERS,
  ],
  [ROLES.LIBRARIAN]: [
    PERMISSIONS.VIEW_BOOKS,
    PERMISSIONS.ADD_BOOKS,
    PERMISSIONS.EDIT_BOOKS,
    PERMISSIONS.DELETE_BOOKS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ADD_STUDENTS,
    PERMISSIONS.EDIT_STUDENTS,
    PERMISSIONS.DELETE_STUDENTS,
    PERMISSIONS.CHANGE_STUDENT_STATUS,
    PERMISSIONS.ISSUE_BOOKS,
    PERMISSIONS.RETURN_BOOKS,
    PERMISSIONS.RENEW_BOOKS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.SEND_REMINDERS,
  ],
  [ROLES.ASSISTANT]: [
    PERMISSIONS.VIEW_BOOKS,
    PERMISSIONS.ADD_BOOKS,
    PERMISSIONS.EDIT_BOOKS,
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.ADD_STUDENTS,
    PERMISSIONS.EDIT_STUDENTS,
    PERMISSIONS.ISSUE_BOOKS,
    PERMISSIONS.RETURN_BOOKS,
    PERMISSIONS.RENEW_BOOKS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_REPORTS,
  ],
};

/**
 * Check if a given role has a specific permission
 */
export function hasPermission(role, permission) {
  const norm = normalizeRole(role);
  const list = ROLE_PERMISSIONS[norm] || [];
  return list.includes(permission);
}

/**
 * Enforce role requirement. Returns true if user's role meets one of the required roles.
 */
export function requireRole(userRole, allowedRoles = []) {
  const norm = normalizeRole(userRole);
  const allowed = allowedRoles.map(normalizeRole);
  return allowed.includes(norm);
}

// Convenience helper methods
export const canManageBooks = (role) => hasPermission(role, PERMISSIONS.ADD_BOOKS);
export const canDeleteBooks = (role) => hasPermission(role, PERMISSIONS.DELETE_BOOKS);

export const canManageStudents = (role) => hasPermission(role, PERMISSIONS.ADD_STUDENTS);
export const canDeleteStudents = (role) => hasPermission(role, PERMISSIONS.DELETE_STUDENTS);
export const canChangeStudentStatus = (role) => hasPermission(role, PERMISSIONS.CHANGE_STUDENT_STATUS);

export const canIssueBooks = (role) => hasPermission(role, PERMISSIONS.ISSUE_BOOKS);
export const canReturnBooks = (role) => hasPermission(role, PERMISSIONS.RETURN_BOOKS);
export const canRenewBooks = (role) => hasPermission(role, PERMISSIONS.RENEW_BOOKS);

export const canManageUsers = (role) => hasPermission(role, PERMISSIONS.MANAGE_USERS);
export const canManageSettings = (role) => hasPermission(role, PERMISSIONS.MANAGE_SETTINGS);
export const canViewAuditLogs = (role) => hasPermission(role, PERMISSIONS.VIEW_AUDIT_LOGS);
export const canBackupRestore = (role) => hasPermission(role, PERMISSIONS.BACKUP_RESTORE);
export const canExportReports = (role) => hasPermission(role, PERMISSIONS.EXPORT_REPORTS);
export const canSendReminders = (role) => hasPermission(role, PERMISSIONS.SEND_REMINDERS);
