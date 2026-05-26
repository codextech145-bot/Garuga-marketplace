import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { sendPasswordReset, signInWithPassword, signUpWithProfile, updatePassword } from '../services/supabaseMarketplace'
import { useAuth } from '../contexts/AuthContext'
import { DELIVERY_CATEGORIES, ROLES } from '../utils/marketplace'

function getErrorMessage(error) {
  if (!error) return ''
  if (error.status === 504) {
    return 'Supabase Auth timed out. In Supabase, disable email confirmation for testing or configure SMTP/email auth, then try again.'
  }
  if (typeof error === 'string') return error
  if (error.message && error.message !== '{}') return error.message
  if (error.error_description) return error.error_description
  if (error.error && String(error.error) !== '{}') return String(error.error)

  try {
    const serialized = JSON.stringify(error)
    return serialized && serialized !== '{}' ? serialized : ''
  } catch {
    return ''
  }
}

function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  const isRecovery = !isSignup && typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'buyer',
    deliveryCategories: ['all'],
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const getReturnPath = () => {
    const fromPath = location.state?.from
      ? `${location.state.from.pathname || ''}${location.state.from.search || ''}${location.state.from.hash || ''}`
      : ''

    if (fromPath && !['/login', '/signup'].includes(fromPath)) {
      return fromPath
    }

    try {
      const savedPath = window.localStorage.getItem('garuga-last-page')
      if (savedPath && !['/login', '/signup'].includes(savedPath)) {
        return savedPath
      }
    } catch {
      // Ignore storage failures.
    }

    return ''
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleDeliveryCategoryChange = (event) => {
    const { value, checked } = event.target
    setFormData((current) => {
      if (value === 'all') {
        return { ...current, deliveryCategories: checked ? ['all'] : [] }
      }

      const withoutAll = current.deliveryCategories.filter((category) => category !== 'all')
      const nextCategories = checked
        ? [...withoutAll, value]
        : withoutAll.filter((category) => category !== value)

      return { ...current, deliveryCategories: nextCategories.length ? nextCategories : ['all'] }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    try {
      if (isRecovery) {
        await updatePassword(formData.password)
        setNotice('Password updated. You can continue to your account.')
        navigate(getReturnPath() || '/dashboard', { replace: true })
      } else if (isSignup) {
        const data = await signUpWithProfile({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          deliveryCategories: formData.role === 'delivery' ? formData.deliveryCategories : [],
          email: formData.email.trim(),
          password: formData.password,
        })
        if (!data.session) {
          setError('Account created. Confirm your email if Supabase requires it, then login.')
          return
        }
        navigate(getReturnPath() || `/dashboard/${formData.role}`, { replace: true })
      } else {
        await signInWithPassword({
          email: formData.email.trim(),
          password: formData.password,
        })
        navigate(getReturnPath() || '/dashboard', { replace: true })
      }
    } catch (authError) {
      console.error(authError)
      const reasonText = getErrorMessage(authError)
      const reason = reasonText ? ` ${reasonText}` : ' Please check your Supabase auth settings and try again.'
      setError(
        isSignup
          ? `Signup failed.${reason}`
          : `Login failed.${reason || ' Check your email and password.'}`
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    const email = formData.email.trim()
    setError('')
    setNotice('')

    if (!email) {
      setError('Enter your email first, then tap reset password.')
      return
    }

    setSubmitting(true)
    try {
      await sendPasswordReset(email)
      setNotice('Password reset link sent. Check your email.')
    } catch (resetError) {
      console.error(resetError)
      const reasonText = getErrorMessage(resetError)
      setError(`Could not send reset link.${reasonText ? ` ${reasonText}` : ''}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user) {
    return <Navigate to={getReturnPath() || `/dashboard/${profile?.role || 'buyer'}`} replace />
  }

  return (
    <div className="market-shell auth-shell">
      <section className="market-panel auth-panel">
        <p className="market-eyebrow">Garuga Marketplace</p>
        <h2>{isRecovery ? 'Set new password' : isSignup ? 'Create your account' : 'Login'}</h2>
        <p className="market-muted">
          {isRecovery ? 'Choose a new password for your Garuga account.' : isSignup ? 'Join as a buyer, seller, or delivery partner.' : 'Welcome back to Garuga.'}
        </p>

        <form className="market-form" onSubmit={handleSubmit}>
          {isSignup && !isRecovery ? (
            <>
              <label>
                Name
                <input name="name" value={formData.name} onChange={handleChange} required />
              </label>
              <label>
                Phone
                <input name="phone" value={formData.phone} onChange={handleChange} required />
              </label>
              <label>
                Role
                <select name="role" value={formData.role} onChange={handleChange}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              {formData.role === 'delivery' ? (
                <fieldset className="delivery-category-field">
                  <legend>What kind of deliveries can you handle?</legend>
                  <p className="market-muted">Choose all, or pick the transport you use most.</p>
                  {DELIVERY_CATEGORIES.map((category) => (
                    <label key={category.id} className="market-check delivery-category-option">
                      <input
                        type="checkbox"
                        value={category.id}
                        checked={formData.deliveryCategories.includes(category.id)}
                        onChange={handleDeliveryCategoryChange}
                      />
                      <span>
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </>
          ) : null}

          {!isRecovery ? (
            <label>
              Email
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </label>
          ) : null}
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <small className="form-hint">Use at least 6 characters.</small>
          </label>

          {notice ? <p className="admin-success">{notice}</p> : null}
          {error ? <p className="admin-error">{error}</p> : null}
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Please wait...' : isRecovery ? 'Save new password' : isSignup ? 'Create account' : 'Login'}
          </button>
        </form>

        {!isSignup && !isRecovery ? (
          <button type="button" className="auth-text-button" onClick={handleResetPassword} disabled={submitting}>
            Forgot password?
          </button>
        ) : null}

        <p className="market-switch">
          {isSignup ? 'Already have an account?' : 'New to Garuga?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Login' : 'Create account'}</Link>
        </p>
      </section>
    </div>
  )
}

export default AuthPage
