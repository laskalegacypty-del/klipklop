import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Button, Input, PasswordInput } from '../components/ui'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
  
    try {
      const { error } = await signIn(email, password)
  
      if (error) {
        toast.error(error.message)
        return
      }
  
      setTimeout(() => {
        navigate('/dashboard')
      }, 500)
  
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-600 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-8">

        {/* Logo / Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 shadow-sm">
            <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-green-900">{APP_NAME}</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">{APP_TAGLINE}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-800 font-semibold hover:underline">
              Register here
            </Link>
          </p>
          <button
            onClick={async () => {
              const email = prompt('Enter your email address')
              if (email) {
                const { supabase } = await import('../lib/supabaseClient')
                await supabase.auth.resetPasswordForEmail(email)
                toast.success('Password reset email sent!')
              }
            }}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}