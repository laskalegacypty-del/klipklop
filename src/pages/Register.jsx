import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PROVINCES, AGE_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'
import { Button, Input, PasswordInput, Select } from '../components/ui'
import { APP_NAME, APP_LOGO_SRC } from '../constants/branding'

export default function Register() {
  const [role, setRole] = useState('user') // 'user' | 'supporter' | 'club_head'
  const [formData, setFormData] = useState({
    rider_name: '',
    email: '',
    password: '',
    confirm_password: '',
    province: '',
    age_category: ''
  })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const isSupporter = role === 'supporter'
  const isClubHead = role === 'club_head'
  // age category only required for riders (not supporters or club heads)
  const needsAgeCategory = !isSupporter && !isClubHead

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (!formData.province) {
      toast.error('Please select your province')
      return
    }

    if (needsAgeCategory && !formData.age_category) {
      toast.error('Please select your age category')
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        {
          rider_name: formData.rider_name,
          province: formData.province,
          age_category: formData.age_category,
          role
        }
      )

      if (error) {
        toast.error(error.message)
        return
      }

      navigate('/pending')

    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Title */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 shadow-sm">
            <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-green-900">{APP_NAME}</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        {/* Role selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            I am registering as a…
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                role === 'user'
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              🏇 Rider
            </button>
            <button
              type="button"
              onClick={() => setRole('supporter')}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                role === 'supporter'
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              👤 Supporter
            </button>
            <button
              type="button"
              onClick={() => setRole('club_head')}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition ${
                role === 'club_head'
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              🏠 Club / Family Head
            </button>
          </div>
          {isSupporter && (
            <p className="mt-2 text-xs text-gray-400">
              Supporters can follow riders and view their times — they don't compete themselves.
            </p>
          )}
          {isClubHead && (
            <p className="mt-2 text-xs text-gray-400">
              Club/Family Heads manage riders under their club or family. They upload times on riders' behalf.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupporter || isClubHead ? 'Full Name' : 'Full Name (Rider Name)'}
            </label>
            <Input
              type="text"
              name="rider_name"
              value={formData.rider_name}
              onChange={handleChange}
              required
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          {/* Province — all roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Province
            </label>
            <Select
              name="province"
              value={formData.province}
              onChange={handleChange}
              required
            >
              <option value="">Select your province</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>

          {/* Age Category — riders and club_member only */}
          {needsAgeCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age Category
              </label>
              <Select
                name="age_category"
                value={formData.age_category}
                onChange={handleChange}
                required
              >
                <option value="">Select age category</option>
                {AGE_CATEGORIES.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <PasswordInput
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <PasswordInput
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-green-800 font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Your account will be reviewed by the admin before you can log in.
          </p>
        </div>
      </div>
    </div>
  )
}
