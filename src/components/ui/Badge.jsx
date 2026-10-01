const colorMap = {
  green:  'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50',
  red:    'bg-red-900/50 text-red-400 border border-red-700/50',
  amber:  'bg-amber-900/50 text-amber-400 border border-amber-700/50',
  blue:   'bg-blue-900/50 text-blue-400 border border-blue-700/50',
  purple: 'bg-purple-900/50 text-purple-400 border border-purple-700/50',
  cyan:   'bg-cyan-900/50 text-cyan-400 border border-cyan-700/50',
  orange: 'bg-orange-900/50 text-orange-400 border border-orange-700/50',
  gray:   'bg-gray-800 text-gray-400 border border-gray-700',
};

export default function Badge({ color = 'gray', children }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[color] ?? colorMap.gray,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
