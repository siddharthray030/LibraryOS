import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary:   'bg-[#f5a623] text-black hover:bg-[#e09515] shadow-sm hover:shadow-[0_4px_12px_rgba(245,166,35,0.25)]',
  secondary: 'border border-[#374151] text-[#d1d5db] hover:bg-[#1e2330] bg-transparent',
  danger:    'bg-[#991b1b] text-white hover:bg-[#7f1d1d]',
  ghost:     'text-[#9ca3af] hover:text-white hover:bg-[#1a2035]',
};

const sizeClasses = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onClick,
  type = 'button',
  className = '',
  children,
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg',
        'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f5a623]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Interactive lift animation (disabled via CSS for reduced-motion)
        !isDisabled ? 'btn-interactive' : '',
        variantClasses[variant] ?? variantClasses.primary,
        sizeClasses[size]    ?? sizeClasses.md,
        className,
      ].join(' ')}
    >
      {loading && <Loader2 className="anim-spin" size={14} />}
      {children}
    </button>
  );
}
