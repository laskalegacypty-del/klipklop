import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { PROVINCES } from '../../lib/constants'
import {
  CheckCircle, XCircle, AlertCircle, Search, ChevronDown, User, X, Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, Skeleton } from '../../components/ui'

const STATUS_FILTERS   = ['all', 'pending', 'approved', 'suspended', 'rejected']
const ROLE_FILTERS     = ['all', 'user', 'supporter', 'club_head']
const AGE_CATEGORIES   = ['Junior', 'Senior', 'Children', 'Veteran']

const STATUS_STYLE = {
  approved:  { bar: 'bg-green-500',  pill: 'bg-green-100 text-green-700'  },
  pending:   { bar: 'bg-yellow-400', pill: 'bg-yellow-100 text-yellow-700' },
  suspended: { bar: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700' },
  rejected:  { bar: 'bg-red-400',    pill: 'bg-red-100 text-red-700'      },
}

const ROLE_LABEL = {
  user:       'Rider',
  supporter:  'Supporter',
  club_head:  'Club Head',
}

const ROLE_STYLE = {
  supporter: 'bg-blue-100 text-blue-700',
  club_head: 'bg-purple-100 text-purple-700',
  user:      'bg-green-100 text-green-700',
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')

  // Action modal (approve / reject / suspend / unsuspend)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionType, setActionType] = useState('')
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Edit profile modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ province: '', age_category: '', role: 'user' })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => { applyFilters() }, [users, search, statusFilter, provinceFilter, roleFilter])

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['user', 'supporter', 'club_head'])
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch {
      toast.error('Error loading users')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let result = [...users]
    if (search) result = result.filter(u => u.rider_name?.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter !== 'all') result = result.filter(u => u.status === statusFilter)
    if (provinceFilter !== 'all') result = result.filter(u => u.province === provinceFilter)
    if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter)
    setFiltered(result)
  }

  function openAction(user, type) {
    setSelectedUser(user)
    setActionType(type)
    setReason('')
    setShowModal(true)
  }

  function openEditModal(user) {
    setEditTarget(user)
    setEditForm({ province: user.province || '', age_category: user.age_category || '', role: user.role || 'user' })
    setShowEditModal(true)
  }

  async function handleSaveEdit() {
    setEditSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ province: editForm.province, age_category: editForm.age_category, role: editForm.role })
        .eq('id', editTarget.id)
      if (error) throw error
      toast.success('Profile updated successfully')
      setShowEditModal(false)
      fetchUsers()
    } catch {
      toast.error('Error updating profile')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleAction() {
    if ((actionType === 'suspend' || actionType === 'reject') && !reason.trim()) {
      toast.error('Please enter a reason')
      return
    }
    setActionLoading(true)
    try {
      const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended', unsuspend: 'approved' }
      const newStatus = statusMap[actionType]
      const msgMap = {
        approve:   'Your account has been approved! You can now log in to KlipKlop.',
        reject:    `Your account registration was not approved. Reason: ${reason}`,
        suspend:   `Your account has been suspended. Reason: ${reason}`,
        unsuspend: 'Your account suspension has been lifted. You can now log in.',
      }
      const typeMap = {
        approve: 'account_approved', reject: 'account_rejected',
        suspend: 'account_suspended', unsuspend: 'account_unsuspended',
      }
      const updateData = { status: newStatus }
      if (reason) updateData.suspension_reason = reason
      const { error } = await supabase.from('profiles').update(updateData).eq('id', selectedUser.id)
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: selectedUser.id, type: typeMap[actionType],
        message: msgMap[actionType], link: '/dashboard'
      })
      toast.success(`User ${actionType}d successfully`)
      setShowModal(false)
      fetchUsers()
    } catch {
      toast.error('Error performing action')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  const pendingCount = users.filter(u => u.status === 'pending').length

  return (
    <div className="space-y-6">

      <PageHeader
        title="User Management"
        description={`${users.length} total · ${pendingCount} pending approval`}
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-gray-50"
            />
          </div>

          {[
            { value: statusFilter, onChange: setStatusFilter, options: STATUS_FILTERS, label: s => s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1) },
            { value: provinceFilter, onChange: setProvinceFilter, options: ['all', ...PROVINCES], label: p => p === 'all' ? 'All provinces' : p },
            { value: roleFilter, onChange: setRoleFilter, options: ROLE_FILTERS, label: r => r === 'all' ? 'All roles' : ROLE_LABEL[r] || r },
          ].map((sel, i) => (
            <div key={i} className="relative">
              <select
                value={sel.value}
                onChange={e => sel.onChange(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white w-full lg:w-auto"
              >
                {sel.options.map(o => <option key={o} value={o}>{sel.label(o)}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400 font-medium">
        Showing {filtered.length} of {users.length} users
      </p>

      {/* Users list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <User size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : filtered.map(user => {
          const ss = STATUS_STYLE[user.status] || { bar: 'bg-gray-300', pill: 'bg-gray-100 text-gray-700' }
          return (
            <div key={user.id} className="flex items-stretch">
              {/* Status colour bar */}
              <div className={`w-1 flex-shrink-0 ${ss.bar}`} />

              <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Avatar + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.profile_photo_url
                      ? <img src={user.profile_photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      : <span className="text-green-700 font-bold">{user.rider_name?.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{user.rider_name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${ROLE_STYLE[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[user.role] || user.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {user.province}{user.age_category ? ` · ${user.age_category}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                    {user.suspension_reason && (
                      <p className="text-xs text-red-500 mt-0.5">Reason: {user.suspension_reason}</p>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ss.pill}`}>
                    {user.status}
                  </span>

                  {user.status === 'pending' && (<>
                    <button onClick={() => openAction(user, 'approve')}
                      className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition">
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button onClick={() => openAction(user, 'reject')}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                      <XCircle size={13} /> Reject
                    </button>
                  </>)}

                  {user.status === 'approved' && (<>
                    <button onClick={() => openEditModal(user)}
                      className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200 transition">
                      <User size={13} /> Edit
                    </button>
                    <button onClick={() => openAction(user, 'suspend')}
                      className="flex items-center gap-1.5 bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-100 transition">
                      <AlertCircle size={13} /> Suspend
                    </button>
                  </>)}

                  {user.status === 'suspended' && (
                    <button onClick={() => openAction(user, 'unsuspend')}
                      className="flex items-center gap-1.5 bg-green-50 text-green-600 border border-green-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition">
                      <CheckCircle size={13} /> Unsuspend
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Edit Profile</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editTarget.rider_name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <div className="relative">
                  <select
                    value={editForm.province}
                    onChange={e => setEditForm(f => ({ ...f, province: e.target.value }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white pr-10"
                  >
                    <option value="">Select province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Category</label>
                <div className="relative">
                  <select
                    value={editForm.age_category}
                    onChange={e => setEditForm(f => ({ ...f, age_category: e.target.value }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white pr-10"
                  >
                    <option value="">Select category</option>
                    {AGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="relative">
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white pr-10"
                  >
                    <option value="user">Rider</option>
                    <option value="supporter">Supporter</option>
                    <option value="club_head">Club Head</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
                <Save size={15} />
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">
                {actionType === 'approve'   && `Approve ${selectedUser.rider_name}?`}
                {actionType === 'reject'    && `Reject ${selectedUser.rider_name}?`}
                {actionType === 'suspend'   && `Suspend ${selectedUser.rider_name}?`}
                {actionType === 'unsuspend' && `Unsuspend ${selectedUser.rider_name}?`}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {actionType === 'approve'   && 'This user will be able to log in and use the app.'}
              {actionType === 'reject'    && 'This user will be notified that their account was not approved.'}
              {actionType === 'suspend'   && 'This user will no longer be able to log in.'}
              {actionType === 'unsuspend' && 'This user will be able to log in again.'}
            </p>

            {(actionType === 'reject' || actionType === 'suspend') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
                  placeholder="Enter reason..."
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`px-4 py-2 text-sm text-white rounded-xl transition disabled:opacity-50 ${
                  actionType === 'approve' || actionType === 'unsuspend'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}>
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
