import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Trophy,
  Calendar,
  Megaphone,
  UserCheck,
  UserPlus,
  Star,
  X,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  Skeleton,
  Tabs,
  EmptyState,
  ConfirmDialog
} from '../../components/ui'

const NOTIFICATION_TYPES = {
  account_approved: { icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
  account_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100' },
  account_suspended: { icon: X, color: 'text-orange-600', bg: 'bg-orange-100' },
  account_suspend: { icon: X, color: 'text-orange-600', bg: 'bg-orange-100' },
  account_unsuspended: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  new_announcement: { icon: Megaphone, color: 'text-purple-600', bg: 'bg-purple-100' },
  new_pb: { icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  nationals_level_change: { icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-100' },
  upcoming_qualifier: { icon: Calendar, color: 'text-green-600', bg: 'bg-green-100' },
  new_registration: { icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
  supporter_request: { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-100' },
  supporter_request_accepted: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  supporter_request_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100' },
  club_link_request: { icon: UserPlus, color: 'text-green-600', bg: 'bg-green-100' },
  club_link_accepted: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  club_link_rejected: { icon: X, color: 'text-red-600', bg: 'bg-red-100' },
  horse_reminder_due: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100' },
  friend_overtake: { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100' },
}

const PREFERENCE_LABELS = {
  account_approved: 'Account status updates',
  new_announcement: 'New announcements',
  new_pb: 'New personal bests',
  nationals_level_change: 'Nationals level changes',
  upcoming_qualifier: 'Upcoming qualifier reminders',
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getDateGroup(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - date) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  return 'Older'
}

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Older']

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [showPreferences, setShowPreferences] = useState(false)
  const [clearReadOpen, setClearReadOpen] = useState(false)
  const [preferences, setPreferences] = useState({
    account_approved: true,
    new_announcement: true,
    new_pb: true,
    nationals_level_change: true,
    upcoming_qualifier: true,
  })

  useEffect(() => {
    if (profile) {
      fetchNotifications()
      loadPreferences()
    }
  }, [profile])

  async function fetchNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotifications(data || [])
    } catch {
      toast.error('Error loading notifications')
    } finally {
      setLoading(false)
    }
  }

  function loadPreferences() {
    const saved = localStorage.getItem(`notif_prefs_${profile.id}`)
    if (saved) setPreferences(JSON.parse(saved))
  }

  function savePreferences(newPrefs) {
    setPreferences(newPrefs)
    localStorage.setItem(`notif_prefs_${profile.id}`, JSON.stringify(newPrefs))
    toast.success('Preferences saved')
  }

  async function markAsRead(notificationId) {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  async function markAllAsRead() {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('All marked as read')
    } catch {
      toast.error('Error marking all as read')
    }
  }

  async function deleteNotification(notificationId) {
    try {
      await supabase.from('notifications').delete().eq('id', notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch {
      toast.error('Error deleting notification')
    }
  }

  async function clearReadNotifications() {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id)
    if (!readIds.length) return
    try {
      await supabase.from('notifications').delete().in('id', readIds)
      setNotifications(prev => prev.filter(n => !n.is_read))
      toast.success('Read notifications cleared')
    } catch {
      toast.error('Error clearing notifications')
    }
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) await markAsRead(notification.id)
    if (notification.link) navigate(notification.link)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const readCount = notifications.filter(n => n.is_read).length

  const filtered = activeTab === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const grouped = {}
  for (const n of filtered) {
    const g = getDateGroup(n.created_at)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(n)
  }
  const orderedGroups = DATE_GROUP_ORDER.filter(g => grouped[g])

  const tabs = [
    { id: 'all', label: `All${notifications.length ? ` (${notifications.length})` : ''}` },
    { id: 'unread', label: `Unread${unreadCount ? ` (${unreadCount})` : ''}` },
  ]

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-16" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  )

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={clearReadOpen}
        onClose={() => setClearReadOpen(false)}
        onConfirm={clearReadNotifications}
        title="Clear read notifications?"
        description={`This will permanently delete ${readCount} read notification${readCount !== 1 ? 's' : ''}. This can't be undone.`}
        confirmLabel="Clear read"
        variant="danger"
      />

      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up!'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" onClick={markAllAsRead}>
                <CheckCheck size={16} />
                Mark all read
              </Button>
            )}
            {readCount > 0 && (
              <Button variant="ghost" onClick={() => setClearReadOpen(true)}>
                <Trash2 size={16} />
                Clear read
              </Button>
            )}
            <Button
              variant={showPreferences ? 'primary' : 'secondary'}
              onClick={() => setShowPreferences(!showPreferences)}
              aria-label="Notification preferences"
            >
              <Settings size={18} />
            </Button>
          </div>
        }
      />

      {showPreferences && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Settings size={18} className="text-gray-400" />
              Notification Preferences
            </h2>
            <div className="space-y-3">
              {Object.entries(PREFERENCE_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() => savePreferences({ ...preferences, [type]: !preferences[type] })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      preferences[type] ? 'bg-green-800' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      preferences[type] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="You'll see updates about your account, times and activity here."
        />
      ) : (
        <>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          {filtered.length === 0 ? (
            <EmptyState
              title="No unread notifications"
              description="You're all caught up — nothing new to see."
            />
          ) : (
            <div className="space-y-6">
              {orderedGroups.map(group => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {grouped[group].map(notification => {
                      const typeConfig = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.new_announcement
                      const Icon = typeConfig.icon

                      return (
                        <div
                          key={notification.id}
                          className={`bg-white rounded-xl border overflow-hidden transition ${
                            !notification.is_read ? 'border-green-200 shadow-sm' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-stretch">
                            {!notification.is_read && (
                              <div className="w-1 bg-green-500 flex-shrink-0" />
                            )}
                            <div className="flex items-start gap-3 p-4 flex-1 min-w-0">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${typeConfig.bg}`}>
                                <Icon size={16} className={typeConfig.color} />
                              </div>

                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <p className={`text-sm leading-snug ${
                                  !notification.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'
                                }`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatRelativeTime(notification.created_at)}
                                </p>
                                {notification.link && (
                                  <p className="text-xs text-green-600 mt-1 hover:underline">
                                    Tap to view →
                                  </p>
                                )}
                              </div>

                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                                aria-label="Delete notification"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
