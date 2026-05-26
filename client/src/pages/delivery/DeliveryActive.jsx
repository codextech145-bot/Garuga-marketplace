import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { listDeliveryOrders } from '../../services/supabaseMarketplace'
import { withTimeout } from '../../utils/async'
import { formatMoney, getDeliveryCategory, ORDER_STATUS } from '../../utils/marketplace'

function DeliveryActive() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return undefined

    let active = true

    const loadOrders = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await withTimeout(listDeliveryOrders(), 10000, 'Could not load active deliveries.')
        if (!active) return
        setOrders(data.filter((order) => order.deliveryId === user.id && order.status === 'out_for_delivery'))
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load active deliveries. Check your connection and Supabase policies.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOrders()

    return () => {
      active = false
    }
  }, [user])

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/delivery" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>Active deliveries</h2>
            <p>Continue delivery fee agreement, location sharing, and arrival confirmation from the main delivery dashboard.</p>
          </div>
          <DashboardNav role="delivery" compact />
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="market-panel">
        <div className="seller-feature-heading">
          <div>
            <h3>In progress</h3>
            <p className="market-muted">Open the full delivery dashboard to complete delivery codes and fee chat.</p>
          </div>
          <Link to="/dashboard/delivery" className="btn-primary">Open delivery tools</Link>
        </div>

        <div className="market-list">
          {loading ? (
            <p className="empty-message">Loading active deliveries...</p>
          ) : orders.length === 0 ? (
            <p className="market-muted">No active deliveries yet.</p>
          ) : (
            orders.map((order) => (
              <Link key={order.id} to="/dashboard/delivery" className="order-card order-link">
                <div>
                  <strong>{order.buyerName}</strong>
                  <p>{order.buyerPhone} / {order.buyerAddress}</p>
                  <p>{order.items?.map((item) => item.name || item.requestText).join(', ')}</p>
                  <p>Total: {formatMoney(order.total)}</p>
                  {order.deliveryFeeStatus === 'accepted' ? (
                    <p className="market-muted">Delivery fee agreed: {formatMoney(order.deliveryFee)}</p>
                  ) : (
                    <p className="market-muted">Delivery fee status: {order.deliveryFeeStatus.replaceAll('_', ' ')}</p>
                  )}
                </div>
                <div className="order-badge-stack">
                  <span className="delivery-type-badge">{getDeliveryCategory(order.deliveryCategory).shortLabel}</span>
                  <span className={`order-status status-${order.status}`}>{ORDER_STATUS[order.status] || order.status}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default DeliveryActive
