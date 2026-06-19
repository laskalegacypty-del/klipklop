import { useState } from 'react'
import { Link2, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabaseClient'
import {
  createShareLink,
  copyAndShare,
  formatShareLinkExpiry,
  isShareLinkActive,
} from '../../lib/shareLink'
import { Button } from '../ui'

const MORE_EXPIRY_OPTIONS = [
  { label: '24 hours', days: 1 },
  { label: '30 days', days: 30 },
]

export function ShareLinkModal({ open, onClose, combo, onCreated }) {
  const [creating, setCreating] = useState(false)
  const [showMore, setShowMore] = useState(false)

  if (!open || !combo) return null

  async function handleCreate(linkType, expiresInDays = 7) {
    setCreating(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        toast.error('Please sign in again to share')
        return
      }

      const result = await createShareLink({
        comboId: combo.id,
        linkType,
        expiresInDays,
        accessToken: token,
      })

      await copyAndShare({
        url: result.url,
        shareMessage: result.share_message,
        shareTitle: result.share_title,
      })

      toast.success('Link copied — paste in WhatsApp or email')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not create share link')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Share times</h2>
            <p className="text-sm text-gray-500">{combo.horse_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <button
            type="button"
            disabled={creating}
            onClick={() => handleCreate('expires', 7)}
            className="w-full text-left rounded-xl border-2 border-green-600 bg-green-50 p-4 hover:bg-green-100 transition disabled:opacity-60"
          >
            <p className="font-semibold text-green-900">Share for 7 days</p>
            <p className="text-sm text-green-700 mt-1">Anyone with the link can view until it expires</p>
          </button>

          <button
            type="button"
            disabled={creating}
            onClick={() => handleCreate('one_time')}
            className="w-full text-left rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition disabled:opacity-60"
          >
            <p className="font-semibold text-gray-900">Share once</p>
            <p className="text-sm text-gray-500 mt-1">Link stops working after one view</p>
          </button>

          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            More options
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showMore && (
            <div className="flex gap-2">
              {MORE_EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  disabled={creating}
                  onClick={() => handleCreate('expires', opt.days)}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ManageShareLinks({ comboId }) {
  const [expanded, setExpanded] = useState(false)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadLinks() {
    if (!comboId) return
    setLoading(true)
    const { data } = await supabase
      .from('times_share_links')
      .select('*')
      .eq('combo_id', comboId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    setLinks(data || [])
    setLoading(false)
  }

  async function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next) await loadLinks()
  }

  const activeCount = links.filter(isShareLinkActive).length

  async function revokeLink(linkId) {
    const { error } = await supabase
      .from('times_share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId)

    if (error) {
      toast.error('Could not revoke link')
      return
    }
    toast.success('Link revoked')
    loadLinks()
  }

  if (!comboId) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Manage shared links{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-gray-400">No active share links</p>
          ) : (
            links.map(link => (
              <div key={link.id} className="flex items-center justify-between gap-2 text-sm bg-white rounded-lg border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {link.link_type === 'one_time' ? 'One-time' : 'Expires'} · {formatShareLinkExpiry(link)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isShareLinkActive(link) ? `${link.view_count} view${link.view_count === 1 ? '' : 's'}` : 'Inactive'}
                  </p>
                </div>
                {isShareLinkActive(link) && (
                  <button
                    type="button"
                    onClick={() => revokeLink(link.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                    title="Revoke link"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function ShareTimesButton({ onClick, disabled }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      <Link2 size={16} />
      Share
    </Button>
  )
}
