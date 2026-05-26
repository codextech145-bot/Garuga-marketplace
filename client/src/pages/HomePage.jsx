import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import ShopTrustBadge from '../components/ShopTrustBadge'
import { listItems, listPublicShops } from '../services/supabaseMarketplace'
import { withTimeout } from '../utils/async'
import { getCartCount, readCart } from '../utils/cart'
import { showProductNotification } from '../utils/pwa'

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Vehicles', label: 'Vehicles' },
  { value: 'Home & Garden', label: 'Home & Garden' },
  { value: 'Property', label: 'Property' },
  { value: 'Clothing', label: 'Fashion' },
  { value: 'Services', label: 'Services' },
  { value: 'Kids & Babies', label: 'Kids & Babies' },
  { value: 'Food', label: 'Food' },
  { value: 'Other', label: 'Other' },
]

const CATEGORY_ICONS = {
  all: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  Electronics: (
    <>
      <path d="M7 5h10v14H7z" />
      <path d="M10 17h4" />
      <path d="M9 8h6" />
    </>
  ),
  Clothing: (
    <>
      <path d="M8 6 5 9l3 3v8h8v-8l3-3-3-3" />
      <path d="M9 6a3 3 0 0 0 6 0" />
    </>
  ),
  'Kids & Babies': (
    <>
      <path d="M9 11a3 3 0 0 1 6 0v2a3 3 0 0 1-6 0v-2Z" />
      <path d="M8 17c1.2 1.8 6.8 1.8 8 0" />
      <path d="M10 10h.1" />
      <path d="M14 10h.1" />
      <path d="M12 4v3" />
    </>
  ),
  Property: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 10v10h11V10" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  Food: (
    <>
      <path d="M7 4v8" />
      <path d="M4.5 4v4.5A2.5 2.5 0 0 0 7 11a2.5 2.5 0 0 0 2.5-2.5V4" />
      <path d="M7 12v8" />
      <path d="M15 4v16" />
      <path d="M15 4c3 1.6 4.5 4.2 4 7h-4" />
    </>
  ),
  'Home & Garden': (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 10v10h11V10" />
      <path d="M9.5 20v-6h5v6" />
      <path d="M17 18c2-1 3-2.6 3-5" />
    </>
  ),
  Vehicles: (
    <>
      <path d="M5 12h14l-1.5-4.5h-11L5 12Z" />
      <path d="M4 12v5h16v-5" />
      <path d="M7 17.5h.1" />
      <path d="M17 17.5h.1" />
    </>
  ),
  Animals: (
    <>
      <path d="M8 13c-1.5 0-2.5 1-2.5 2.3S6.5 18 8 18c1.2 0 2-.8 4-.8s2.8.8 4 .8c1.5 0 2.5-1.4 2.5-2.7S17.5 13 16 13" />
      <path d="M8 10h.1" />
      <path d="M16 10h.1" />
      <path d="M11 8h.1" />
      <path d="M13 8h.1" />
    </>
  ),
  Services: (
    <>
      <path d="M14.5 5.5a4 4 0 0 0 4 4l-8.8 8.8a2.1 2.1 0 0 1-3-3l8.8-8.8Z" />
      <path d="M7.5 16.5h.1" />
    </>
  ),
  Other: (
    <>
      <path d="M5 12h.1" />
      <path d="M12 12h.1" />
      <path d="M19 12h.1" />
    </>
  ),
}

function CategoryIcon({ category }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {CATEGORY_ICONS[category] || CATEGORY_ICONS.Other}
    </svg>
  )
}

function HomePage() {
  const [items, setItems] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [cartCount, setCartCount] = useState(() => getCartCount(readCart()))
  const [cartButtonPosition, setCartButtonPosition] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('garuga-cart-button-position') || '{}')
      return {
        x: Number.isFinite(saved.x) ? saved.x : null,
        y: Number.isFinite(saved.y) ? saved.y : null,
      }
    } catch {
      return { x: null, y: null }
    }
  })
  const dragRef = useRef({ dragging: false, moved: false, offsetX: 0, offsetY: 0 })
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    try {
      return window.sessionStorage.getItem('garuga_admin_unlocked') === '1'
    } catch {
      return false
    }
  })
  const firstSnapshotRef = useRef(true)

  useEffect(() => {
    const updateCartCount = () => setCartCount(getCartCount(readCart()))
    window.addEventListener('storage', updateCartCount)
    window.addEventListener('focus', updateCartCount)
    return () => {
      window.removeEventListener('storage', updateCartCount)
      window.removeEventListener('focus', updateCartCount)
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadItems = async () => {
      try {
        const itemsData = await withTimeout(listItems(), 10000, 'Could not load items. Supabase did not respond.')
        if (!active) return
        setItems(itemsData)
        setLoadError('')
        setLoading(false)

        const newestItem = firstSnapshotRef.current ? null : itemsData[0]
        firstSnapshotRef.current = false
        if (newestItem) {
          showProductNotification(newestItem).catch((error) => {
            console.error('Error showing product notification:', error)
          })
        }
      } catch (error) {
        console.error('Error loading items:', error)
        if (active) {
          setLoadError(error.message || 'Could not load items.')
          setLoading(false)
        }
      }
    }

    loadItems()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadShops = async () => {
      try {
        const nextShops = await withTimeout(listPublicShops(), 10000, 'Could not load shops. Supabase did not respond.')
        if (active) setShops(nextShops)
      } catch (error) {
        console.error('Error loading shops:', error)
      }
    }

    loadShops()

    return () => {
      active = false
    }
  }, [])

  const filteredItems = items.filter((item) => {
    const name = String(item.productName || '').toLowerCase()
    const matchesSearch = name.includes(searchTerm.toLowerCase())
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const filteredShops = shops.filter((shop) => {
    const text = `${shop.name || ''} ${shop.businessCategoryLabel || ''} ${shop.shopCode || ''}`.toLowerCase()
    return text.includes(searchTerm.toLowerCase())
  })

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const showAdminUnlock = ['admin', 'garuga admin', 'admin panel', 'adminpanel'].some((key) =>
    normalizedSearch.includes(key)
  )

  const handleSearchChange = (event) => {
    const nextSearch = event.target.value
    setSearchTerm(nextSearch)

    const nextNormalizedSearch = nextSearch.trim().toLowerCase()
    const shouldUnlockAdmin = ['admin', 'garuga admin', 'admin panel', 'adminpanel'].some((key) =>
      nextNormalizedSearch.includes(key)
    )

    if (shouldUnlockAdmin) {
      setAdminUnlocked(true)
      try {
        window.sessionStorage.setItem('garuga_admin_unlocked', '1')
      } catch {
        // Ignore session storage failures.
      }
    }
  }

  const handleCartPointerDown = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      dragging: true,
      moved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleCartPointerMove = (event) => {
    if (!dragRef.current.dragging) return
    const buttonSize = 82
    const padding = 10
    const nextX = Math.min(Math.max(padding, event.clientX - dragRef.current.offsetX), window.innerWidth - buttonSize - padding)
    const nextY = Math.min(Math.max(padding, event.clientY - dragRef.current.offsetY), window.innerHeight - buttonSize - padding)
    dragRef.current.moved = true
    dragRef.current.x = nextX
    dragRef.current.y = nextY
    setCartButtonPosition({ x: nextX, y: nextY })
  }

  const handleCartPointerUp = () => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    try {
      window.localStorage.setItem(
        'garuga-cart-button-position',
        JSON.stringify({ x: dragRef.current.x ?? cartButtonPosition.x, y: dragRef.current.y ?? cartButtonPosition.y })
      )
    } catch {
      // Ignore storage failures.
    }
  }

  const handleCartClick = (event) => {
    if (dragRef.current.moved) {
      event.preventDefault()
      dragRef.current.moved = false
    }
  }

  const cartButtonStyle =
    cartButtonPosition.x === null || cartButtonPosition.y === null
      ? undefined
      : { left: `${cartButtonPosition.x}px`, top: `${cartButtonPosition.y}px`, right: 'auto', bottom: 'auto' }

  return (
    <>
      <Link
        to="/cart"
        className="floating-cart-button"
        style={cartButtonStyle}
        onPointerDown={handleCartPointerDown}
        onPointerMove={handleCartPointerMove}
        onPointerUp={handleCartPointerUp}
        onClick={handleCartClick}
        aria-label={`Open cart with ${cartCount} items`}
      >
        <span className="floating-cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M7 18.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM4.2 4H2.5a1 1 0 0 1 0-2h2.4c.5 0 .9.3 1 .8l.6 2.2h14a1 1 0 0 1 1 1.2l-1.6 7a2.7 2.7 0 0 1-2.7 2.1H8a2.7 2.7 0 0 1-2.6-2L4.2 4Zm2.9 3 .9 5.8c.1.3.4.5.7.5h8.5c.3 0 .6-.2.7-.5L19 7H7.1Z" />
          </svg>
        </span>
        <strong>{cartCount}</strong>
      </Link>

      <section className="garuga-home-shell">
        <div className="garuga-simple-hero">
          <p>Buy and sell items in Garuga quickly and safely.</p>
          <h2>
            Find Great <span>Deals</span>
            <br />
            Around You
          </h2>
          <div className="garuga-hero-search">
            <input
              type="text"
              id="searchInput"
              placeholder="What are you looking for?"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <button type="button" onClick={() => document.getElementById('itemsContainer')?.scrollIntoView({ behavior: 'smooth' })}>
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="garuga-category-section">
        <div className="home-section-heading">
          <h2>Browse Categories</h2>
          <button type="button" onClick={() => setActiveCategory('all')}>View all</button>
        </div>
        <div id="categoryFilter" className="category-filter garuga-category-grid">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`category-btn garuga-category-tile ${activeCategory === cat.value ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.value)}
            >
              <span><CategoryIcon category={cat.value} /></span>
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      <section className="garuga-shops-section">
        <div className="home-section-heading">
          <h2>Local Shops</h2>
          <Link to="/signup">Open shop</Link>
        </div>
        <div className="garuga-shop-strip">
          {filteredShops.slice(0, 8).map((shop) => (
            <Link key={shop.id} to={`/shop/${shop.shopCode || shop.id}`} className="garuga-shop-tile">
              <ShopTrustBadge status={shop.verificationStatus} />
              <strong>{shop.name || 'Garuga Shop'}</strong>
              <span>{shop.shopCode || shop.businessCategoryLabel || 'Local shop'}</span>
              <small>{shop.settings?.shopClosed ? 'Closed now' : 'View products'}</small>
            </Link>
          ))}
          {shops.length === 0 ? (
            <Link to="/signup" className="garuga-shop-tile garuga-shop-empty">
              <strong>Start a shop</strong>
              <span>Be among the first sellers</span>
              <small>Post for free</small>
            </Link>
          ) : null}
        </div>
      </section>

      {showAdminUnlock || adminUnlocked ? (
        <section className="admin-unlock-strip">
          <Link to="/admin" className="admin-unlock-link">
            Open Admin Panel
          </Link>
        </section>
      ) : null}

      <div className="home-section-heading garuga-listing-heading">
        <h2>Featured Listings</h2>
        <Link to="/signup">Post item</Link>
      </div>
      <div id="itemsContainer" className="items-grid">
        {loading ? (
          <p className="empty-message">Loading items...</p>
        ) : loadError ? (
          <p className="error-message">{loadError}</p>
        ) : filteredItems.length === 0 ? (
          <p className="empty-message">
            {items.length === 0 ? 'No items yet. Be the first to sell!' : 'No items match your search.'}
          </p>
        ) : (
          filteredItems.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </>
  )
}

export default HomePage
