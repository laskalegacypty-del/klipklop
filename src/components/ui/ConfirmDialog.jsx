import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      <div className="flex justify-end gap-3 mt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={variant} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
