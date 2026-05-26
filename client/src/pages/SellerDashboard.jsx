import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../components/DashboardNav'
import { useAuth } from '../contexts/AuthContext'
import { BUSINESS_CATEGORIES, formatMoney, getSellerLanguage, getTodayStart } from '../utils/marketplace'
import { getNotificationPermission, showOrderNotification, subscribeToPushNotifications } from '../utils/pwa'
import { withTimeout } from '../utils/async'
import {
  getSellerShop,
  listShopProducts,
  savePushSubscription,
  signOutSupabase,
  subscribeToSellerOrders,
  updateSellerShop,
} from '../services/supabaseMarketplace'

function SellerDashboard() {
  const { user, profile } = useAuth()
  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [shopLoading, setShopLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission())
  const knownOrderIdsRef = useRef(new Set())

  useEffect(() => {
    if (!user) return undefined

    let active = true
    let unsubscribeOrders = () => {}

    const loadSellerData = async () => {
      setShopLoading(true)
      setMessage('')

      try {
        const nextShop = await withTimeout(getSellerShop(user.id, profile), 10000, 'Could not load seller shop.')
        const nextProducts = nextShop?.id
          ? await withTimeout(listShopProducts(nextShop.id), 10000, 'Could not load products.')
          : []

        if (!active) return
        setShop(nextShop)
        setProducts(nextProducts)
        setShopLoading(false)

        unsubscribeOrders = subscribeToSellerOrders(user.id, (nextOrders) => {
          if (!active) return
          const knownOrderIds = knownOrderIdsRef.current
          const newOrder = nextOrders.find((order) => !knownOrderIds.has(order.id))
          nextOrders.forEach((order) => knownOrderIds.add(order.id))
          setOrders(nextOrders)

          if (newOrder && notificationPermission === 'granted') {
            showOrderNotification({
              title: 'New order request',
              body: `${newOrder.buyerName} ordered ${newOrder.items?.map((item) => item.name).join(', ') || 'an item'}.`,
              url: '/dashboard/seller/orders',
              tag: `seller-order-${newOrder.id}`,
            })
          }
        })
      } catch (error) {
        console.error(error)
        if (active) {
          setMessage('Could not load seller dashboard. Check Supabase setup and RLS policies.')
          setMessageType('err')
          setShopLoading(false)
        }
      }
    }

    loadSellerData()

    return () => {
      active = false
      unsubscribeOrders()
    }
  }, [notificationPermission, profile, user])

  const handleNotificationClick = async () => {
    const permission = await subscribeToPushNotifications((subscription) =>
      savePushSubscription({ userId: user.id, role: profile?.role, subscription })
    )
    setNotificationPermission(permission)
  }

  const handleCategorySetup = async (category) => {
    const updatedShop = await updateSellerShop(shop.id, {
      name: profile?.name || 'Garuga Shop',
      phone: profile?.phone || '',
      email: profile?.email || '',
      business_category: category.id,
      business_category_label: category.label,
      business_features: category.features,
      setup_complete: true,
      updated_at: new Date().toISOString(),
    })
    setShop(updatedShop)
  }

  const stats = useMemo(() => {
    const paidOrders = orders.filter((order) => ['accepted', 'out_for_delivery', 'delivered'].includes(order.status))
    const todayStart = getTodayStart()

    return {
      totalOrders: orders.length,
      totalRevenue: paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      ordersToday: orders.filter((order) => new Date(order.createdAt || 0) >= todayStart).length,
      products: products.length,
    }
  }, [orders, products.length])
  const labels = getSellerLanguage(shop?.businessCategory)

  if (shopLoading) {
    return <p className="empty-message">Loading seller dashboard...</p>
  }

  if (!shop?.businessCategory) {
    return (
      <div className="market-dashboard">
        <section className="market-hero-panel">
          <div>
            <p className="market-eyebrow">Seller setup</p>
            <h2>Choose your business category</h2>
            <p>Pick one category first so Garuga can prepare the right product fields for your shop.</p>
          </div>
          <div className="market-actions">
            <DashboardNav role="seller" sellerCategory={shop?.businessCategory} compact />
            <button className="btn-back" onClick={signOutSupabase}>Sign out</button>
          </div>
        </section>

        {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}

        <section className="business-category-grid">
          {BUSINESS_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className="business-category-card"
              onClick={() => handleCategorySetup(category)}
            >
              <strong>{category.label}</strong>
              <span>{category.description}</span>
              <small>{category.features.join(' / ')}</small>
            </button>
          ))}
        </section>
      </div>
    )
  }

  return (
    <div className="market-dashboard">
      <section className="market-hero-panel">
        <div>
          <p className="market-eyebrow">Seller Dashboard</p>
          <h2>{shop.name || profile?.name || 'Your shop'}</h2>
          <p>{labels.dashboardCopy}</p>
          {shop.shopCode ? <p className="market-muted">Shop code: <strong>{shop.shopCode}</strong></p> : null}
        </div>
        <div className="market-actions">
          <Link to="/dashboard/seller/products/new" className="btn-primary">{labels.addItem}</Link>
          {notificationPermission === 'default' ? (
            <button className="home-notify-button" type="button" onClick={handleNotificationClick}>
              Notify me
            </button>
          ) : null}
          <Link to="/dashboard/delivery" className="btn-back">Delivery</Link>
          <DashboardNav role="seller" sellerCategory={shop?.businessCategory} compact />
          <button className="btn-back" onClick={signOutSupabase}>Sign out</button>
        </div>
      </section>

      {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}

      <section className="market-stats">
        <div><span>Total {labels.orderLabel.toLowerCase()}</span><strong>{stats.totalOrders}</strong></div>
        <div><span>Total revenue</span><strong>{formatMoney(stats.totalRevenue)}</strong></div>
        <div><span>{labels.collectionShort}</span><strong>{stats.products}</strong></div>
      </section>

      <section className="dashboard-section-grid">
        <Link to="/dashboard/seller/orders" className="dashboard-section-card">
          <strong>{labels.orderLabel}</strong>
          <span>Accept, reject, and follow customer requests.</span>
        </Link>
        <Link to="/dashboard/seller/inventory" className="dashboard-section-card">
          <strong>{labels.collection}</strong>
          <span>Add or edit {labels.itemPlural}, update prices, and hide unavailable listings.</span>
        </Link>
        <Link to="/dashboard/seller/settings" className="dashboard-section-card">
          <strong>Shop settings</strong>
          <span>Edit shop information, location, and category features.</span>
        </Link>
      </section>
    </div>
  )
}

export default SellerDashboard
