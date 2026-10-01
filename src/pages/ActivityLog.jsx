import { useState, useEffect, useCallback } from 'react';
import { fetchActivityLogs, ACTIONS, ENTITY_TYPES } from '../services/activityLog';
import { FileText, RefreshCw, ChevronRight } from 'lucide-react';

const ACTION_LABELS = {
  [ACTIONS.BOOK_ADDED]:       'Book Added',
  [ACTIONS.BOOK_EDITED]:      'Book Edited',
  [ACTIONS.BOOK_DELETED]:     'Book Deleted',
  [ACTIONS.STUDENT_ADDED]:    'Student Added',
  [ACTIONS.STUDENT_EDITED]:   'Student Edited',
  [ACTIONS.STUDENT_DELETED]:  'Student Deleted',
  [ACTIONS.BOOK_ISSUED]:      'Book Issued',
  [ACTIONS.BOOK_RETURNED]:    'Book Returned',
  [ACTIONS.FINE_RECORDED]:    'Fine Recorded',
  [ACTIONS.SETTINGS_CHANGED]: 'Settings Changed',
  [ACTIONS.LOGIN]:            'Login',
  [ACTIONS.LOGOUT]:           'Logout',
};

const ACTION_ICON = {
  [ACTIONS.BOOK_ADDED]:       { emoji: '➕', bg: 'bg-emerald-950/40' },
  [ACTIONS.BOOK_EDITED]:      { emoji: '✏️', bg: 'bg-blue-950/40'   },
  [ACTIONS.BOOK_DELETED]:     { emoji: '🗑️', bg: 'bg-red-950/40'    },
  [ACTIONS.STUDENT_ADDED]:    { emoji: '👤', bg: 'bg-emerald-950/40' },
  [ACTIONS.STUDENT_EDITED]:   { emoji: '✏️', bg: 'bg-blue-950/40'   },
  [ACTIONS.STUDENT_DELETED]:  { emoji: '🗑️', bg: 'bg-red-950/40'    },
  [ACTIONS.BOOK_ISSUED]:      { emoji: '📤', bg: 'bg-amber-950/40'  },
  [ACTIONS.BOOK_RETURNED]:    { emoji: '📥', bg: 'bg-emerald-950/40' },
  [ACTIONS.FINE_RECORDED]:    { emoji: '💰', bg: 'bg-orange-950/40'  },
  [ACTIONS.SETTINGS_CHANGED]: { emoji: '⚙️', bg: 'bg-purple-950/40' },
  [ACTIONS.LOGIN]:            { emoji: '🔐', bg: 'bg-[#1e2330]'     },
  [ACTIONS.LOGOUT]:           { emoji: '🚪', bg: 'bg-[#1e2330]'     },
};

const ALL_ACTIONS  = ['All', ...Object.values(ACTIONS)];
const ALL_ENTITIES = ['All', ...Object.values(ENTITY_TYPES)];
const PAGE_SIZE    = 20;

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function LogRow({ log }) {
  const ic = ACTION_ICON[log.action] || { emoji: '•', bg: 'bg-[#1e2330]' };
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-[#1e2330] last:border-0 hover:bg-[#1a2035] transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${ic.bg}`}>
        <span className="text-sm leading-none">{ic.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-sm font-medium">
            {log.description || ACTION_LABELS[log.action] || log.action}
          </span>
          {log.entityType && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#1e2330] text-[#6b7280] rounded uppercase tracking-wide">
              {log.entityType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[#4b5563] text-xs">{formatTs(log.timestamp)}</span>
          {log.actorEmail && (
            <span className="text-[#4b5563] text-xs">by {log.actorEmail}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-[#1e2330] animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-[#1e2330] flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 bg-[#1e2330] rounded w-3/4" />
        <div className="h-3 bg-[#1e2330] rounded w-1/2" />
      </div>
    </div>
  );
}

export default function ActivityLog() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [lastDoc, setLastDoc]   = useState(null);
  const [hasMore, setHasMore]   = useState(true);
  const [error, setError]       = useState(null);

  const [actionFilter, setActionFilter]   = useState('All');
  const [entityFilter, setEntityFilter]   = useState('All');

  const loadFirst = useCallback(async (action, entity) => {
    setLoading(true);
    setError(null);
    setLogs([]);
    setLastDoc(null);
    try {
      const res = await fetchActivityLogs(PAGE_SIZE, null, { action, entityType: entity });
      setLogs(res.logs);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch {
      setError('Failed to load activity logs. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!lastDoc || loading) return;
    setLoading(true);
    try {
      const res = await fetchActivityLogs(PAGE_SIZE, lastDoc, { action: actionFilter, entityType: entityFilter });
      setLogs(prev => [...prev, ...res.logs]);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch {
      setError('Failed to load more logs.');
    } finally {
      setLoading(false);
    }
  }, [lastDoc, loading, actionFilter, entityFilter]);

  // Load on mount and filter change
  useEffect(() => {
    loadFirst(actionFilter, entityFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityFilter]);

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Activity Log</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">Audit trail of all administrative actions</p>
        </div>
        <button
          onClick={() => loadFirst(actionFilter, entityFilter)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-[#374151] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-sm px-3 py-2 rounded-lg outline-none"
        >
          {ALL_ACTIONS.map(a => (
            <option key={a} value={a}>
              {a === 'All' ? 'All Actions' : (ACTION_LABELS[a] || a)}
            </option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          className="bg-[#131720] border border-[#1e2330] text-[#d1d5db] text-sm px-3 py-2 rounded-lg outline-none"
        >
          {ALL_ENTITIES.map(e => (
            <option key={e} value={e}>
              {e === 'All' ? 'All Entity Types' : e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Log list */}
      <div className="bg-[#131720] border border-[#1e2330] rounded-xl overflow-hidden">
        {loading && logs.length === 0 && [0,1,2,3,4,5].map(i => <SkeletonRow key={i} />)}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-[#ef4444] text-sm">{error}</p>
            <button
              onClick={() => loadFirst(actionFilter, entityFilter)}
              className="px-4 py-2 bg-[#f5a623] text-black text-sm font-semibold rounded-lg hover:bg-[#e09515] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={32} className="text-[#374151]" />
            <p className="text-[#6b7280] text-sm font-medium">No activity logs found</p>
            <p className="text-[#4b5563] text-xs">
              {actionFilter !== 'All' || entityFilter !== 'All'
                ? 'Try adjusting your filters.'
                : 'Logs appear after admin actions are performed.'}
            </p>
          </div>
        )}

        {logs.map(log => <LogRow key={log.id} log={log} />)}

        {loading && logs.length > 0 && [0,1,2].map(i => <SkeletonRow key={`l${i}`} />)}
      </div>

      {/* Load more */}
      {!loading && hasMore && logs.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            className="flex items-center gap-2 px-5 py-2.5 border border-[#374151] text-[#9ca3af] text-sm rounded-lg hover:bg-[#1e2330] transition-colors"
          >
            Load more <ChevronRight size={14} />
          </button>
        </div>
      )}
      {!loading && (
        <p className="text-[#4b5563] text-xs mt-3 text-center">
          Showing {logs.length} log{logs.length !== 1 ? 's' : ''}{hasMore ? ' — more available' : ''}
        </p>
      )}
    </div>
  );
}
