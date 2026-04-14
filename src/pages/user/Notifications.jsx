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
import { Button, Card, CardContent, PageHeader, Skeleton } from '../../components/ui'

const NOTIFICATION_TYPES = {
  account_approved: {
    icon: UserCheck,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  account_rejected: {
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-100'
  },
  account_suspended: {
    icon: X,
    color: 'text-orange-600',
    bg: 'bg-orange-100'
  },
  // Backward compatibility for previously stored notification rows
  account_suspend: {
    icon: X,
    color: 'text-orange-600',
    bg: 'bg-orange-100'
  },
  account_unsuspended: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  new_announcement: {
    icon: Megaphone,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  },
  new_pb: {
    icon: Star,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100'
  },
  nationals_level_change: {
    icon: Trophy,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  upcoming_qualifier: {
    icon: Calendar,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  new_registration: {
    icon: UserCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  supporter_request: {
    icon: UserPlus,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  supporter_request_accepted: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  supporter_request_rejected: {
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-100'
  },
  club_link_request: {
    icon: UserPlus,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  club_link_accepted: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100'
  },
  club_link_rejected: {
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-100'
  },
  horse_reminder_due: {
    icon: Calendar,
    color: 'text-orange-600',
    bg: 'bg-orange-100'
  },
  friend_overtake: {
    icon: TrendingUp,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
  }
}

const PREFERENCE_LABELS = {
  account_approved: 'Account status updates',
  new_announcement: 'New announcements',
  new_pb: 'New personal bests',
  nationals_level_change: 'Nationals level changes',
  upcoming_qualifier: 'Upcoming qualifier reminders'
}

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({
    account_approved: true,
    new_announcement: true,
    new_pb: true,
    nationals_level_change: true,
    upcoming_qualifier: true
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
    if (saved) {
      setPreferences(JSON.parse(saved))
    }
  }

  function savePreferences(newPrefs) {
    setPreferences(newPrefs)
    localStorage.setItem(
      `notif_prefs_${profile.id}`,
      JSON.stringify(newPrefs)
    )
    toast.success('Preferences saved')
  }

  async function markAsRead(notificationId) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
    } catch (error) {
      console.error('Error marking as read:', error)
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
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch {
      toast.error('Error deleting notification')
    }
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
            : 'All caught up!'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 ? (
              <Button variant="secondary" onClick={markAllAsRead}>
                <CheckCheck size={16} />
                Mark all read
              </Button>
            ) : null}
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

      {/* Preferences panel */}
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
                  onClick={() => savePreferences({
                    ...preferences,
                    [type]: !preferences[type]
                  })}
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

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No notifications yet</p>
          <p className="text-gray-300 text-sm mt-1">
            You'll see updates about your account and activity here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => {
            const typeConfig = NOTIFICATION_TYPES[notification.type] ||
              NOTIFICATION_TYPES.new_announcement
            const Icon = typeConfig.icon

            return (
              <div
                key={notification.id}
                className={`bg-white rounded-xl border p-4 transition ${
                  !notification.is_read
                    ? 'border-green-200 shadow-sm'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${typeConfig.bg}`}>
                    <Icon size={18} className={typeConfig.color} />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <p className={`text-sm ${
                      !notification.is_read
                        ? 'font-semibold text-gray-800'
                        : 'text-gray-600'
                    }`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.created_at).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {notification.link && (
                      <p className="text-xs text-green-600 mt-1 hover:underline">
                        Tap to view →
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}