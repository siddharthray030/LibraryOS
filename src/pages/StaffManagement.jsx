import { useState, useEffect } from 'react';
import { fetchStaffMembers, updateStaffRole, updateStaffStatus, createStaffProfile } from '../services/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../services/permissions';
import {
  Users, UserPlus, Shield, CheckCircle2,
  XCircle, X, Search, RefreshCw, AlertTriangle,
} from 'lucide-react';

const ROLE_BADGE = {
  ADMIN:     { text: 'text-[#ef4444]', bg: 'bg-red-950/40 border-red-800/40' },
  LIBRARIAN: { text: 'text-[#f5a623]', bg: 'bg-amber-950/40 border-amber-800/40' },
  ASSISTANT: { text: 'text-[#60a5fa]', bg: 'bg-blue-950/40 border-blue-800/40' },
};

export default function StaffManagement() {
  const { user: currentUser, isAdmin } = useAuth();
  const toast = useToast();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal for adding staff profile
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    uid: '',
    role: ROLES.ASSISTANT,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await fetchStaffMembers();
      setStaffList(data);
    } catch {
      toast.error('Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === currentUser?.uid && newRole !== ROLES.ADMIN) {
      toast.error("You cannot demote yourself from Admin.");
      return;
    }
    try {
      await updateStaffRole(targetUser.id, newRole);
      setStaffList(prev => prev.map(s => s.id === targetUser.id ? { ...s, role: newRole } : s));
      toast.success(`Role updated to ${newRole} for ${targetUser.name || targetUser.email}.`);
    } catch {
      toast.error("Failed to update staff role.");
    }
  };

  const handleStatusToggle = async (targetUser) => {
    if (targetUser.id === currentUser?.uid) {
      toast.error("You cannot disable your own admin account.");
      return;
    }
    const currentStatus = (targetUser.status || 'active').toLowerCase();
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';

    try {
      await updateStaffStatus(targetUser.id, newStatus);
      setStaffList(prev => prev.map(s => s.id === targetUser.id ? { ...s, status: newStatus } : s));
      toast.success(`Account ${newStatus === 'active' ? 'enabled' : 'disabled'} for ${targetUser.name || targetUser.email}.`);
    } catch {
      toast.error("Failed to update account status.");
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      // Use provided Auth UID or generate a placeholder ID
      const targetUid = formData.uid.trim() || `staff_${Date.now()}`;
      await createStaffProfile(targetUid, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: 'active',
      });
      toast.success(`Staff profile created for ${formData.name}.`);
      setModalOpen(false);
      setFormData({ name: '', email: '', uid: '', role: ROLES.ASSISTANT });
      loadStaff();
    } catch (err) {
      toast.error(err.message || "Failed to create staff profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staffList.filter(s => {
    const q = search.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q);
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center min-h-screen bg-[#0f1117] flex flex-col items-center justify-center">
        <Shield size={36} className="text-[#ef4444] mb-3" />
        <h2 className="text-white text-lg font-bold">Access Restricted</h2>
        <p className="text-[#6b7280] text-sm mt-1 max-w-sm">
          Staff and role management requires Administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Staff & Role Management</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">Manage staff permissions, roles, and account access</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStaff}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] transition-colors"
          >
            <UserPlus size={14} /> Add / Register Staff
          </button>
        </div>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <h3 className="text-white font-semibold text-sm">ADMIN</h3>
          </div>
          <p className="text-[#6b7280] text-xs">
            Full system control: Staff management, critical library settings, audit logs, backup & restore.
          </p>
        </div>
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f5a623]" />
            <h3 className="text-white font-semibold text-sm">LIBRARIAN</h3>
          </div>
          <p className="text-[#6b7280] text-xs">
            Operational control: Manage books & students, issue/return/renew, view analytics, reports & exports.
          </p>
        </div>
        <div className="bg-[#131720] border border-[#1e2330] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]" />
            <h3 className="text-white font-semibold text-sm">ASSISTANT</h3>
          </div>
          <p className="text-[#6b7280] text-xs">
            Front-desk access: Catalog lookup, issue & return, renewals. Cannot delete books/students or change settings.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b5563]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter staff by name, email, role..."
          className="w-full bg-[#131720] border border-[#1e2330] text-sm text-white placeholder-[#4b5563] pl-9 pr-3 py-2 rounded-lg outline-none focus:border-[#374151]"
        />
      </div>

      {/* Staff Table */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1e2330]">
                {['Staff Member', 'Role', 'Status', 'Account UID', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {loading && [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-4 py-4"><div className="h-4 bg-[#1e2330] rounded w-full" /></td>
                </tr>
              ))}

              {!loading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-[#6b7280]">
                    <Users size={28} className="mx-auto text-[#374151] mb-2" />
                    No staff members found.
                  </td>
                </tr>
              )}

              {!loading && filteredStaff.map(s => {
                const roleBadge = ROLE_BADGE[s.role] || ROLE_BADGE.ASSISTANT;
                const isActive = (s.status || 'active').toLowerCase() === 'active';
                const isCurrent = s.id === currentUser?.uid;

                return (
                  <tr key={s.id} className="hover:bg-[#1a2035] transition-colors">
                    {/* Name & Email */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1e2330] border border-[#374151] flex items-center justify-center text-xs font-bold text-white uppercase">
                          {(s.name || s.email || '?').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium flex items-center gap-1.5">
                            {s.name || 'Staff Member'}
                            {isCurrent && <span className="text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.2 rounded font-normal">You</span>}
                          </div>
                          <div className="text-xs text-[#6b7280]">{s.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role selector */}
                    <td className="px-4 py-3.5">
                      <select
                        value={s.role || ROLES.ASSISTANT}
                        onChange={e => handleRoleChange(s, e.target.value)}
                        disabled={isCurrent}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border outline-none bg-[#0b0f1a] cursor-pointer ${roleBadge.text} ${roleBadge.bg} disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <option value={ROLES.ADMIN}>ADMIN</option>
                        <option value={ROLES.LIBRARIAN}>LIBRARIAN</option>
                        <option value={ROLES.ASSISTANT}>ASSISTANT</option>
                      </select>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        isActive ? 'text-[#10b981] bg-emerald-950/40 border border-emerald-800/40' : 'text-[#ef4444] bg-red-950/40 border border-red-800/40'
                      }`}>
                        {isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    {/* UID */}
                    <td className="px-4 py-3.5 text-xs font-mono text-[#6b7280]">
                      {s.id?.slice(0, 14)}...
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleStatusToggle(s)}
                        disabled={isCurrent}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          isActive
                            ? 'border-red-800/40 text-[#ef4444] hover:bg-red-950/40'
                            : 'border-emerald-800/40 text-[#10b981] hover:bg-emerald-950/40'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {isActive ? 'Disable Access' : 'Enable Access'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#1e2330] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-[#1e2330] pb-3">
              <div>
                <h3 className="text-white font-bold text-base">Register Staff Profile</h3>
                <p className="text-xs text-[#6b7280] mt-0.5">Assign staff roles to new or existing accounts</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[#6b7280] hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-1">
                  Full Name <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Priya Sharma"
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-1">
                  Email Address <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="priya@school.edu"
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-1">
                  Assigned Role <span className="text-[#ef4444]">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                >
                  <option value={ROLES.ASSISTANT}>ASSISTANT (Front desk, issue/return)</option>
                  <option value={ROLES.LIBRARIAN}>LIBRARIAN (Catalog, students, reports)</option>
                  <option value={ROLES.ADMIN}>ADMIN (Full system administrator)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-1">
                  Firebase Auth UID <span className="text-[#6b7280] text-[10px] font-normal">(Optional if linking existing user)</span>
                </label>
                <input
                  type="text"
                  value={formData.uid}
                  onChange={e => setFormData(p => ({ ...p, uid: e.target.value }))}
                  placeholder="e.g. 7mR9xK4... (leave blank to auto-generate)"
                  className="w-full bg-[#0b0f1a] border border-[#1e2330] text-xs font-mono text-[#d1d5db] px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#1e2330]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 text-xs border border-[#374151] text-[#d1d5db] rounded-lg hover:bg-[#1e2330] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-bold bg-[#f5a623] text-black rounded-lg hover:bg-[#e09515] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
