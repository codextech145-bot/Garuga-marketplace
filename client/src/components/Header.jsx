import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import logo from '/logo.png'

function Header({ theme = 'light', onToggleTheme, compactHome = false }) {
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const handleLogout = async () => {
    try {
      await supabase?.auth?.signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    navigate('/')
    setIsMenuOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getDashboardLink = () => {
    if (!role) return '/dashboard'
    return `/dashboard/${role}`
  }

  const canUseSellerDelivery = ['seller', 'delivery'].includes(role)

  const navItems = [
    { to: '/', label: 'Explore' },
    { to: '/about', label: 'About' },
    { to: '/cart', label: 'Cart' },
    { to: getDashboardLink(), label: 'Dashboard', protected: true },
    { to: '/dashboard/seller', label: 'Seller dashboard', sellerDelivery: true },
    { to: '/dashboard/delivery', label: 'Delivery dashboard', sellerDelivery: true },
  ]

  const filteredNavItems = navItems.filter(item => {
    if (item.protected && !user) return false
    if (item.sellerDelivery && !canUseSellerDelivery) return false
    return true
  })

  return (
    <header className={compactHome ? 'header-compact' : ''}>
      <div className="header-left">
        <Link to="/" className="brand-link" onClick={() => setIsMenuOpen(false)}>
          <img src={logo} alt="Garuga Logo" className="header-logo" />
          <h1>Garuga Marketplace</h1>
        </Link>
      </div>

      <div className="header-actions" ref={menuRef}>
        <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button 
          className={`home-menu-button ${isMenuOpen ? 'active' : ''}`} 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {isMenuOpen && (
          <div className="home-menu-panel">
            <div className="menu-header">
              {user ? (
                <div className="menu-user-profile">
                  <div className="menu-avatar">
                    {(profile?.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="menu-user-details">
                    <span className="menu-user-name">{profile?.name || 'User'}</span>
                    <span className="menu-user-role">{role || 'Buyer'}</span>
                  </div>
                </div>
              ) : (
                <p className="menu-welcome">Welcome to Garuga Marketplace</p>
              )}
            </div>

            <div className="menu-links">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) => `home-menu-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
              
            </div>

            <div className="menu-footer">
              {user ? (
                <button onClick={handleLogout} className="menu-logout-btn">
                  Sign Out
                </button>
              ) : (
                <Link to="/login" onClick={() => setIsMenuOpen(false)} className="btn-primary menu-login-btn">
                  Sign In / Join
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
