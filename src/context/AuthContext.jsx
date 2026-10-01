import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { subscribeAuthState, getUserProfile, logout as firebaseLogout, logAccessDenied } from "../services/auth";
import {
  ROLES,
  normalizeRole,
  hasPermission,
  canManageBooks,
  canDeleteBooks,
  canManageStudents,
  canDeleteStudents,
  canChangeStudentStatus,
  canIssueBooks,
  canReturnBooks,
  canRenewBooks,
  canManageUsers,
  canManageSettings,
  canViewAuditLogs,
  canBackupRestore,
  canExportReports,
  canSendReminders,
} from "../services/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsub = subscribeAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userProfile = await getUserProfile(firebaseUser.uid);

        // If no profile found in Firestore users collection
        if (!userProfile) {
          await logAccessDenied(firebaseUser.uid);
          await firebaseLogout();
          setAuthError("No staff account found for this user. Please contact an administrator.");
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Check if account status is disabled or blocked
        if (userProfile.status === "disabled" || userProfile.status === "blocked") {
          await logAccessDenied(firebaseUser.uid);
          await firebaseLogout();
          setAuthError("Your account has been disabled. Please contact an administrator.");
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const role = normalizeRole(userProfile.role);
        // Valid roles: ADMIN, LIBRARIAN, ASSISTANT
        if (![ROLES.ADMIN, ROLES.LIBRARIAN, ROLES.ASSISTANT].includes(role)) {
          await logAccessDenied(firebaseUser.uid);
          await firebaseLogout();
          setAuthError("Access denied. Authorized staff role required.");
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setAuthError(null);
        setUser(firebaseUser);
        setProfile({ ...userProfile, role });
      } catch (err) {
        await firebaseLogout();
        setUser(null);
        setProfile(null);
        setAuthError("Authentication check failed. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
    setProfile(null);
  };

  const role = useMemo(() => normalizeRole(profile?.role), [profile?.role]);

  const value = useMemo(() => ({
    user,
    profile,
    role,
    loading,
    authError,
    logout,
    // Role booleans
    isAdmin:     role === ROLES.ADMIN,
    isLibrarian: role === ROLES.LIBRARIAN,
    isAssistant: role === ROLES.ASSISTANT,
    // Permission helpers
    hasPerm: (perm) => hasPermission(role, perm),
    canManageBooks: () => canManageBooks(role),
    canDeleteBooks: () => canDeleteBooks(role),
    canManageStudents: () => canManageStudents(role),
    canDeleteStudents: () => canDeleteStudents(role),
    canChangeStudentStatus: () => canChangeStudentStatus(role),
    canIssueBooks: () => canIssueBooks(role),
    canReturnBooks: () => canReturnBooks(role),
    canRenewBooks: () => canRenewBooks(role),
    canManageUsers: () => canManageUsers(role),
    canManageSettings: () => canManageSettings(role),
    canViewAuditLogs: () => canViewAuditLogs(role),
    canBackupRestore: () => canBackupRestore(role),
    canExportReports: () => canExportReports(role),
    canSendReminders: () => canSendReminders(role),
  }), [user, profile, role, loading, authError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
