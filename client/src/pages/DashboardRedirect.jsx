import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function DashboardRedirect() {
  const { loading, profile, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="empty-message">Loading dashboard...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Navigate to={`/dashboard/${profile?.role || 'buyer'}`} replace />
}

export default DashboardRedirect
