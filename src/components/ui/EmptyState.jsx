import Button from './Button';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center anim-fade-up">
      {Icon && (
        <div className="anim-scale-in anim-delay-1">
          <Icon className="text-[#374151] w-12 h-12 mx-auto mb-4" strokeWidth={1.5} />
        </div>
      )}
      {title && (
        <p className="text-[#6b7280] font-medium text-base mb-1 anim-fade-up anim-delay-2">{title}</p>
      )}
      {description && (
        <p className="text-[#4b5563] text-sm anim-fade-up anim-delay-3">{description}</p>
      )}
      {action && (
        <div className="mt-5 anim-fade-up anim-delay-4">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}
