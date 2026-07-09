import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { QUALIFIER_GAMES, PROVINCES } from '../../lib/constants'
import {
  Plus, Pencil, Trash2, ChevronDown, Calendar, MapPin, X, Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, PageHeader, Skeleton } from '../../components/ui'

const EVENT_TYPES = ['qualifier', 'regionals', 'nationals', 'demo day']

const EVENT_TYPE_STYLE = {
  qualifier:  'bg-green-100 text-green-700',
  regionals:  'bg-blue-100 text-blue-700',
  nationals:  'bg-purple-100 text-purple-700',
  'demo day': 'bg-orange-100 text-orange-700',
}

const EMPTY_FORM = {
  date: '', province: '', venue: '', qualifier_number: '', event_type: 'qualifier', notes: ''
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

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { applyFilters() }, [events, provinceFilter, typeFilter])

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('qualifier_events').select('*').order('date', { ascending: true })
      if (error) throw error
      setEvents(data || [])
    } catch {
      toast.error('Error loading events')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let result = [...events]
    if (provinceFilter !== 'all') result = result.filter(e => e.province === provinceFilter)
    if (typeFilter !== 'all') result = result.filter(e => e.event_type === typeFilter)
    setFiltered(result)
  }

  function getEventTiming(date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(date)
    const diff = Math.ceil((d - today) / 86400000)
    if (diff < 0)  return { label: 'Past',      style: 'bg-gray-100 text-gray-500', isPast: true  }
    if (diff <= 7) return { label: 'This week',  style: 'bg-emerald-100 text-emerald-700', isPast: false }
    return             { label: 'Upcoming',   style: 'bg-blue-100 text-blue-700', isPast: false }
  }

  function openAdd() {
    setEditingEvent(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(event) {
    setEditingEvent(event)
    setForm({
      date: event.date, province: event.province, venue: event.venue,
      qualifier_number: event.qualifier_number || '', event_type: event.event_type,
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
      const parsedQualifierNumber =
        form.qualifier_number === '' || form.qualifier_number == null
          ? null : Number.parseInt(form.qualifier_number, 10)

      if (form.event_type === 'qualifier' && (parsedQualifierNumber == null || Number.isNaN(parsedQualifierNumber))) {
        toast.error('Qualifier number must be a valid number')
        setSaving(false)
        return
      }

      const payload = {
        date: form.date, province: form.province, venue: form.venue,
        qualifier_number: Number.isNaN(parsedQualifierNumber) ? null : parsedQualifierNumber,
        event_type: form.event_type, notes: form.notes || null
      }

      if (editingEvent) {
        const { data, error } = await supabase.from('qualifier_events').update(payload).eq('id', editingEvent.id).select()
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Update was not applied — check RLS permissions.')
        setEvents(prev => prev.map(e => e.id === data[0].id ? data[0] : e))
        toast.success('Event updated successfully')
      } else {
        const { data, error } = await supabase.from('qualifier_events').insert(payload).select()
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Insert was not applied — check RLS permissions.')
        setEvents(prev => [...prev, data[0]])
        toast.success('Event added successfully')
      }

      setShowModal(false)
      fetchEvents()
    } catch (error) {
      toast.error(error?.message ? `Error saving event: ${error.message}` : 'Error saving event')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(eventId) {
    try {
      const { data, error } = await supabase.from('qualifier_events').delete().eq('id', eventId).select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Delete was not applied — check RLS permissions.')
      toast.success('Event deleted')
      setShowDeleteConfirm(null)
      setEvents(prev => prev.filter(e => e.id !== eventId))
      fetchEvents()
    } catch (error) {
      toast.error(error?.message ? `Error deleting event: ${error.message}` : 'Error deleting event')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  const upcoming = filtered.filter(e => !getEventTiming(e.date).isPast)
  const past     = filtered.filter(e =>  getEventTiming(e.date).isPast)

  return (
    <div className="space-y-6">

      <PageHeader
        title="Qualifier Events"
        description={`${events.length} events · ${upcoming.length} upcoming`}
        actions={
          <Button onClick={openAdd}>
            <Plus size={18} /> Add Event
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {[
            { value: provinceFilter, onChange: setProvinceFilter, options: ['all', ...PROVINCES], label: p => p === 'all' ? 'All provinces' : p },
            { value: typeFilter,     onChange: setTypeFilter,     options: ['all', ...EVENT_TYPES], label: t => t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1) },
          ].map((sel, i) => (
            <div key={i} className="relative">
              <select
                value={sel.value}
                onChange={e => sel.onChange(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white w-full sm:w-auto"
              >
                {sel.options.map(o => <option key={o} value={o}>{sel.label(o)}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
          <Calendar size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400 font-medium">No events found</p>
          <p className="text-xs text-gray-300 mt-1">Click "Add Event" to get started</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Upcoming — {upcoming.length}
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                {upcoming.map(event => <EventRow key={event.id} event={event} onEdit={openEdit} onDelete={setShowDeleteConfirm} />)}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Past — {past.length}
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100 opacity-70">
                {past.map(event => <EventRow key={event.id} event={event} onEdit={openEdit} onDelete={setShowDeleteConfirm} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingEvent ? 'Edit Event' : 'Add New Event'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Event Type">
                <SelectField value={form.event_type} onChange={v => setForm({ ...form, event_type: v })}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </SelectField>
              </Field>

              <Field label="Date">
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </Field>

              <Field label="Province">
                <SelectField value={form.province} onChange={v => setForm({ ...form, province: v })}>
                  <option value="">Select province</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </SelectField>
              </Field>

              <Field label="Venue">
                <input type="text" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                  placeholder="e.g. Cavallo Felice, Meyerton"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </Field>

              {form.event_type === 'qualifier' && (
                <Field label="Qualifier Number">
                  <SelectField value={form.qualifier_number} onChange={v => setForm({ ...form, qualifier_number: v })}>
                    <option value="">Select qualifier number</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>Q{n} — {QUALIFIER_GAMES[n]?.join(', ')}</option>
                    ))}
                  </SelectField>
                </Field>
              )}

              <Field label="Notes (optional)">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  placeholder="Entry fees, contact details, special instructions..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
              </Field>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
                <Save size={15} />
                {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Delete Event?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onEdit, onDelete }) {
  const d = new Date(event.date)
  const day = d.toLocaleDateString('en-ZA', { day: '2-digit' })
  const mon = d.toLocaleDateString('en-ZA', { month: 'short' }).toUpperCase()
  const weekday = d.toLocaleDateString('en-ZA', { weekday: 'short' })
  const games = event.qualifier_number ? QUALIFIER_GAMES[event.qualifier_number] : null

  return (
    <div className="flex items-start gap-4 p-4">
      {/* Date stamp */}
      <div className="flex-shrink-0 w-14 text-center bg-green-50 rounded-xl py-2.5 border border-green-100">
        <p className="text-xs font-medium text-green-600 leading-none">{mon}</p>
        <p className="text-2xl font-bold text-green-800 leading-tight mt-0.5">{day}</p>
        <p className="text-xs text-green-500">{weekday}</p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {event.qualifier_number && (
            <span className="text-xs font-bold bg-green-800 text-white px-2 py-0.5 rounded-md">
              Q{event.qualifier_number}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${EVENT_TYPE_STYLE[event.event_type] || 'bg-gray-100 text-gray-600'}`}>
            {event.event_type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-700 mb-1">
          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{event.venue}, {event.province}</span>
        </div>

        {games && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {games.map(g => (
              <span key={g} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{g}</span>
            ))}
          </div>
        )}

        {event.notes && (
          <p className="text-xs text-gray-400 italic mt-1.5">{event.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onEdit(event)}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
          <Pencil size={15} />
        </button>
        <button onClick={() => onDelete(event.id)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SelectField({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white pr-10"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
