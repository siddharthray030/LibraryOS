import Button from './Button';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <Icon className="text-[#374151] w-12 h-12 mx-auto mb-4" strokeWidth={1.5} />
      )}
      {title && (
        <p className="text-[#6b7280] font-medium text-base mb-1">{title}</p>
      )}
      {description && (
        <p className="text-[#4b5563] text-sm">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}
