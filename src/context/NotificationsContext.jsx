import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeIssuedBooks, subscribeBooks } from '../services/firestore';
import { calcOverdueDays, calculateFine } from '../services/settings';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children, settings }) {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds]             = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('lib_read_notifs') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    let issuedData = [];
    let booksData  = [];

    function rebuild() {
      const today      = new Date(new Date().toDateString());
      const threshold  = settings?.lowStockThreshold ?? 2;
      const dueDays    = settings?.dueSoonDays ?? 3;
      const notifs     = [];

      // 1. Overdue Notifications
      if (settings?.enableOverdueNotifications !== false) {
        const overdueIssues = issuedData.filter(l => {
          if (l.status === 'returned' || l.status === 'Returned') return false;
          return l.dueDate && calcOverdueDays(l.dueDate) > 0;
        });

        if (overdueIssues.length > 0) {
          notifs.push({
            id:       'overdue-summary',
            category: 'overdue',
            icon:     '⚠️',
            title:    `${overdueIssues.length} book${overdueIssues.length > 1 ? 's' : ''} currently overdue`,
            body:     overdueIssues.slice(0, 3).map(l => `"${l.bookTitle || l.book}" (${l.studentName || l.member})`).join(', ') + (overdueIssues.length > 3 ? ` +${overdueIssues.length - 3} more` : ''),
            severity: 'error',
            ts:       Date.now() - 1000 * 60 * 15, // 15 mins ago
          });

          // Fine accumulation alert
          const totalOverdueFine = overdueIssues.reduce((sum, l) => sum + calculateFine(l.dueDate, settings), 0);
          if (totalOverdueFine > 0) {
            notifs.push({
              id:       'fines-summary',
              category: 'fine',
              icon:     '💰',
              title:    `₹${totalOverdueFine} in pending overdue fines`,
              body:     `Accumulated across ${overdueIssues.length} overdue book${overdueIssues.length > 1 ? 's' : ''}.`,
              severity: 'warning',
              ts:       Date.now() - 1000 * 60 * 30, // 30 mins ago
            });
          }
        }
      }

      // 2. Due Soon Notifications
      if (settings?.enableDueSoonNotifications !== false) {
        const dueSoon = issuedData.filter(l => {
          if (l.status === 'returned' || l.status === 'Returned') return false;
          if (!l.dueDate) return false;
          const due  = new Date(l.dueDate);
          const diff = Math.floor((due - today) / 86400000);
          return diff >= 0 && diff <= dueDays;
        });

        if (dueSoon.length > 0) {
          notifs.push({
            id:       'due-soon-summary',
            category: 'due_soon',
            icon:     '📅',
            title:    `${dueSoon.length} book${dueSoon.length > 1 ? 's' : ''} due in ${dueDays} days`,
            body:     dueSoon.slice(0, 3).map(l => `"${l.bookTitle || l.book}" (due ${l.dueDate})`).join(', '),
            severity: 'warning',
            ts:       Date.now() - 1000 * 60 * 60, // 1 hr ago
          });
        }
      }

      // 3. Low Stock Notifications
      const lowStock = booksData.filter(b => {
        const avail = b.availableQuantity ?? b.available ?? 0;
        return avail <= threshold && avail > 0;
      });

      if (lowStock.length > 0) {
        notifs.push({
          id:       'low-stock-summary',
          category: 'low_stock',
          icon:     '📚',
          title:    `${lowStock.length} title${lowStock.length > 1 ? 's' : ''} running low on stock`,
          body:     lowStock.slice(0, 3).map(b => `"${b.title}" (${b.availableQuantity ?? b.available} left)`).join(', '),
          severity: 'warning',
          ts:       Date.now() - 1000 * 60 * 120, // 2 hrs ago
        });
      }

      // 4. System Status
      notifs.push({
        id:       'system-status',
        category: 'system',
        icon:     '🛡️',
        title:    'LibraryOS Online',
        body:     'Database synchronization and role policies are operating normally.',
        severity: 'info',
        ts:       Date.now() - 1000 * 60 * 60 * 6,
      });

      setNotifications(notifs);
    }

    const u1 = subscribeIssuedBooks(data => { issuedData = data; rebuild(); });
    const u2 = subscribeBooks(data      => { booksData  = data; rebuild(); });

    return () => { u1(); u2(); };
  }, [settings]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markRead = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('lib_read_notifs', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    const ids = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem('lib_read_notifs', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [notifications]);

  const clearAll = useCallback(() => {
    const ids = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem('lib_read_notifs', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [notifications]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      readIds,
      markRead,
      markAllRead,
      clearAll,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
