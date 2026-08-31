import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

const ViewAsContext = createContext(null)

// Applies a session's staged inserts/updates/upserts/deletes on top of a real
// array of rows for one table, so the admin's own edits stay visible while
// browsing — purely a client-side illusion, nothing here touches real data.
function applyStagedItems(items, table, realRows) {
  const tableItems = items.filter(i => i.table_name === table)
  if (tableItems.length === 0) return realRows || []
  let result = [...(realRows || [])]

  function matches(row, match) {
    if (!match) return false
    return Object.entries(match).every(([k, v]) => row[k] === v)
  }

  for (const item of tableItems) {
    if (item.operation === 'insert') {
      result.push(item.payload)
    } else if (item.operation === 'update') {
      result = result.map(r => matches(r, item.match) ? { ...r, ...item.payload } : r)
    } else if (item.operation === 'upsert') {
      const idx = result.findIndex(r => matches(r, item.match))
      if (idx === -1) result.push(item.payload)
      else result[idx] = { ...result[idx], ...item.payload }
    } else if (item.operation === 'delete') {
      result = result.filter(r => !matches(r, item.match))
    }
  }
  return result
}

export function ViewAsProvider({ grant, targetProfile: initialTargetProfile, children }) {
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [ready, setReady] = useState(false)
  // Local, session-scoped copy so a staged profile-field edit is reflected
  // immediately in useAuth().profile — the real row is untouched until approval.
  const [targetProfile, setTargetProfile] = useState(initialTargetProfile)

  useEffect(() => {
    let cancelled = false
    async function init() {
      setReady(false)
      const { data: existing } = await supabase
        .from('staged_edit_sessions')
        .select('*')
        .eq('grant_id', grant.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let sess = existing
      if (!sess) {
        const { data: created, error } = await supabase
          .from('staged_edit_sessions')
          .insert({ grant_id: grant.id, admin_id: grant.admin_id, user_id: grant.user_id })
          .select()
          .single()
        if (error) {
          console.error('Could not start view-as session:', error)
          if (!cancelled) setReady(true)
          return
        }
        sess = created
      }
      if (cancelled) return
      setSession(sess)

      const { data: existingItems } = await supabase
        .from('staged_edit_items')
        .select('*')
        .eq('session_id', sess.id)
        .order('created_at', { ascending: true })

      if (!cancelled) {
        setItems(existingItems || [])
        setReady(true)
      }
    }
    init()
    return () => { cancelled = true }
  }, [grant.id])

  const stage = useCallback(async (table, operation, payload, match = null) => {
    if (!session) return { data: null, error: new Error('View As session not ready') }

    const id = payload?.id || match?.id || crypto.randomUUID()
    const fullPayload = operation === 'delete' ? null : { ...payload, id: payload?.id || id }
    const fullMatch = match || { id }

    const { data: inserted, error } = await supabase
      .from('staged_edit_items')
      .insert({
        session_id: session.id,
        table_name: table,
        operation,
        payload: fullPayload,
        match: fullMatch,
      })
      .select()
      .single()

    if (error) return { data: null, error }
    setItems(prev => [...prev, inserted])
    if (table === 'profiles' && operation === 'update') {
      setTargetProfile(prev => ({ ...prev, ...payload }))
    }
    return { data: fullPayload, error: null }
  }, [session])

  const mergeStaged = useCallback((table, realRows) => applyStagedItems(items, table, realRows), [items])

  const submit = useCallback(async () => {
    if (!session) return
    const { error } = await supabase
      .from('staged_edit_sessions')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) throw error
    await supabase.from('notifications').insert({
      user_id: session.user_id,
      type: 'profile_edits_submitted',
      message: `An admin submitted ${items.length} proposed change${items.length === 1 ? '' : 's'} to your profile for review.`,
      link: '/profile',
    })
    setSession(prev => ({ ...prev, status: 'submitted' }))
  }, [session, items.length])

  const value = useMemo(() => ({
    active: true,
    ready,
    session,
    targetProfile,
    itemCount: items.length,
    stage,
    mergeStaged,
    submit,
  }), [ready, session, targetProfile, items.length, stage, mergeStaged, submit])

  return (
    <ViewAsContext.Provider value={value}>
      {children}
    </ViewAsContext.Provider>
  )
}

const INACTIVE = { active: false, ready: true, mergeStaged: (_table, rows) => rows || [] }

// eslint-disable-next-line react-refresh/only-export-components
export function useViewAs() {
  return useContext(ViewAsContext) || INACTIVE
}
