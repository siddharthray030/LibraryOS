import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Trash2, Filter } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';

const SEVERITY_STYLES = {
  error:   { bg: 'bg-red-950/40 border-red-800/40',   dot: 'bg-[#ef4444]', text: 'text-[#ef4444]' },
  warning: { bg: 'bg-amber-950/30 border-amber-800/30', dot: 'bg-[#f5a623]', text: 'text-[#f5a623]' },
  info:    { bg: 'bg-blue-950/30 border-blue-800/30',  dot: 'bg-[#60a5fa]', text: 'text-[#60a5fa]' },
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotificationBell({ onNavigate }) {
  const { notifications, unreadCount, readIds, markRead, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = filterCat === 'all'
    ? notifications
    : notifications.filter(n => n.category === filterCat);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'due_soon', label: 'Due Soon' },
    { id: 'low_stock', label: 'Stock' },
    { id: 'fine', label: 'Fines' },
  ];

  const handleNotificationClick = (n) => {
    markRead(n.id);
    if (n.category === 'overdue' || n.category === 'fine') {
      onNavigate?.('overdue');
      setOpen(false);
    } else if (n.category === 'low_stock') {
      onNavigate?.('books');
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-[#1e2330] bg-[#131720] text-[#6b7280] hover:text-white hover:bg-[#1a2035] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-[#ef4444] text-white text-[9px] font-bold rounded-full px-1 shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[200] w-88 bg-[#131720] border border-[#1e2330] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1e2330] bg-[#0b0f1a]">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[#f5a623]" />
              <span className="text-white text-sm font-semibold">Notification Center</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#f5a623] text-black rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="p-1 text-[#6b7280] hover:text-[#10b981] transition-colors"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => { clearAll(); setOpen(false); }}
                title="Clear all"
                className="p-1 text-[#6b7280] hover:text-[#ef4444] transition-colors"
              >
                <Trash2 size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1 text-[#6b7280] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#1e2330] bg-[#10141e] overflow-x-auto text-[11px]">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilterCat(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  filterCat === cat.id
                    ? 'bg-[#f5a623]/15 text-[#f5a623] font-bold'
                    : 'text-[#6b7280] hover:text-[#d1d5db]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#1e2330]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                <Bell size={24} className="text-[#374151]" />
                <p className="text-[#6b7280] text-xs">No notifications in this category.</p>
              </div>
            ) : (
              filtered.map(n => {
                const isRead = readIds.has(n.id);
                const sty    = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-[#1a2035] transition-colors ${!isRead ? 'bg-[#0b0f1a]/80' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none mt-0.5">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold truncate ${isRead ? 'text-[#9ca3af]' : 'text-white'}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-[#4b5563] shrink-0 font-mono">
                            {formatTimeAgo(n.ts)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-[#6b7280] text-xs mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                        )}
                      </div>
                      {!isRead && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${sty.dot}`} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
