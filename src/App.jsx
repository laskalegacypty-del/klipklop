import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'

// Auth pages
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminEvents from './pages/admin/AdminEvents'
import AdminMatrix from './pages/admin/AdminMatrix'

// User pages
import Dashboard from './pages/user/Dashboard'
import Profile from './pages/user/Profile'
import Qualifiers from './pages/user/Qualifiers'
import MyTimes from './pages/user/MyTimes'
import QualifierTracker from './pages/user/QualifierTracker'
import SeasonOverview from './pages/user/SeasonOverview'
import Notifications from './pages/user/Notifications'
import Horses from './pages/user/Horses'
import HorseDetails from './pages/user/HorseDetails'
import Matrix from './pages/user/Matrix'
import SupporterRiders from './pages/user/SupporterRiders'
import ClubRiders from './pages/user/ClubRiders'
import FriendsLeaderboard from './pages/user/FriendsLeaderboard'
import { APP_NAME, APP_LOGO_SRC } from './constants/branding'

function ProtectedRoute({ children }) {
  const { user, profile, loading, profileLoaded, signOut } = useAuth()

  // When a user exists, wait for profile to load before deciding where to route.
  if (loading || (user && !profileLoaded)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  if (!user) return <Navigate to="/login" />
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">Profile not found</h2>
          <p className="text-sm text-gray-600 mt-2">
            Your account is logged in, but we couldn’t load your profile record.
            Please contact the admin, or sign out and try again.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 w-full bg-green-800 text-white py-2.5 rounded-lg font-semibold hover:bg-green-900 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }
  if (profile?.status === 'pending') return <Navigate to="/pending" />
  if (profile?.status === 'suspended') return <Navigate to="/suspended" />

  return <Layout>{children}</Layout>
}

function AdminRoute({ children }) {
  const { user, profile, loading, profileLoaded } = useAuth()

  if (loading || (user && !profileLoaded)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  if (profile?.role !== 'admin') return <Navigate to="/dashboard" />

  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
          <div className="text-center p-5 sm:p-8 bg-white rounded-2xl shadow w-full max-w-md">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 shadow-sm">
              <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
            </div>
            <p className="text-sm font-semibold text-green-900 mb-1">{APP_NAME}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
              Account Pending Approval
            </h2>
            <p className="text-sm sm:text-base text-gray-600 leading-6">
              Your account is awaiting admin approval. You will be
              notified by email once approved.
            </p>
          </div>
        </div>
      } />
      <Route path="/suspended" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
          <div className="text-center p-5 sm:p-8 bg-white rounded-2xl shadow w-full max-w-md">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 shadow-sm">
              <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
            </div>
            <p className="text-sm font-semibold text-green-900 mb-1">{APP_NAME}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">
              Account Suspended
            </h2>
            <p className="text-sm sm:text-base text-gray-600 leading-6">
              Your account has been suspended. Please contact the administrator.
            </p>
          </div>
        </div>
      } />

      {/* User routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/qualifiers" element={
        <ProtectedRoute><Qualifiers /></ProtectedRoute>
      } />
      <Route path="/my-times" element={
        <ProtectedRoute><MyTimes /></ProtectedRoute>
      } />
      <Route path="/tracker" element={
        <ProtectedRoute><QualifierTracker /></ProtectedRoute>
      } />
      <Route path="/season" element={
        <ProtectedRoute><SeasonOverview /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute><Notifications /></ProtectedRoute>
      } />
      <Route path="/horses" element={
        <ProtectedRoute><Horses /></ProtectedRoute>
      } />
      <Route path="/horses/:horseId" element={
        <ProtectedRoute><HorseDetails /></ProtectedRoute>
      } />
      <Route path="/matrix" element={
        <ProtectedRoute><Matrix /></ProtectedRoute>
      } />
      <Route path="/my-riders" element={
        <ProtectedRoute><SupporterRiders /></ProtectedRoute>
      } />
      <Route path="/my-club-riders" element={
        <ProtectedRoute><ClubRiders /></ProtectedRoute>
      } />
      <Route path="/friends-leaderboard" element={
        <ProtectedRoute><FriendsLeaderboard /></ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin/dashboard" element={
        <AdminRoute><AdminDashboard /></AdminRoute>
      } />
      <Route path="/admin/users" element={
        <AdminRoute><AdminUsers /></AdminRoute>
      } />
      <Route path="/admin/events" element={
        <AdminRoute><AdminEvents /></AdminRoute>
      } />
      <Route path="/admin/matrix" element={
        <AdminRoute><AdminMatrix /></AdminRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Landing />} />
      {/* Unknown routes (important on static hosting / SPA refresh) */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}