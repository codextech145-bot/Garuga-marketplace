import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardNav from '../../components/DashboardNav'
import OrderChat from '../../components/OrderChat'
import { getSellerShop, subscribeToSellerOrders, updateOrder } from '../../services/supabaseMarketplace'
import { formatMoney, getSellerLanguage, ORDER_STATUS } from '../../utils/marketplace'
import { Link } from 'react-router-dom'

function SellerOrders() {
  const { user, profile } = useAuth()
  const [shop, setShop] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [pickupCodes, setPickupCodes] = useState({})
  const [pickupError, setPickupError] = useState('')

  useEffect(() => {
    if (!user) return
    getSellerShop(user.id, profile).then(setShop).catch((error) => console.error(error))
    const unsubscribe = subscribeToSellerOrders(user.id, (nextOrders) => {
      setOrders(nextOrders)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [profile, user])
  const labels = getSellerLanguage(shop?.businessCategory)

  const updateOrderStatus = async (orderId, status) => {
    setPickupError('')
    await updateOrder(orderId, {
      status,
      updated_at: new Date().toISOString(),
    })
  }

  const handlePickupCodeChange = (orderId, value) => {
    setPickupError('')
    setPickupCodes((current) => ({ ...current, [orderId]: value.replace(/\D/g, '').slice(0, 4) }))
  }

  const confirmPickup = async (order) => {
    const enteredCode = pickupCodes[order.id] || ''
    if (order.deliveryConfirmationCode && enteredCode !== order.deliveryConfirmationCode) {
      setPickupError('Pickup code is not matching. Ask the buyer to show the 4-digit booking code.')
      return
    }

    await updateOrder(order.id, {
      status: 'delivered',
      delivery_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setPickupError('')
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/seller" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>{labels.orderLabel}</h2>
            <p>Keep track of your customer requests and fulfillment.</p>
          </div>
          <DashboardNav role="seller" sellerCategory={shop?.businessCategory} compact />
        </div>
      </header>

      {pickupError ? <p className="admin-error">{pickupError}</p> : null}

      <section className="market-panel">
        <div className="market-list">
          {loading ? (
            <p className="empty-message">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="empty-message">No orders found.</p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className="order-card">
                <div className="order-info">
                  <div className="order-buyer">
                    <strong>{order.buyerName}</strong>
                    <span className="order-phone">{order.buyerPhone}</span>
                  </div>
                  <p className="order-address">
                    {order.fulfillmentType === 'pickup' ? '🏪 Pickup at shop' : `📍 ${order.buyerAddress}`}
                  </p>
                  <div className="order-items">
                    {order.items?.map((item, idx) => (
                      <span key={idx} className="order-item-tag">{item.name} x {item.quantity || 1}</span>
                    ))}
                  </div>
                  <p className="order-total">Total: <strong>{formatMoney(order.total)}</strong></p>
                  {order.fulfillmentType === 'delivery' && order.deliveryConfirmationCode ? (
                    <p className="delivery-code-box">Delivery backup code: <span>{order.deliveryConfirmationCode}</span></p>
                  ) : null}
                  {order.fulfillmentType === 'pickup' && order.deliveryConfirmationCode ? (
                    <p className="market-muted">Ask the buyer for their 4-digit pickup code before handing over items.</p>
                  ) : null}
                </div>
                
                <div className="order-actions-container">
                  <span className={`order-status status-${order.status}`}>
                    {ORDER_STATUS[order.status] || order.status}
                  </span>
                  
                  {order.status === 'pending' && (
                    <div className="market-actions">
                      <button className="btn-primary" onClick={() => updateOrderStatus(order.id, 'accepted')}>Accept</button>
                      <button className="btn-danger" onClick={() => updateOrderStatus(order.id, 'rejected')}>Reject</button>
                    </div>
                  )}
                  
                  {order.status === 'accepted' && order.fulfillmentType === 'pickup' && (
                    <div className="pickup-confirm-box">
                      <label>
                        Buyer pickup code
                        <input
                          inputMode="numeric"
                          value={pickupCodes[order.id] || ''}
                          onChange={(event) => handlePickupCodeChange(order.id, event.target.value)}
                          placeholder="4 digits"
                        />
                      </label>
                      <button className="btn-primary" type="button" onClick={() => confirmPickup(order)}>Confirm pickup</button>
                    </div>
                  )}

                  {order.status === 'accepted' && order.fulfillmentType !== 'pickup' && (
                    <div className="market-actions">
                      <button className="btn-primary" onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}>Out for Delivery</button>
                    </div>
                  )}
                </div>
                <OrderChat
                  order={order}
                  user={user}
                  profile={profile}
                  role="seller"
                  title="Customer chat"
                  helperText="Confirm stock, pickup time, substitutions, or special requests."
                />
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default SellerOrders
