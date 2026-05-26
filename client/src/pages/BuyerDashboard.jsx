import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../components/DashboardNav'
import { useAuth } from '../contexts/AuthContext'
import { listPublicShops, savePushSubscription, signOutSupabase, subscribeToBuyerOrders } from '../services/supabaseMarketplace'
import { formatMoney, ORDER_STATUS } from '../utils/marketplace'
import { getNotificationPermission, showOrderNotification, subscribeToPushNotifications } from '../utils/pwa'
import { withTimeout } from '../utils/async'
import { getCartCount, readCart } from '../utils/cart'

function BuyerDashboard() {
  const { user, profile } = useAuth()
  const [shops, setShops] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [cartCount, setCartCount] = useState(() => getCartCount(readCart()))
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission())
  const orderStatusRef = useRef(new Map())

  useEffect(() => {
    let active = true
    const loadShops = async () => {
      try {
        const nextShops = await withTimeout(listPublicShops(), 10000, 'Could not load shops. Supabase did not respond.')
        if (active) setShops(nextShops)
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load shops.')
      }
    }

    loadShops()
    const unsubscribeOrders = subscribeToBuyerOrders(user.id, (nextOrders) => {
      if (!active) return
      const previousStatuses = orderStatusRef.current
      const changedOrder = nextOrders.find((order) => {
        const previousStatus = previousStatuses.get(order.id)
        return previousStatus && previousStatus !== order.status
      })
      nextOrders.forEach((order) => previousStatuses.set(order.id, order.status))
      setOrders(nextOrders)

      if (changedOrder && notificationPermission === 'granted') {
        showOrderNotification({
          title: 'Your order was updated',
          body: `Order is now ${ORDER_STATUS[changedOrder.status] || changedOrder.status}.`,
          url: `/order/${changedOrder.id}`,
          tag: `buyer-order-${changedOrder.id}`,
        })
      }
    })

    return () => {
      active = false
      unsubscribeOrders()
    }
  }, [notificationPermission, user.id])

  const handleNotificationClick = async () => {
    const permission = await subscribeToPushNotifications((subscription) =>
      savePushSubscription({ userId: user.id, role: profile?.role, subscription })
    )
    setNotificationPermission(permission)
  }

  useEffect(() => {
    const updateCartCount = () => setCartCount(getCartCount(readCart()))
    window.addEventListener('storage', updateCartCount)
    window.addEventListener('focus', updateCartCount)
    return () => {
      window.removeEventListener('storage', updateCartCount)
      window.removeEventListener('focus', updateCartCount)
    }
  }, [])

  return (
    <div className="market-dashboard">
      <section className="market-hero-panel">
        <div>
          <p className="market-eyebrow">Buyer Dashboard</p>
          <h2>Welcome, {profile?.name || 'buyer'}</h2>
          <p>Browse shops, order items, and track delivery status in realtime.</p>
        </div>
        <div className="market-actions">
          {notificationPermission === 'default' ? (
            <button className="home-notify-button" type="button" onClick={handleNotificationClick}>
              Notify me
            </button>
          ) : null}
          <Link to="/dashboard/buyer/cart" className="btn-primary">Cart ({cartCount})</Link>
          <DashboardNav role="buyer" compact />
          <button className="btn-back" onClick={signOutSupabase}>Sign out</button>
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="market-grid-two">
        <section className="market-panel">
          <h3>Shops</h3>
          <div className="shop-grid">
            {shops.map((shop) => (
              <Link key={shop.id} to={`/shop/${shop.shopCode || shop.id}`} className="shop-card">
                <strong>{shop.name}</strong>
                {shop.shopCode ? <span>{shop.shopCode}</span> : null}
                <span>{shop.phone || 'No phone'}</span>
                <small>{shop.email}</small>
              </Link>
            ))}
            {shops.length === 0 ? <p className="market-muted">No shops yet.</p> : null}
          </div>
        </section>

        <section className="market-panel">
          <h3>Your orders</h3>
          <div className="market-list">
            {orders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="order-card order-link">
                <div>
                  <strong>{order.items?.map((item) => item.name).join(', ')}</strong>
                  <p>{formatMoney(order.total)}</p>
                </div>
                <span className={`order-status status-${order.status}`}>{ORDER_STATUS[order.status] || order.status}</span>
              </Link>
            ))}
            {orders.length === 0 ? <p className="market-muted">No orders yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

export default BuyerDashboard
