import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { QUALIFIER_GAMES, PROVINCES } from '../../lib/constants'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Calendar,
  MapPin,
  X,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, PageHeader, Skeleton } from '../../components/ui'

const EVENT_TYPES = ['qualifier', 'regionals', 'nationals', 'demo day']

const EMPTY_FORM = {
  date: '',
  province: '',
  venue: '',
  qualifier_number: '',
  event_type: 'qualifier',
  notes: ''
}

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [events, provinceFilter, typeFilter])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('qualifier_events')
        .select('*')
        .order('date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      toast.error('Error loading events')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let result = [...events]

    if (provinceFilter !== 'all') {
      result = result.filter(e => e.province === provinceFilter)
    }

    if (typeFilter !== 'all') {
      result = result.filter(e => e.event_type === typeFilter)
    }

    setFiltered(result)
  }

  function getEventStatus(date) {
    const today = new Date()
    const eventDate = new Date(date)
    const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { label: 'Past', style: 'bg-gray-100 text-gray-500' }
    if (diffDays <= 7) return { label: 'This week', style: 'bg-green-100 text-green-700' }
    return { label: 'Upcoming', style: 'bg-blue-100 text-blue-700' }
  }

  function openAdd() {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(event) {
    setEditingEvent(event)
    setForm({
      date: event.date,
      province: event.province,
      venue: event.venue,
      qualifier_number: event.qualifier_number || '',
      event_type: event.event_type,
      notes: event.notes || ''
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.date || !form.province || !form.venue) {
      toast.error('Please fill in date, province and venue')
      return
    }

    if (form.event_type === 'qualifier' && !form.qualifier_number) {
      toast.error('Please select a qualifier number')
      return
    }

    setSaving(true)

    try {
      const payload = {
        date: form.date,
        province: form.province,
        venue: form.venue,
        qualifier_number: form.qualifier_number || null,
        event_type: form.event_type,
        notes: form.notes || null
      }

      if (editingEvent) {
        const { error } = await supabase
          .from('qualifier_events')
          .update(payload)
          .eq('id', editingEvent.id)

        if (error) throw error
        toast.success('Event updated successfully')
      } else {
        const { error } = await supabase
          .from('qualifier_events')
          .insert(payload)

        if (error) throw error
        toast.success('Event added successfully')
      }

      setShowModal(false)
      fetchEvents()

    } catch (error) {
      toast.error('Error saving event')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(eventId) {
    try {
      const { error } = await supabase
        .from('qualifier_events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      toast.success('Event deleted')
      setShowDeleteConfirm(null)
      fetchEvents()
    } catch (error) {
      toast.error('Error deleting event')
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
        title="Qualifier Events"
        description={`${events.length} events in the system`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={18} />
            Add Event
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative">
            <select
              value={provinceFilter}
              onChange={e => setProvinceFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              <option value="all">All provinces</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              <option value="all">All event types</option>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No events found. Click "Add Event" to get started.
          </div>
        ) : (
          filtered.map(event => {
            const status = getEventStatus(event.date)
            const games = event.qualifier_number
              ? QUALIFIER_GAMES[event.qualifier_number]
              : null

            return (
              <div key={event.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">

                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.style}`}>
                        {status.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 capitalize">
                        {event.event_type}
                      </span>
                      {event.qualifier_number && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                          Q{event.qualifier_number}
                        </span>
                      )}
                    </div>

                    {/* Date and venue */}
                    <div className="mt-2 flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Calendar size={15} className="text-gray-400" />
                        <span className="text-sm font-medium">
                          {new Date(event.date).toLocaleDateString('en-ZA', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <MapPin size={15} className="text-gray-400" />
                        <span className="text-sm">{event.venue}, {event.province}</span>
                      </div>
                    </div>

                    {/* Games */}
                    {games && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {games.map(game => (
                          <span
                            key={game}
                            className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                          >
                            {game}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {event.notes && (
                      <p className="mt-2 text-xs text-gray-500 italic">{event.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(event)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(event.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {editingEvent ? 'Edit Event' : 'Add New Event'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={form.event_type}
                  onChange={e => setForm({ ...form, event_type: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>

              {/* Province */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Province
                </label>
                <select
                  value={form.province}
                  onChange={e => setForm({ ...form, province: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="">Select province</option>
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Venue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={form.venue}
                  onChange={e => setForm({ ...form, venue: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="e.g. Cavallo Felice, Meyerton"
                />
              </div>

              {/* Qualifier number */}
              {form.event_type === 'qualifier' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qualifier Number
                  </label>
                  <select
                    value={form.qualifier_number}
                    onChange={e => setForm({ ...form, qualifier_number: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">Select qualifier number</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>
                        Qualifier {n} — {QUALIFIER_GAMES[n]?.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="Entry fees, contact details, special instructions..."
                />
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
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Event?</h3>
            <p className="text-gray-500 text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
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