import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title="" maxWidth={420}>
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-amber-900/30">
          <AlertTriangle className="text-amber-400" size={28} />
        </div>
        <h3 className="text-white font-semibold text-base">{title}</h3>
        {message && <p className="text-[#9ca3af] text-sm">{message}</p>}
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
