import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, BookOpen, GraduationCap,
  ArrowLeftRight, History, LogOut, X,
  AlertTriangle, FileText, BarChart2, Settings,
  Users, HardDrive, ShieldCheck,
} from 'lucide-react';
import { PERMISSIONS } from '../services/permissions';

const ALL_NAV = [
  { id: 'dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
  { id: 'books',       label: 'Books',             icon: BookOpen },
  { id: 'members',     label: 'Students',          icon: GraduationCap },
  { id: 'issue',       label: 'Issue / Return',    icon: ArrowLeftRight },
  { id: 'loans',       label: 'Loan History',      icon: History },
  { id: 'overdue',     label: 'Overdue',           icon: AlertTriangle },
  { id: 'reports',     label: 'Reports',           icon: BarChart2 },
  { id: 'activitylog', label: 'Activity Log',      icon: FileText,       permission: PERMISSIONS.VIEW_AUDIT_LOGS },
  { id: 'staff',       label: 'Staff Management',  icon: Users,          permission: PERMISSIONS.MANAGE_USERS },
  { id: 'backup',      label: 'Backup & Restore',  icon: HardDrive,      permission: PERMISSIONS.BACKUP_RESTORE },
  { id: 'settings',    label: 'Settings',          icon: Settings,       permission: PERMISSIONS.MANAGE_SETTINGS },
];

export default function Sidebar({ activePage, onNavigate, onLogout, mobileOpen, onMobileClose }) {
  const { profile, role, hasPerm } = useAuth();

  const content = (
    <aside
      className="w-[200px] h-screen flex flex-col bg-[#0b0f1a] border-r border-[#1e2330]"
      style={{ minWidth: 200 }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[#1e2330]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f5a623,#e08910)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: '#22c55e' }} />
              <div style={{ width: 9, height: 9, borderRadius: 2, background: '#3b82f6' }} />
              <div style={{ width: 9, height: 9, borderRadius: 2, background: '#f97316' }} />
              <div style={{ width: 9, height: 9, borderRadius: 2, background: '#a855f7' }} />
            </div>
          </div>
          <div>
            <div className="text-white text-sm font-bold leading-tight">LibraryOS</div>
            <div className="text-[#4b5563] text-[10px] leading-tight">v2.0 · Admin</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-3 pt-4 pb-1">
        <span className="text-[#374151] text-[9px] font-bold tracking-[0.15em] uppercase px-2">Menu</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {ALL_NAV.filter(item => !item.permission || hasPerm(item.permission)).map(({ id, label, icon: Icon }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => { onNavigate(id); onMobileClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left border-l-2 ${
                active
                  ? 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]'
                  : 'text-[#6b7280] hover:text-[#d1d5db] hover:bg-[#131720] border-transparent'
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 pt-3 border-t border-[#1e2330] space-y-1">
        <div className="px-3 py-2 mb-1">
          <div className="text-[#9ca3af] text-xs font-medium truncate">
            {profile?.name || profile?.email || 'Staff'}
          </div>
          <div className="text-[#4b5563] text-[10px] flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            <span className="font-semibold text-[#9ca3af]">{role || 'ADMIN'}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#ef4444] hover:bg-red-950/30 transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop — fixed */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen z-30">
        {content}
      </div>

      {/* Mobile — drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="relative z-50 h-full">
            {content}
            <button
              onClick={onMobileClose}
              className="absolute top-4 right-[-40px] text-white bg-[#131720] border border-[#1e2330] rounded-lg p-1.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
