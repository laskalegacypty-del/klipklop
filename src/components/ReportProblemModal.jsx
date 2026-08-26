import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Select, Textarea, Input } from './ui'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { value: 'incorrect_info', label: 'Incorrect information' },
  { value: 'bug',             label: 'Bug' },
  { value: 'ui_problem',      label: 'UI problem' },
  { value: 'other',           label: 'Other' },
]

// Shared "report a problem" dialog. Pass `context` (a plain object) to
// attach structured details a caller already knows — e.g. the question and
// answer a Klippies message is being reported for — so the report is
// actionable without the user having to re-type what they saw.
export default function ReportProblemModal({
  open,
  onClose,
  defaultCategory = 'bug',
  context = null,
  visitorId = null,
  defaultEmail = '',
}) {
  const { user } = useAuth()
  const [category, setCategory] = useState(defaultCategory)
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategory(defaultCategory)
    setDescription('')
    setEmail(defaultEmail)
  }, [open, defaultCategory, defaultEmail])

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error('Please describe the problem')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description: description.trim(),
          pagePath: window.location.pathname,
          userId: user?.id || null,
          reporterEmail: user?.email || email.trim() || null,
          visitorId,
          context,
          userAgent: navigator.userAgent,
        }),
      })
      if (!res.ok) throw new Error('request failed')
      toast.success("Thanks — we'll take a look.")
      onClose()
    } catch {
      toast.error('Could not submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report a problem" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What kind of problem?</label>
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What happened?</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you saw, and what you expected instead..."
            maxLength={2000}
            autoFocus
          />
        </div>
        {!user && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your email (optional, so we can follow up)</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send report'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
