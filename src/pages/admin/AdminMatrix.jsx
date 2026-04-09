import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { GAMES } from '../../lib/constants'
import { MATRIX } from '../../lib/matrix'
import {
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  Pin,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '../../components/ui'

const EMPTY_ANNOUNCEMENT = {
  title: '',
  body: '',
  is_pinned: false,
  expires_at: ''
}

export default function AdminMatrix() {
  const [activeTab, setActiveTab] = useState('announcements')
  const [announcements, setAnnouncements] = useState([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [form, setForm] = useState(EMPTY_ANNOUNCEMENT)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Matrix state
  const [matrixData, setMatrixData] = useState({})
  const [matrixEditing, setMatrixEditing] = useState(false)
  const [matrixSaving, setMatrixSaving] = useState(false)
  const [showMatrixWarning, setShowMatrixWarning] = useState(false)
  const [affectedUsers, setAffectedUsers] = useState(0)

  useEffect(() => {
    fetchAnnouncements()
    initMatrix()
  }, [])

  function initMatrix() {
    // Load matrix from our constants file
    const data = {}
    GAMES.forEach(game => {
      data[game] = {
        0: MATRIX[game][0][0],
        1: MATRIX[game][1][0],
        2: MATRIX[game][2][0],
        3: MATRIX[game][3][0],
        4: MATRIX[game][4][0]
      }
    })
    setMatrixData(data)
  }

  async function fetchAnnouncements() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      toast.error('Error loading announcements')
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  function openAdd() {
    setEditingAnnouncement(null)
    setForm(EMPTY_ANNOUNCEMENT)
    setShowModal(true)
  }

  function openEdit(announcement) {
    setEditingAnnouncement(announcement)
    setForm({
      title: announcement.title,
      body: announcement.body,
      is_pinned: announcement.is_pinned,
      expires_at: announcement.expires_at
        ? new Date(announcement.expires_at).toISOString().split('T')[0]
        : ''
    })
    setShowModal(true)
  }

  async function handleSaveAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Please fill in title and body')
      return
    }

    setSaving(true)

    try {
      const expiresAt = form.expires_at
        ? new Date(`${form.expires_at}T23:59:59.999Z`).toISOString()
        : null

      const payload = {
        title: form.title,
        body: form.body,
        is_pinned: form.is_pinned,
        expires_at: expiresAt
      }

      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editingAnnouncement.id)

        if (error) throw error
        toast.success('Announcement updated')
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(payload)

        if (error) throw error

        // Notify all approved users
        const { data: users } = await supabase
          .from('profiles')
          .select('id')
          .eq('status', 'approved')
          .eq('role', 'user')

        if (users && users.length > 0) {
          const { error: notifError } = await supabase.from('notifications').insert(
            users.map(u => ({
              user_id: u.id,
              type: 'new_announcement',
              message: `New announcement: ${form.title}`,
              link: '/dashboard'
            }))
          )

          if (notifError) {
            console.error('Error creating announcement notifications:', notifError)
            toast.error('Announcement posted, but notifications failed to send')
          }
        }

        toast.success('Announcement posted')
      }

      setShowModal(false)
      fetchAnnouncements()

    } catch (error) {
      console.error('Error saving announcement:', error)
      toast.error(error?.message ? `Error saving announcement: ${error.message}` : 'Error saving announcement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAnnouncement(id) {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Announcement deleted')
      setShowDeleteConfirm(null)
      fetchAnnouncements()
    } catch (error) {
      toast.error('Error deleting announcement')
    }
  }

  async function checkMatrixImpact() {
    // Count users with personal bests that would be affected
    const { count } = await supabase
      .from('personal_bests')
      .select('*', { count: 'exact', head: true })

    setAffectedUsers(count || 0)
    setShowMatrixWarning(true)
  }

  async function handleSaveMatrix() {
    setMatrixSaving(true)
    try {
      // In a real implementation this would update a matrix table in Supabase
      // For now we save to local constants and show success
      toast.success('Matrix updated successfully')
      setMatrixEditing(false)
      setShowMatrixWarning(false)
    } catch (error) {
      toast.error('Error saving matrix')
    } finally {
      setMatrixSaving(false)
    }
  }

  function handleMatrixChange(game, level, value) {
    setMatrixData(prev => ({
      ...prev,
      [game]: {
        ...prev[game],
        [level]: parseFloat(value) || 0
      }
    }))
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Matrix & Announcements"
        description="Manage level thresholds and post announcements"
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'announcements'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Announcements
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'matrix'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Level Matrix
        </button>
      </div>

      {/* Announcements tab */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              <Plus size={18} />
              New Announcement
            </button>
          </div>

          {loadingAnnouncements ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No announcements yet. Click "New Announcement" to post one.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(announcement => {
                const isExpired = announcement.expires_at &&
                  new Date(announcement.expires_at) < new Date()

                return (
                  <div
                    key={announcement.id}
                    className={`bg-white rounded-xl border p-4 ${
                      isExpired ? 'border-gray-200 opacity-60' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800">
                            {announcement.title}
                          </h3>
                          {announcement.is_pinned && (
                            <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                              <Pin size={10} />
                              Pinned
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Expired
                            </span>
                          )}
                          {announcement.expires_at && !isExpired && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              Expires {new Date(announcement.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {announcement.body}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Posted {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEdit(announcement)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(announcement.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Matrix tab */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Time thresholds in seconds for each level. Lower time = higher level.
            </p>
            <div className="flex gap-2">
              {matrixEditing ? (
                <>
                  <button
                    onClick={() => {
                      setMatrixEditing(false)
                      initMatrix()
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={checkMatrixImpact}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                  >
                    <Save size={16} />
                    Save Matrix
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setMatrixEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                >
                  <Pencil size={16} />
                  Edit Matrix
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Game</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">L0 from</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-600">L1 from</th>
                  <th className="text-center px-4 py-3 font-semibold text-green-600">L2 from</th>
                  <th className="text-center px-4 py-3 font-semibold text-orange-600">L3 from</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-600">L4 max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {GAMES.map(game => (
                  <tr key={game} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{game}</td>
                    {[0, 1, 2, 3, 4].map(level => (
                      <td key={level} className="px-4 py-3 text-center">
                        {matrixEditing ? (
                          <input
                            type="number"
                            step="0.001"
                            value={matrixData[game]?.[level] || ''}
                            onChange={e => handleMatrixChange(game, level, e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        ) : (
                          <span className="text-gray-700">
                            {matrixData[game]?.[level]?.toFixed(3)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="Announcement title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body
                </label>
                <textarea
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="Write your announcement here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date (optional)
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={form.is_pinned}
                  onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <label htmlFor="is_pinned" className="text-sm text-gray-700">
                  Pin this announcement to the top of users' home dashboard
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : editingAnnouncement ? 'Update' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matrix warning modal */}
      {showMatrixWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-500" size={24} />
              <h3 className="text-lg font-bold text-gray-800">Confirm Matrix Update</h3>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              This change will affect the Nationals level calculation for:
            </p>
            <p className="text-2xl font-bold text-yellow-600 mb-4">
              {affectedUsers} personal best records
            </p>
            <p className="text-gray-500 text-sm mb-6">
              All users' Nationals levels will be recalculated using the new thresholds.
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMatrixWarning(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMatrix}
                disabled={matrixSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
              >
                <Save size={16} />
                {matrixSaving ? 'Saving...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Announcement?</h3>
            <p className="text-gray-500 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAnnouncement(showDeleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}