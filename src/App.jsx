import { useAuth } from './context/AuthContext';
import { useSettings, SettingsProvider } from './context/SettingsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import GlobalSearch from './components/GlobalSearch';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import Members from './pages/Members';
import IssueReturn from './pages/IssueReturn';
import LoanHistory from './pages/LoanHistory';
import Overdue from './pages/Overdue';
import ActivityLog from './pages/ActivityLog';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import StaffManagement from './pages/StaffManagement';
import BackupRestore from './pages/BackupRestore';
import Login from './pages/Login';
import { useState } from 'react';
import { Menu, ShieldAlert, LayoutDashboard, BookOpen, ArrowLeftRight, GraduationCap } from 'lucide-react';
import { PERMISSIONS } from './services/permissions';

const pages = {
  dashboard:   Dashboard,
  books:       Books,
  members:     Members,
  issue:       IssueReturn,
  loans:       LoanHistory,
  overdue:     Overdue,
  reports:     Reports,
  activitylog: ActivityLog,
  staff:       StaffManagement,
  backup:      BackupRestore,
  settings:    Settings,
};

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center animate-pulse"
        style={{ background: 'linear-gradient(135deg,#f5a623,#e08910)' }}
      >
        <span className="text-black font-bold text-sm">LI</span>
      </div>
      <p className="text-[#6b7280] text-sm">Loading LibraryOS...</p>
    </div>
  );
}

function AccessDenied({ pageTitle, onReturn }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center mb-4 text-[#ef4444]">
        <ShieldAlert size={28} />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
      <p className="text-sm text-[#9ca3af] max-w-md mb-6">
        You do not have the required permissions to access <span className="text-white font-medium">{pageTitle}</span>. Please contact an administrator if you need access.
      </p>
      <button
        onClick={onReturn}
        className="px-5 py-2.5 bg-[#f5a623] hover:bg-[#e08910] text-black font-semibold rounded-xl text-sm transition-colors"
      >
        Return to Dashboard
      </button>
    </div>
  );
}

// Inner component that has access to settings context
function AppInner() {
  const { user, profile, role, loading, logout, hasPerm } = useAuth();
  const { settings } = useSettings();
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!user)   return <Login />;

  // Permission checks for active page
  let PageComponent = pages[activePage] || Dashboard;
  
  if (activePage === 'staff' && !hasPerm(PERMISSIONS.MANAGE_USERS)) {
    PageComponent = () => <AccessDenied pageTitle="Staff Management" onReturn={() => setActivePage('dashboard')} />;
  } else if (activePage === 'backup' && !hasPerm(PERMISSIONS.BACKUP_RESTORE)) {
    PageComponent = () => <AccessDenied pageTitle="Backup & Restore" onReturn={() => setActivePage('dashboard')} />;
  } else if (activePage === 'settings' && !hasPerm(PERMISSIONS.MANAGE_SETTINGS)) {
    PageComponent = () => <AccessDenied pageTitle="Settings" onReturn={() => setActivePage('dashboard')} />;
  } else if (activePage === 'activitylog' && !hasPerm(PERMISSIONS.VIEW_AUDIT_LOGS)) {
    PageComponent = () => <AccessDenied pageTitle="Activity Log" onReturn={() => setActivePage('dashboard')} />;
  }

  return (
    <NotificationsProvider settings={settings}>
      <div className="flex h-screen overflow-hidden bg-[#0f1117] text-white">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={logout}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main layout area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0f1117] lg:ml-[200px]">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 h-16 bg-[#0b0f1a]/90 backdrop-blur-md border-b border-[#1e2330] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
            {/* Left: Mobile hamburger */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden bg-[#131720] border border-[#1e2330] text-white p-2 rounded-lg hover:bg-[#1a2035] transition-colors"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>

            {/* Center: Global Search Bar */}
            <div className="flex-1 max-w-lg mx-auto">
              <GlobalSearch onNavigate={setActivePage} />
            </div>

            {/* Right: Notifications & Quick Profile Role Badge */}
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#1e2330]">
                <div className="text-right">
                  <div className="text-xs font-semibold text-white truncate max-w-[120px]">
                    {profile?.name || profile?.email?.split('@')[0] || 'Staff'}
                  </div>
                  <div className="text-[10px] text-[#f5a623] font-bold uppercase tracking-wider">
                    {role || 'ADMIN'}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main scrollable content view */}
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
            <PageComponent onNavigate={setActivePage} />
          </main>

          {/* Mobile Bottom Bar for Librarian on the Go (Stacks Mode) */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0f1a]/95 backdrop-blur-md border-t border-[#1e2330] py-1.5 px-3 flex items-center justify-around">
            <button
              onClick={() => setActivePage('dashboard')}
              className={`flex flex-col items-center gap-0.5 p-1 text-xs font-medium ${
                activePage === 'dashboard' ? 'text-[#f5a623]' : 'text-[#6b7280]'
              }`}
            >
              <LayoutDashboard size={18} />
              <span className="text-[10px]">Dashboard</span>
            </button>
            <button
              onClick={() => setActivePage('books')}
              className={`flex flex-col items-center gap-0.5 p-1 text-xs font-medium ${
                activePage === 'books' ? 'text-[#f5a623]' : 'text-[#6b7280]'
              }`}
            >
              <BookOpen size={18} />
              <span className="text-[10px]">Books</span>
            </button>
            <button
              onClick={() => setActivePage('issue')}
              className={`flex flex-col items-center gap-0.5 p-1 text-xs font-medium ${
                activePage === 'issue' ? 'text-[#f5a623]' : 'text-[#6b7280]'
              }`}
            >
              <ArrowLeftRight size={18} />
              <span className="text-[10px]">Circulate</span>
            </button>
            <button
              onClick={() => setActivePage('members')}
              className={`flex flex-col items-center gap-0.5 p-1 text-xs font-medium ${
                activePage === 'members' ? 'text-[#f5a623]' : 'text-[#6b7280]'
              }`}
            >
              <GraduationCap size={18} />
              <span className="text-[10px]">Students</span>
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center gap-0.5 p-1 text-xs font-medium text-[#6b7280]"
            >
              <Menu size={18} />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </div>
      </div>
    </NotificationsProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}

