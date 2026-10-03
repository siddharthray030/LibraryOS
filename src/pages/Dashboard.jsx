import { useState, useMemo } from 'react';
import { useLibraryData } from '../context/LibraryDataContext';
import { useSettings } from '../context/SettingsContext';
import { calcOverdueDays, calculateFine } from '../services/settings';
import {
  BookOpen, Users, BookMarked, AlertTriangle,
  TrendingUp, DollarSign, ArrowUpRight, CheckCircle2,
  Calendar, Clock, Percent, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  CartesianGrid,
} from 'recharts';
import { useInView, useAnimatedNumber, staggerClass } from '../hooks/useMotion';
import { SkeletonCard } from '../components/ui';

/* ─── Animated Stat Card ────────────────────────────────────────── */
function StatCard({ label, value, numericValue, sub, icon: Icon, iconColor, valueColor, loading, badge, index }) {
  const [ref, visible] = useInView(0.1);

  // Animate number only when card becomes visible and loading is done
  const shouldCount = visible && !loading && typeof numericValue === 'number';
  const animatedNum = useAnimatedNumber(numericValue ?? 0, shouldCount, 900);

  // Determine display value: if it has a prefix/suffix (like ₹ or %), format it
  let displayValue = value;
  if (shouldCount && numericValue !== undefined) {
    if (typeof value === 'string') {
      if (value.startsWith('₹')) displayValue = `₹${animatedNum}`;
      else if (value.endsWith('%')) displayValue = `${animatedNum}%`;
      else if (value.endsWith('d')) displayValue = `${animatedNum}d`;
      else displayValue = animatedNum;
    }
  }

  if (loading) return <SkeletonCard />;

  return (
    <div
      ref={ref}
      className={[
        'bg-[#131720] border border-[#1e2330] rounded-xl p-4 flex-1 min-w-0 flex flex-col justify-between card-hover',
        visible ? staggerClass(index, 'anim-fade-up') : 'opacity-0',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[#4b5563] text-[10px] font-semibold tracking-widest uppercase">{label}</span>
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <div className="text-2xl font-bold mb-1 tabular-nums" style={{ color: valueColor }}>
        {displayValue}
      </div>
      <div className="flex items-center justify-between text-xs text-[#6b7280]">
        <span className="truncate">{sub}</span>
        {badge && (
          <span className="text-[10px] font-semibold text-[#10b981] bg-emerald-950/40 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Chart Card wrapper ────────────────────────────────────────── */
function ChartCard({ children, className = '' }) {
  const [ref, visible] = useInView(0.08);
  return (
    <div
      ref={ref}
      className={[
        'bg-[#131720] border border-[#1e2330] rounded-xl p-5 card-hover',
        visible ? 'anim-fade-up' : 'opacity-0',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

const CAT_COLORS = [
  '#f5a623', '#06b6d4', '#a855f7', '#ef4444',
  '#10b981', '#8b5cf6', '#f97316', '#60a5fa',
  '#fb7185', '#34d399', '#9ca3af',
];

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7 Days' },
  { id: '30d',   label: '30 Days' },
  { id: '3m',    label: '3 Months' },
  { id: '6m',    label: '6 Months' },
  { id: '1y',    label: '1 Year' },
  { id: 'all',   label: 'All Time' },
];

export default function Dashboard({ onNavigate }) {
  const { settings } = useSettings();
  // Use shared data from LibraryDataContext — no additional Firestore subscriptions needed
  const { books, students, issuedBooks: loans, loading } = useLibraryData();
  const [range, setRange] = useState('6m');


  // Filter loans based on selected date range
  const filteredLoans = useMemo(() => {
    if (range === 'all') return loans;
    const now = new Date();
    let cutoff = new Date();
    if (range === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (range === '7d')  cutoff.setDate(now.getDate() - 7);
    else if (range === '30d') cutoff.setDate(now.getDate() - 30);
    else if (range === '3m')  cutoff.setMonth(now.getMonth() - 3);
    else if (range === '6m')  cutoff.setMonth(now.getMonth() - 6);
    else if (range === '1y')  cutoff.setFullYear(now.getFullYear() - 1);

    return loans.filter(l => {
      if (!l.issueDate) return true;
      return new Date(l.issueDate) >= cutoff;
    });
  }, [loans, range]);

  // ── METRICS ──────────────────────────────────────────────────────
  const totalBooks        = books.length;
  const totalCopies       = books.reduce((s, b) => s + (b.totalQuantity ?? b.copies ?? 0), 0);
  const availCopies       = books.reduce((s, b) => s + (b.availableQuantity ?? b.available ?? 0), 0);
  const issuedCopies      = totalCopies - availCopies;
  const activeIssues      = loans.filter(l => l.status === 'issued' || l.status === 'Issued');
  const overdueIssues     = activeIssues.filter(l => calcOverdueDays(l.dueDate) > 0);
  const totalStudents     = students.length;
  const activeBorrowersSet   = new Set(activeIssues.map(l => l.studentId).filter(Boolean));
  const activeBorrowersCount = activeBorrowersSet.size;
  const collectedFines    = loans.filter(l => l.status === 'returned' || l.status === 'Returned').reduce((s, l) => s + (Number(l.fine) || 0), 0);
  const outstandingFines  = overdueIssues.reduce((s, l) => s + calculateFine(l.dueDate, settings), 0);
  const totalFines        = collectedFines + outstandingFines;
  const lowStockThreshold = settings?.lowStockThreshold ?? 2;
  const lowStockBooks     = books.filter(b => {
    const avail = b.availableQuantity ?? b.available ?? 0;
    return avail <= lowStockThreshold && avail > 0;
  });
  const returnedCount     = filteredLoans.filter(l => l.status === 'returned' || l.status === 'Returned').length;
  const returnRate        = filteredLoans.length > 0 ? Math.round((returnedCount / filteredLoans.length) * 100) : 100;
  const durations = filteredLoans
    .filter(l => (l.status === 'returned' || l.status === 'Returned') && l.returnDate && l.issueDate)
    .map(l => Math.max(1, Math.round((new Date(l.returnDate) - new Date(l.issueDate)) / 86400000)));
  const avgLoanDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 14;

  // ── CHART DATA ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const map = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = { month: months[d.getMonth()], issued: 0, returned: 0, overdue: 0 };
    }
    filteredLoans.forEach(l => {
      if (l.issueDate)  { const k = l.issueDate.slice(0,7);  if (map[k]) map[k].issued++;   }
      if (l.returnDate) { const k = l.returnDate.slice(0,7); if (map[k]) map[k].returned++; }
      if (l.dueDate && calcOverdueDays(l.dueDate) > 0) { const k = l.dueDate.slice(0,7); if (map[k]) map[k].overdue++; }
    });
    return Object.values(map);
  }, [filteredLoans]);

  const categoryData = useMemo(() => {
    const counts = {};
    books.forEach(b => {
      const c = b.category || b.genre || 'Other';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value }));
  }, [books]);

  const bookComparisonData = useMemo(() => {
    return books
      .filter(b => (b.totalQuantity ?? 0) > 0)
      .sort((a, b) => (b.totalQuantity ?? 0) - (a.totalQuantity ?? 0))
      .slice(0, 6)
      .map(b => ({
        name: b.title.length > 15 ? b.title.slice(0, 15) + '…' : b.title,
        available: b.availableQuantity ?? 0,
        issued: Math.max(0, (b.totalQuantity ?? 0) - (b.availableQuantity ?? 0)),
      }));
  }, [books]);

  const fineTrendData = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const map = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = { month: months[d.getMonth()], fine: 0 };
    }
    filteredLoans.forEach(l => {
      const amt = Number(l.fine) || 0;
      if (amt > 0 && l.returnDate) {
        const k = l.returnDate.slice(0, 7);
        if (map[k]) map[k].fine += amt;
      }
    });
    return Object.values(map);
  }, [filteredLoans]);

  const TOOLTIP_STYLE = {
    contentStyle: { background: '#131720', border: '1px solid #1e2330', borderRadius: 8, color: '#fff', fontSize: 12 },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
  };

  // Stat card definitions
  const statCards = [
    { label: 'Total Books',      value: totalBooks,          numericValue: totalBooks,      sub: `${totalCopies} physical copies`, icon: BookOpen,       iconColor: '#a855f7', valueColor: '#ffffff' },
    { label: 'Available',        value: availCopies,         numericValue: availCopies,     sub: 'on shelf',                      icon: TrendingUp,     iconColor: '#10b981', valueColor: '#10b981' },
    { label: 'Currently Issued', value: activeIssues.length, numericValue: activeIssues.length, sub: `${issuedCopies} copies out`, icon: BookMarked,   iconColor: '#60a5fa', valueColor: '#f5a623' },
    { label: 'Overdue',          value: overdueIssues.length,numericValue: overdueIssues.length, sub: 'action needed',            icon: AlertTriangle, iconColor: '#ef4444', valueColor: '#ef4444' },
    { label: 'Low Stock Books',  value: lowStockBooks.length,numericValue: lowStockBooks.length, sub: `≤ ${lowStockThreshold} left`, icon: AlertTriangle, iconColor: '#f5a623', valueColor: lowStockBooks.length > 0 ? '#f5a623' : '#10b981' },
    { label: 'Students',         value: totalStudents,       numericValue: totalStudents,   sub: `${activeBorrowersCount} active borrowers`, icon: Users, iconColor: '#8b5cf6', valueColor: '#8b5cf6' },
    { label: 'Return Rate',      value: `${returnRate}%`,    numericValue: returnRate,      sub: 'on-time returns',               icon: Percent,        iconColor: '#10b981', valueColor: '#10b981', badge: 'Healthy' },
    { label: 'Total Fines',      value: `₹${totalFines}`,   numericValue: totalFines,      sub: `₹${collectedFines} collected`, icon: DollarSign,     iconColor: '#f97316', valueColor: '#f97316' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#0f1117] min-h-screen page-enter">
      {/* Header with Date Range Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="anim-fade-up">
          <h1 className="text-white text-2xl font-bold">Analytics &amp; Dashboard</h1>
          <p className="text-[#6b7280] text-sm mt-0.5">Comprehensive real-time library circulation intelligence</p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1 bg-[#131720] border border-[#1e2330] p-1 rounded-xl overflow-x-auto text-xs anim-fade-up anim-delay-2">
          <Calendar size={13} className="text-[#6b7280] ml-2 mr-1" />
          {DATE_RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap btn-interactive ${
                range === r.id ? 'bg-[#f5a623] text-black font-bold' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 8 KEY METRIC CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <StatCard key={card.label} {...card} loading={loading} index={i} />
        ))}
      </div>

      {/* Overdue alert banner */}
      {!loading && overdueIssues.length > 0 && (
        <div
          onClick={() => onNavigate?.('overdue')}
          className="flex items-center gap-3 bg-red-950/30 border border-red-800/40 rounded-xl px-5 py-3 cursor-pointer hover:bg-red-950/40 transition-colors card-hover anim-fade-up"
        >
          <AlertTriangle size={18} className="text-[#ef4444] shrink-0" />
          <div className="flex-1">
            <span className="text-[#ef4444] font-semibold text-sm">{overdueIssues.length} book{overdueIssues.length > 1 ? 's' : ''} currently overdue</span>
            <span className="text-[#9ca3af] text-sm"> · Pending fine collection: </span>
            <span className="text-[#f5a623] font-semibold text-sm">₹{outstandingFines}</span>
          </div>
          <ArrowUpRight size={15} className="text-[#4b5563]" />
        </div>
      )}

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Circulation chart */}
        <ChartCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-sm font-semibold">Circulation Activity (Issued vs Returned)</h2>
              <p className="text-[#6b7280] text-xs">Comparison over recent months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#f5a623]" /> Issued</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#10b981]" /> Returned</span>
            </div>
          </div>
          {loading ? (
            <div className="h-52 skeleton-shimmer rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={monthlyData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="issued"   name="Issued"   fill="#f5a623" radius={[4,4,0,0]} isAnimationActive={true} animationDuration={600} />
                <Bar dataKey="returned" name="Returned" fill="#10b981" radius={[4,4,0,0]} isAnimationActive={true} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category pie */}
        <ChartCard>
          <h2 className="text-white text-sm font-semibold mb-1">Books by Category</h2>
          <p className="text-[#6b7280] text-xs mb-3">Catalogue distribution</p>
          {loading ? (
            <div className="h-52 skeleton-shimmer rounded-xl" />
          ) : categoryData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-[#6b7280]">No categories recorded</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%" cy="45%"
                  innerRadius={48} outerRadius={70}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={true}
                  animationDuration={700}
                >
                  {categoryData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend content={({ payload }) => (
                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-2 text-[10px]">
                    {payload.map((entry, i) => (
                      <span key={i} className="flex items-center gap-1 text-[#9ca3af]">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                        {entry.value}
                      </span>
                    ))}
                  </div>
                )} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Available vs Issued */}
        <ChartCard>
          <h2 className="text-white text-sm font-semibold mb-1">Available vs Issued (Top Titles)</h2>
          <p className="text-[#6b7280] text-xs mb-4">Stock proportion per book</p>
          {loading ? (
            <div className="h-44 skeleton-shimmer rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={bookComparisonData} barSize={12} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="available" name="Available" fill="#10b981" radius={[0,3,3,0]} stackId="a" isAnimationActive={true} animationDuration={600} />
                <Bar dataKey="issued"    name="Issued"    fill="#f5a623" radius={[0,3,3,0]} stackId="a" isAnimationActive={true} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Fine Trend */}
        <ChartCard>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white text-sm font-semibold">Fine Collection Trend</h2>
            <span className="text-[#f97316] text-xs font-bold font-mono">₹{collectedFines} Total</span>
          </div>
          <p className="text-[#6b7280] text-xs mb-4">Monthly fee collection amount</p>
          {loading ? (
            <div className="h-44 skeleton-shimmer rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={fineTrendData}>
                <defs>
                  <linearGradient id="fineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="fine"
                  name="Fines Collected (₹)"
                  stroke="#f97316"
                  fillOpacity={1}
                  fill="url(#fineGrad)"
                  strokeWidth={2}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
