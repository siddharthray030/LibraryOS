export default function Input({ label, error, className = '', id, ...rest }) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-[#6b7280] text-xs uppercase tracking-wider mb-1.5 block"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={[
          'w-full bg-[#0b0f1a] border text-[#e5e7eb] placeholder-[#4b5563]',
          'text-sm px-3 py-2.5 rounded-lg outline-none transition-colors',
          'focus:border-[#f5a623] focus:ring-1 focus:ring-[#f5a623]/20',
          error ? 'border-[#ef4444]' : 'border-[#1e2330]',
          className,
        ].join(' ')}
        {...rest}
      />
      {error && <p className="text-[#ef4444] text-xs mt-1">{error}</p>}
    </div>
  );
}
