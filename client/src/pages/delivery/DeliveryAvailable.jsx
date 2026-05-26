import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { listDeliveryOrders, updateOrder } from '../../services/supabaseMarketplace'
import { withTimeout } from '../../utils/async'
import { formatMoney, getDeliveryCategory, ORDER_STATUS } from '../../utils/marketplace'
import { getOrderBatchId } from '../../utils/cart'

function DeliveryAvailable() {
  const { user, profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setMessage('')

    try {
      const data = await withTimeout(listDeliveryOrders(), 10000, 'Could not load delivery orders.')
      const allowedCategories = profile?.deliveryCategories?.length ? profile.deliveryCategories : ['all']
      setOrders(data.filter((order) => {
        if (order.fulfillmentType === 'pickup') return false
        if (order.status !== 'accepted') return false
        if (order.deliveryId && order.deliveryId !== user.id) return false
        if (allowedCategories.includes('all')) return true
        return allowedCategories.includes(order.deliveryCategory || 'boda')
      }))
    } catch (error) {
      console.error(error)
      setMessage('Could not load available deliveries. Check your connection and Supabase policies.')
      setMessageType('err')
    } finally {
      setLoading(false)
    }
  }, [profile?.deliveryCategories, user])

  useEffect(() => {
    if (!user) return
    loadOrders()
  }, [loadOrders, user])

  const claimOrder = async (orderId) => {
    setMessage('')
    try {
      const order = orders.find((item) => item.id === orderId)
      const batchId = getOrderBatchId(order)
      const batchOrders = batchId ? orders.filter((item) => getOrderBatchId(item) === batchId) : [order]

      await Promise.all(batchOrders.filter(Boolean).map((batchOrder) => updateOrder(batchOrder.id, {
        status: 'out_for_delivery',
        delivery_id: user.id,
        delivery_name: profile?.name || '',
        updated_at: new Date().toISOString(),
      })))
      setMessage(batchId ? 'Cart delivery group claimed. Open Active deliveries to continue.' : 'Delivery claimed. Open Active deliveries to continue.')
      setMessageType('ok')
      await loadOrders()
    } catch (error) {
      console.error(error)
      setMessage('Could not claim this delivery.')
      setMessageType('err')
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/delivery" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>Available deliveries</h2>
            <p>Pick accepted orders that match your delivery category.</p>
          </div>
          <DashboardNav role="delivery" compact />
        </div>
      </header>

      {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}

      <section className="market-panel">
        <div className="market-list">
          {loading ? (
            <p className="empty-message">Loading available deliveries...</p>
          ) : orders.length === 0 ? (
            <p className="market-muted">No available deliveries right now.</p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className="order-card">
                <div>
                  <strong>{order.buyerName}</strong>
                  {getOrderBatchId(order) ? <p className="market-muted">Cart delivery group / one rider should collect all matching orders.</p> : null}
                  <p>{order.buyerPhone} / {order.buyerAddress}</p>
                  <p>{order.items?.map((item) => item.name || item.requestText).join(', ')}</p>
                  <p>Total: {formatMoney(order.total)}</p>
                </div>
                <div className="order-badge-stack">
                  <span className="delivery-type-badge">{getDeliveryCategory(order.deliveryCategory).shortLabel}</span>
                  <span className={`order-status status-${order.status}`}>{ORDER_STATUS[order.status] || order.status}</span>
                </div>
                <button className="btn-primary" type="button" onClick={() => claimOrder(order.id)}>Claim delivery</button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default DeliveryAvailable
