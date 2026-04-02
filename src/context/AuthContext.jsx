import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        setProfileLoaded(false)
        fetchProfile(session.user.id)
      }
      else {
        setProfileLoaded(true)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          setLoading(true)
          setProfileLoaded(false)
          fetchProfile(session.user.id)
        }
        else {
          setProfile(null)
          setProfileLoaded(true)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    } finally {
      setProfileLoaded(true)
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) return { data, error }

    // Check profile status before allowing login
    if (data.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileData?.status === 'pending') {
        // Sign them out immediately
        await supabase.auth.signOut()
        return {
          data: null,
          error: { message: 'Your account is pending approval by the admin.' }
        }
      }

      if (profileData?.status === 'suspended') {
        await supabase.auth.signOut()
        return {
          data: null,
          error: { message: 'Your account has been suspended. Please contact the administrator.' }
        }
      }

      if (profileData?.status === 'rejected') {
        await supabase.auth.signOut()
        return {
          data: null,
          error: { message: 'Your account registration was not approved.' }
        }
      }
    }

    return { data, error }
  }

  async function signUp(email, password, profileData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) return { data, error }

    if (data.user) {
      const isSupporter = profileData.role === 'supporter'
      const isClubHead = profileData.role === 'club_head'
      const isClubMember = profileData.role === 'club_member'

      // Determine stored role
      let storedRole = 'user'
      if (isSupporter) storedRole = 'supporter'
      else if (isClubHead) storedRole = 'club_head'
      else if (isClubMember) storedRole = 'club_member'

      // age_category only for riders (user) and club_member
      const needsAgeCategory = !isSupporter && !isClubHead
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          rider_name: profileData.rider_name,
          province: profileData.province || null,
          age_category: needsAgeCategory ? (profileData.age_category || null) : null,
          role: storedRole,
          status: 'pending'
        })

      if (profileError) {
        console.error('Profile insert error:', profileError)
        return { data, error: profileError }
      }

      // Notify admin
      const { data: adminData } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .maybeSingle()

      if (adminData) {
        await supabase.from('notifications').insert({
          user_id: adminData.id,
          type: 'new_registration',
          message: `New user ${profileData.rider_name} has registered and is pending approval.`,
          link: '/admin/users'
        })
      }
    }

    return { data, error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const value = {
    user,
    profile,
    loading,
    profileLoaded,
    signIn,
    signUp,
    signOut,
    isAdmin: profile?.role === 'admin',
    isSupporter: profile?.role === 'supporter',
    isClubHead: profile?.role === 'club_head',
    isClubMember: profile?.role === 'club_member',
    isApproved: profile?.status === 'approved',
    isPending: profile?.status === 'pending',
    isSuspended: profile?.status === 'suspended',
    refreshProfile: () => user && fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}