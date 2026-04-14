import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  ChevronDown,
  User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent, PageHeader, Skeleton } from '../../components/ui'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'suspended', 'rejected']
const ROLE_FILTERS = ['all', 'user', 'supporter', 'club_head']
const PROVINCE_FILTERS = [
  'all',
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape'
]

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionType, setActionType] = useState('')
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [users, search, statusFilter, provinceFilter, roleFilter])

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['user', 'supporter', 'club_head'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      toast.error('Error loading users')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let result = [...users]

    if (search) {
      result = result.filter(u =>
        u.rider_name?.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(u => u.status === statusFilter)
    }

    if (provinceFilter !== 'all') {
      result = result.filter(u => u.province === provinceFilter)
    }

    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter)
    }

    setFiltered(result)
  }

  function openAction(user, type) {
    setSelectedUser(user)
    setActionType(type)
    setReason('')
    setShowModal(true)
  }

  async function handleAction() {
    if ((actionType === 'suspend' || actionType === 'reject') && !reason.trim()) {
      toast.error('Please enter a reason')
      return
    }

    setActionLoading(true)

    try {
      let newStatus = ''
      let notificationMessage = ''
      let notificationType = ''

      if (actionType === 'approve') {
        newStatus = 'approved'
        notificationType = 'account_approved'
        notificationMessage = 'Your account has been approved! You can now log in to KlipKlop.'
      } else if (actionType === 'reject') {
        newStatus = 'rejected'
        notificationType = 'account_rejected'
        notificationMessage = `Your account registration was not approved. Reason: ${reason}`
      } else if (actionType === 'suspend') {
        newStatus = 'suspended'
        notificationType = 'account_suspended'
        notificationMessage = `Your account has been suspended. Reason: ${reason}`
      } else if (actionType === 'unsuspend') {
        newStatus = 'approved'
        notificationType = 'account_unsuspended'
        notificationMessage = 'Your account suspension has been lifted. You can now log in.'
      }

      const updateData = { status: newStatus }
      if (reason) updateData.suspension_reason = reason

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id)

      if (error) throw error

      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        type: notificationType,
        message: notificationMessage,
        link: '/dashboard'
      })

      toast.success(`User ${actionType}d successfully`)
      setShowModal(false)
      fetchUsers()

    } catch (error) {
      toast.error('Error performing action')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEditProfile(user) {
    const newProvince = prompt('Edit province:', user.province)
    if (!newProvince) return

    const newAgeCategory = prompt('Edit age category:', user.age_category)
    if (!newAgeCategory) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          province: newProvince,
          age_category: newAgeCategory
        })
        .eq('id', user.id)

      if (error) throw error
      toast.success('Profile updated successfully')
      fetchUsers()
    } catch (error) {
      toast.error('Error updating profile')
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
        title="User Management"
        description={`${users.length} total users registered`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              {STATUS_FILTERS.map(s => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={provinceFilter}
              onChange={e => setProvinceFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              {PROVINCE_FILTERS.map(p => (
                <option key={p} value={p}>
                  {p === 'all' ? 'All provinces' : p}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              {ROLE_FILTERS.map(r => (
                <option key={r} value={r}>
                  {r === 'all' ? 'All roles' : r === 'user' ? 'Riders' : r === 'supporter' ? 'Supporters' : 'Club / Family Heads'}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        Showing {filtered.length} of {users.length} users
      </p>

      {/* Users list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No users found matching your filters
          </div>
        ) : (
          filtered.map(user => (
            <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {user.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-green-700 font-bold">
                      {user.rider_name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 truncate">{user.rider_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      user.role === 'supporter'
                        ? 'bg-blue-100 text-blue-700'
                        : user.role === 'club_head'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {user.role === 'supporter' ? 'Supporter' : user.role === 'club_head' ? 'Club / Family Head' : 'Rider'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {user.province}{user.age_category ? ` · ${user.age_category}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">
                    Registered {new Date(user.created_at).toLocaleDateString()}
                  </p>
                  {user.suspension_reason && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Reason: {user.suspension_reason}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={user.status} />

                {user.status === 'pending' && (
                  <>
                    <button
                      onClick={() => openAction(user, 'approve')}
                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700 transition"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => openAction(user, 'reject')}
                      className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-200 transition"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </>
                )}

                {user.status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleEditProfile(user)}
                      className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-200 transition"
                    >
                      <User size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => openAction(user, 'suspend')}
                      className="flex items-center gap-1 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs hover:bg-orange-200 transition"
                    >
                      <AlertCircle size={14} />
                      Suspend
                    </button>
                  </>
                )}

                {user.status === 'suspended' && (
                  <button
                    onClick={() => openAction(user, 'unsuspend')}
                    className="flex items-center gap-1 bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-xs hover:bg-green-200 transition"
                  >
                    <CheckCircle size={14} />
                    Unsuspend
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {actionType === 'approve' && `Approve ${selectedUser.rider_name}?`}
              {actionType === 'reject' && `Reject ${selectedUser.rider_name}?`}
              {actionType === 'suspend' && `Suspend ${selectedUser.rider_name}?`}
              {actionType === 'unsuspend' && `Unsuspend ${selectedUser.rider_name}?`}
            </h3>

            <p className="text-gray-500 text-sm mb-4">
              {actionType === 'approve' && 'This user will be able to log in and use the app.'}
              {actionType === 'reject' && 'This user will be notified that their account was not approved.'}
              {actionType === 'suspend' && 'This user will no longer be able to log in.'}
              {actionType === 'unsuspend' && 'This user will be able to log in again.'}
            </p>

            {(actionType === 'reject' || actionType === 'suspend') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (required)
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="Enter reason..."
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm text-white rounded-lg transition disabled:opacity-50 ${
                  actionType === 'approve' || actionType === 'unsuspend'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-orange-100 text-orange-700',
    rejected: 'bg-red-100 text-red-700'
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}