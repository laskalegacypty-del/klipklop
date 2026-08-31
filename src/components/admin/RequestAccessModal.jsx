import { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Textarea } from '../ui'
import { DURATION_PRESETS, requestProfileAccess } from '../../lib/profileAccess'

export default function RequestAccessModal({ open, onClose, adminId, targetUser, onRequested }) {
  const [durationKey, setDurationKey] = useState('24h')
  const [customHours, setCustomHours] = useState(72)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!targetUser) return null

  async function handleClose() {
    setDurationKey('24h')
    setCustomHours(72)
    setReason('')
    onClose()
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await requestProfileAccess({
        adminId,
        targetUserId: targetUser.id,
        durationKey,
        customHours: Number(customHours),
        reason: reason.trim(),
      })
      toast.success(`Access request sent to ${targetUser.rider_name}`)
      onRequested?.()
      handleClose()
    } catch (err) {
      toast.error(err.message || 'Could not send access request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Request profile access" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Ask <span className="font-medium text-gray-700">{targetUser.rider_name}</span> for
          time-limited access to their profile. They must accept before you can view it, and can
          revoke access at any time.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
          <div className="flex gap-2">
            {DURATION_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setDurationKey(p.key)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                  durationKey === p.key
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDurationKey('custom')}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                durationKey === 'custom'
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Custom
            </button>
          </div>
          {durationKey === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={customHours}
                onChange={e => setCustomHours(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">hours (max 720 / 30 days)</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-gray-400 font-normal">(shown to the rider)</span>
          </label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Helping troubleshoot your qualifier times"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-2">
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Sending…' : 'Send request'}
        </Button>
      </div>
    </Modal>
  )
}
