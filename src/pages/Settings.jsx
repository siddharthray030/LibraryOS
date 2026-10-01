import { useState, useEffect } from 'react';
import { subscribeSettings, updateSettings, DEFAULT_SETTINGS } from '../services/settings';
import { logActivity, ACTIONS, ENTITY_TYPES } from '../services/activityLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Settings as SettingsIcon, Save, RotateCcw,
  BookOpen, Shield, Bell, Globe,
} from 'lucide-react';

export default function Settings() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'borrowing' | 'fines' | 'notifications'
  const [saved, setSaved] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeSettings(s => {
      setSaved(s);
      setForm(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!isAdmin) {
      toast.error('Only Administrators can modify library settings.');
      return;
    }

    setSaving(true);
    try {
      await updateSettings(form);
      await logActivity({
        action:      ACTIONS.SETTINGS_UPDATED,
        description: `Library settings updated (${activeTab} section)`,
        entityType:  ENTITY_TYPES.SETTING,
        meta:        { tab: activeTab },
      });
      toast.success('Settings saved successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(saved);
  };

  const updateField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center min-h-screen bg-[#0f1117] flex flex-col items-center justify-center">
        <Shield size={36} className="text-[#ef4444] mb-3" />
        <h2 className="text-white text-lg font-bold">Access Restricted</h2>
        <p className="text-[#6b7280] text-sm mt-1 max-w-sm">
          Modifying library configuration settings requires Administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-white text-2xl font-bold">Library Settings</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">Central system parameters, borrowing limits, fines, and automated policies</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#d1d5db] text-xs rounded-lg hover:bg-[#1e2330] disabled:opacity-40 transition-colors"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f5a623] text-black text-xs font-bold rounded-lg hover:bg-[#e09515] disabled:opacity-50 transition-colors"
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e2330] overflow-x-auto gap-1">
        {[
          { id: 'general', label: 'General Info', icon: Globe },
          { id: 'borrowing', label: 'Borrowing & Renewal', icon: BookOpen },
          { id: 'fines', label: 'Fine Rules', icon: SettingsIcon },
          { id: 'notifications', label: 'Alerts & System', icon: Bell },
        ].map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active ? 'border-[#f5a623] text-[#f5a623] bg-[#f5a623]/5' : 'border-transparent text-[#6b7280] hover:text-[#d1d5db]'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="max-w-2xl bg-[#131720] border border-[#1e2330] rounded-xl p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#1e2330] rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-white text-sm font-semibold border-b border-[#1e2330] pb-2">Institution Details</h3>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Library Name</label>
                  <input
                    type="text"
                    value={form.libraryName ?? ''}
                    onChange={e => updateField('libraryName', e.target.value)}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Official Contact Email</label>
                  <input
                    type="email"
                    value={form.libraryEmail ?? ''}
                    onChange={e => updateField('libraryEmail', e.target.value)}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={form.libraryPhone ?? ''}
                      onChange={e => updateField('libraryPhone', e.target.value)}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Low Stock Warning Threshold</label>
                    <input
                      type="number"
                      min={1}
                      value={form.lowStockThreshold ?? 2}
                      onChange={e => updateField('lowStockThreshold', Number(e.target.value))}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Physical Address / Campus Block</label>
                  <textarea
                    rows={2}
                    value={form.libraryAddress ?? ''}
                    onChange={e => updateField('libraryAddress', e.target.value)}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                  />
                </div>
              </div>
            )}

            {/* BORROWING & RENEWAL TAB */}
            {activeTab === 'borrowing' && (
              <div className="space-y-4">
                <h3 className="text-white text-sm font-semibold border-b border-[#1e2330] pb-2">Circulation & Loan Rules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                      Default Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.defaultLoanDuration ?? 14}
                      onChange={e => {
                        const val = Number(e.target.value);
                        updateField('defaultLoanDuration', val);
                        updateField('loanPeriodDays', val);
                      }}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                      Max Books Per Student
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.maxBooksPerStudent ?? 3}
                      onChange={e => updateField('maxBooksPerStudent', Number(e.target.value))}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                    Renewal Limit Per Book
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.renewalLimit ?? 2}
                    onChange={e => updateField('renewalLimit', Number(e.target.value))}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                  />
                  <p className="text-[#6b7280] text-xs mt-1">Number of times a student may extend an active loan without returning.</p>
                </div>

                <div className="pt-2 border-t border-[#1e2330]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.preventOverdueRenewal)}
                      onChange={e => updateField('preventOverdueRenewal', e.target.checked)}
                      className="w-4 h-4 rounded text-[#f5a623] bg-[#0b0f1a] border-[#1e2330] focus:ring-0"
                    />
                    <div>
                      <span className="text-white text-xs font-semibold block">Prevent Renewal If Book Is Already Overdue</span>
                      <span className="text-[#6b7280] text-xs">Students must return overdue books and pay fines before re-borrowing.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* FINES TAB */}
            {activeTab === 'fines' && (
              <div className="space-y-4">
                <h3 className="text-white text-sm font-semibold border-b border-[#1e2330] pb-2">Fine Calculation System</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                      Fine Per Day (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.finePerDay ?? 2}
                      onChange={e => updateField('finePerDay', Number(e.target.value))}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                      Grace Period (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.gracePeriod ?? 0}
                      onChange={e => updateField('gracePeriod', Number(e.target.value))}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                      Maximum Cap (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.maximumFine ?? 100}
                      onChange={e => updateField('maximumFine', Number(e.target.value))}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="bg-[#0b0f1a] border border-[#1e2330] rounded-xl p-4 text-xs space-y-1.5 mt-3">
                  <div className="text-[#6b7280] uppercase tracking-wider font-bold mb-1">Calculation Live Preview:</div>
                  <div className="flex justify-between text-[#9ca3af]">
                    <span>3 days overdue (with {form.gracePeriod}d grace):</span>
                    <span className="text-[#f5a623] font-bold">
                      ₹{Math.min(Math.max(0, 3 - Number(form.gracePeriod)) * Number(form.finePerDay), Number(form.maximumFine) || Infinity)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#9ca3af]">
                    <span>10 days overdue:</span>
                    <span className="text-[#f5a623] font-bold">
                      ₹{Math.min(Math.max(0, 10 - Number(form.gracePeriod)) * Number(form.finePerDay), Number(form.maximumFine) || Infinity)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS & SYSTEM TAB */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <h3 className="text-white text-sm font-semibold border-b border-[#1e2330] pb-2">Notifications & Automation</h3>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">
                    "Due Soon" Alert Trigger (Days in advance)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={form.dueSoonDays ?? 3}
                    onChange={e => updateField('dueSoonDays', Number(e.target.value))}
                    className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.enableOverdueNotifications)}
                      onChange={e => updateField('enableOverdueNotifications', e.target.checked)}
                      className="w-4 h-4 rounded text-[#f5a623] bg-[#0b0f1a] border-[#1e2330]"
                    />
                    <span className="text-xs text-white">Enable Overdue Alerts in Notification Center</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.enableDueSoonNotifications)}
                      onChange={e => updateField('enableDueSoonNotifications', e.target.checked)}
                      className="w-4 h-4 rounded text-[#f5a623] bg-[#0b0f1a] border-[#1e2330]"
                    />
                    <span className="text-xs text-white">Enable Due Soon Alerts in Notification Center</span>
                  </label>
                </div>

                <h3 className="text-white text-sm font-semibold border-b border-[#1e2330] pt-4 pb-2">Regional & Formatting</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Timezone</label>
                    <select
                      value={form.timezone ?? 'Asia/Kolkata'}
                      onChange={e => updateField('timezone', e.target.value)}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6b7280] font-semibold mb-1">Date Format</label>
                    <select
                      value={form.dateFormat ?? 'YYYY-MM-DD'}
                      onChange={e => updateField('dateFormat', e.target.value)}
                      className="w-full bg-[#0b0f1a] border border-[#1e2330] text-sm text-white px-3 py-2 rounded-lg outline-none focus:border-[#f5a623]"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (Standard)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>
                </div>

                {/* Email Service Status */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.emailServiceConfigured)}
                      onChange={e => updateField('emailServiceConfigured', e.target.checked)}
                      className="w-4 h-4 rounded text-[#f5a623] bg-[#0b0f1a] border-[#1e2330]"
                    />
                    <div>
                      <span className="text-xs text-white font-medium block">Enable Automated Email Service Delivery</span>
                      <span className="text-[11px] text-[#6b7280]">
                        When unchecked, the system maintains safe simulated reminders and displays &ldquo;Email service not configured&rdquo;.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
