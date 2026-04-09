import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Users, Calendar, Megaphone, Clock, CheckCircle, XCircle, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Skeleton } from '../../components/ui'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    totalEvents: 0,
    totalAnnouncements: 0,
    totalTimesEntered: 0
  })
  const [pendingUsers, setPendingUsers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      // Fetch stats
      const [
        { count: totalUsers },
        { count: pendingCount },
        { count: totalEvents },
        { count: totalAnnouncements },
        { count: totalTimes }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('qualifier_events').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
        supabase.from('qualifier_results').select('*', { count: 'exact', head: true })
      ])

      setStats({
        totalUsers: totalUsers || 0,
        pendingUsers: pendingCount || 0,
        totalEvents: totalEvents || 0,
        totalAnnouncements: totalAnnouncements || 0,
        totalTimesEntered: totalTimes || 0
      })

      // Fetch pending users
      const { data: pending } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      setPendingUsers(pending || [])

      // Fetch recent registrations
      const { data: recent } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentActivity(recent || [])

    } catch (error) {
      toast.error('Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(userId, riderName) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .eq('id', userId)

      if (error) throw error

      // Send notification to user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'account_approved',
        message: 'Your account has been approved! You can now log in to KlipKlop.',
        link: '/dashboard'
      })

      toast.success(`${riderName} approved successfully!`)
      fetchDashboardData()

    } catch (error) {
      toast.error('Error approving user')
    }
  }

  async function handleReject(userId, riderName) {
    const reason = prompt(`Enter reason for rejecting ${riderName}'s account:`)
    if (!reason) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected', suspension_reason: reason })
        .eq('id', userId)

      if (error) throw error

      // Send notification to user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'account_rejected',
        message: `Your account registration was not approved. Reason: ${reason}`,
        link: '/login'
      })

      toast.success(`${riderName} rejected`)
      fetchDashboardData()

    } catch (error) {
      toast.error('Error rejecting user')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Admin Dashboard"
        description="Welcome back! Here's what's happening."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="text-blue-500" size={24} />}
          label="Total Users"
          value={stats.totalUsers}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Bell className="text-yellow-500" size={24} />}
          label="Pending Approval"
          value={stats.pendingUsers}
          bg="bg-yellow-50"
          alert={stats.pendingUsers > 0}
        />
        <StatCard
          icon={<Calendar className="text-green-500" size={24} />}
          label="Total Events"
          value={stats.totalEvents}
          bg="bg-green-50"
        />
        <StatCard
          icon={<Megaphone className="text-purple-500" size={24} />}
          label="Announcements"
          value={stats.totalAnnouncements}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Clock className="text-red-500" size={24} />}
          label="Times Entered"
          value={stats.totalTimesEntered}
          bg="bg-red-50"
        />
      </div>

      {/* Pending Approvals */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Pending Approvals
            {stats.pendingUsers > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-700 text-sm px-2 py-0.5 rounded-full">
                {stats.pendingUsers}
              </span>
            )}
          </h2>
          <Link
            to="/admin/users"
            className="text-sm text-green-700 hover:underline font-medium"
          >
            View all users →
          </Link>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No pending approvals
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingUsers.map(user => (
              <div key={user.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-bold">
                      {user.rider_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user.rider_name}</p>
                    <p className="text-sm text-gray-500">
                      {user.province} · {user.age_category}
                    </p>
                    <p className="text-xs text-gray-400">
                      Registered {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(user.id, user.rider_name)}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(user.id, user.rider_name)}
                    className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-200 transition"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Registrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Recent Registrations</h2>
        </div>
        {recentActivity.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No users registered yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentActivity.map(user => (
              <div key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-bold text-sm">
                      {user.rider_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{user.rider_name}</p>
                    <p className="text-xs text-gray-500">{user.province} · {user.age_category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    user.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : user.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {user.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickLink to="/admin/users" label="Manage Users" icon={<Users size={20} />} color="blue" />
        <QuickLink to="/admin/events" label="Manage Events" icon={<Calendar size={20} />} color="green" />
        <QuickLink to="/admin/matrix" label="Announcements" icon={<Megaphone size={20} />} color="purple" />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, bg, alert }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-2 ${alert ? 'ring-2 ring-yellow-400' : ''}`}>
      {icon}
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  )
}

function QuickLink({ to, label, icon, color }) {
  const colors = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700'
  }
  return (
    <Link
      to={to}
      className={`${colors[color]} text-white rounded-xl p-4 flex items-center gap-3 transition`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  )
}