import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function canAccessRole(profileRole, requiredRole) {
  if (!requiredRole) return true
  if (profileRole === requiredRole) return true
  if (['seller', 'delivery'].includes(profileRole) && ['seller', 'delivery'].includes(requiredRole)) return true
  return false
}

function ProtectedRoute({ role, children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="empty-message">Loading account...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (role && !canAccessRole(profile?.role, role)) {
    return <Navigate to={`/dashboard/${profile?.role || 'buyer'}`} replace />
  }

  return children
}

export default ProtectedRoute
