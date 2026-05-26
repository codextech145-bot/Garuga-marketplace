import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getSellerLanguage } from '../utils/marketplace'

const NAV_LINKS = {
  seller: [
    { to: '/dashboard/seller', label: 'Dashboard' },
    { to: '/dashboard/seller/orders', label: 'Orders' },
    { to: '/dashboard/seller/inventory', label: 'My products' },
    { to: '/dashboard/seller/settings', label: 'Shop settings' },
  ],
  buyer: [
    { to: '/dashboard/buyer', label: 'Dashboard' },
    { to: '/dashboard/buyer/cart', label: 'Cart' },
    { to: '/dashboard/buyer/shops', label: 'Shops' },
    { to: '/dashboard/buyer/orders', label: 'Orders' },
  ],
  delivery: [
    { to: '/dashboard/delivery', label: 'Dashboard' },
    { to: '/dashboard/delivery/available', label: 'Available' },
    { to: '/dashboard/delivery/active', label: 'Active' },
  ],
}

function DashboardNav({ role = 'buyer', title, subtitle, compact = false, sellerCategory = '' }) {
  const [open, setOpen] = useState(false)
  const links = useMemo(() => {
    if (role !== 'seller') return NAV_LINKS[role] || NAV_LINKS.buyer
    const labels = getSellerLanguage(sellerCategory)
    return NAV_LINKS.seller.map((link) =>
      link.to === '/dashboard/seller/inventory' ? { ...link, label: labels.collection } : link
    )
  }, [role, sellerCategory])

  const menuButton = (
    <>
      <button
        type="button"
        className={`dashboard-menu-button ${open ? 'active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Open dashboard menu"
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <nav className="dashboard-menu-panel" aria-label={`${role} dashboard navigation`}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === `/dashboard/${role}`}
              className={({ isActive }) => `dashboard-menu-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </>
  )

  if (compact) {
    return <div className="dashboard-nav-compact">{menuButton}</div>
  }

  return (
    <section className="dashboard-nav-shell">
      <div className="dashboard-nav-copy">
        <p className="market-eyebrow">{title || `${role} menu`}</p>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {menuButton}
    </section>
  )
}

export default DashboardNav
