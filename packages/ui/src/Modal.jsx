import { useEffect } from 'react'
import { cn } from './cn'
import { Button } from './Button'

export function Modal({ open, onClose, title, children, footer, className }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="kk-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={cn('kk-modal', className)}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="kk-modal__header">
            <h2 className="kk-modal__title">{title}</h2>
          </div>
        ) : null}
        <div className="kk-modal__body">{children}</div>
        <div className="kk-modal__footer">
          {footer ?? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
