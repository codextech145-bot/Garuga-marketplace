import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../components/DashboardNav'
import OrderChat from '../components/OrderChat'
import { useAuth } from '../contexts/AuthContext'
import { savePushSubscription, signOutSupabase, subscribeToDeliveryOrders, updateOrder } from '../services/supabaseMarketplace'
import { formatMoney, getDeliveryCategory, ORDER_STATUS } from '../utils/marketplace'
import { getNotificationPermission, showOrderNotification, subscribeToPushNotifications } from '../utils/pwa'
import { getOrderBatchId } from '../utils/cart'

function DeliveryDashboard() {
  const { user, profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [activeOrderId, setActiveOrderId] = useState('')
  const [confirmationCodes, setConfirmationCodes] = useState({})
  const [confirmationError, setConfirmationError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [deliveryFeeInputs, setDeliveryFeeInputs] = useState({})
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission())
  const knownOrderIdsRef = useState(() => new Set())[0]
  const deliveryStats = useMemo(() => {
    const myOrders = orders.filter((order) => order.deliveryId === user.id)
    const agreedOrders = myOrders.filter((order) => order.deliveryFeeStatus === 'accepted')
    return {
      active: myOrders.filter((order) => order.status === 'out_for_delivery').length,
      completed: myOrders.filter((order) => order.status === 'delivered').length,
      earnings: agreedOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0),
    }
  }, [orders, user.id])

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeToDeliveryOrders((nextOrders) => {
      if (!active) return
      const allowedCategories = profile?.deliveryCategories?.length ? profile.deliveryCategories : ['all']
      const deliverableOrders = nextOrders.filter((order) => {
        if (order.fulfillmentType === 'pickup') return false
        if (allowedCategories.includes('all')) return true
        return allowedCategories.includes(order.deliveryCategory || 'boda')
      })
      const newOrder = deliverableOrders.find((order) => !knownOrderIdsRef.has(order.id))
      deliverableOrders.forEach((order) => knownOrderIdsRef.add(order.id))
      setOrders(deliverableOrders)

      if (newOrder && notificationPermission === 'granted') {
        showOrderNotification({
          title: 'Delivery order available',
          body: `${newOrder.buyerName} needs delivery for ${newOrder.items?.map((item) => item.name).join(', ') || 'an order'}.`,
          url: '/dashboard/delivery',
          tag: `delivery-order-${newOrder.id}`,
        })
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [knownOrderIdsRef, notificationPermission, profile?.deliveryCategories])

  const handleNotificationClick = async () => {
    const permission = await subscribeToPushNotifications((subscription) =>
      savePushSubscription({ userId: user.id, role: profile?.role, subscription })
    )
    setNotificationPermission(permission)
  }

  useEffect(() => {
    if (!activeOrderId) return undefined

    const intervalId = window.setInterval(() => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported on this device.')
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setLocationError('')
          await updateOrder(activeOrderId, {
            delivery_location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              updatedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
        },
        () => setLocationError('Could not read your location. Allow browser location access.')
      )
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [activeOrderId])

  const claimOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId)
    const batchId = getOrderBatchId(order)
    const batchOrders = batchId ? orders.filter((item) => getOrderBatchId(item) === batchId) : [order]

    await Promise.all(batchOrders.filter(Boolean).map((batchOrder) => updateOrder(batchOrder.id, {
      status: 'out_for_delivery',
      delivery_id: user.id,
      delivery_name: profile?.name || '',
      updated_at: new Date().toISOString(),
    })))
    setActiveOrderId(orderId)
  }

  const handleConfirmationCodeChange = (orderId, value) => {
    setConfirmationError('')
    setConfirmationCodes((current) => ({ ...current, [orderId]: value.replace(/\D/g, '').slice(0, 4) }))
  }

  const markDelivered = async (order) => {
    if (order.fulfillmentType === 'delivery' && order.deliveryFeeStatus !== 'accepted') {
      setConfirmationError('Agree on the delivery fee with the buyer before completing delivery.')
      return
    }

    const enteredCode = confirmationCodes[order.id] || ''
    if (order.deliveryConfirmationCode && enteredCode !== order.deliveryConfirmationCode) {
      setConfirmationError('That delivery code is not matching. Ask the buyer or seller for the 4-digit code.')
      return
    }

    await updateOrder(order.id, {
      status: 'delivered',
      delivery_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (activeOrderId === order.id) {
      setActiveOrderId('')
    }
    setConfirmationError('')
  }

  const handleDeliveryFeeChange = (orderId, value) => {
    setDeliveryFeeInputs((current) => ({ ...current, [orderId]: value.replace(/\D/g, '') }))
  }

  const proposeDeliveryFee = async (order) => {
    const amount = Number(deliveryFeeInputs[order.id] || 0)
    if (!amount || amount < 500) {
      setConfirmationError('Enter a fair delivery fee first.')
      return
    }

    const batchId = getOrderBatchId(order)
    const batchOrders = batchId ? orders.filter((item) => getOrderBatchId(item) === batchId && item.deliveryId === user.id) : [order]
    await Promise.all(batchOrders.map((batchOrder) => updateOrder(batchOrder.id, {
      delivery_fee: amount,
      delivery_fee_status: 'pending_buyer',
      delivery_fee_offer: {
        ...(batchOrder.deliveryFeeOffer || {}),
        deliveryAmount: amount,
        deliveryName: profile?.name || '',
        deliveryId: user.id,
        message: `${profile?.name || 'Delivery partner'} requested ${formatMoney(amount)} for ${batchId ? 'the cart delivery' : 'delivery'}.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })))
    setConfirmationError('')
  }

  const acceptBuyerCounter = async (order) => {
    const amount = Number(order.deliveryFeeOffer?.buyerAmount || 0)
    await updateOrder(order.id, {
      delivery_fee: amount,
      delivery_fee_status: 'accepted',
      delivery_fee_offer: {
        ...(order.deliveryFeeOffer || {}),
        acceptedBy: 'delivery',
        message: `${profile?.name || 'Delivery partner'} accepted the buyer delivery fee.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
  }

  const rejectBuyerCounter = async (order) => {
    await updateOrder(order.id, {
      delivery_fee_status: 'rejected',
      delivery_fee_offer: {
        ...(order.deliveryFeeOffer || {}),
        rejectedBy: 'delivery',
        message: `${profile?.name || 'Delivery partner'} rejected the counter offer.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="market-dashboard">
      <section className="market-hero-panel">
        <div>
          <p className="market-eyebrow">Delivery Dashboard</p>
          <h2>Accepted orders</h2>
          <p>Claim an order, then your location is shared every 5 seconds until delivery.</p>
        </div>
        <div className="market-actions">
          {notificationPermission === 'default' ? (
            <button className="home-notify-button" type="button" onClick={handleNotificationClick}>
              Notify me
            </button>
          ) : null}
          <Link to="/dashboard/seller" className="btn-back">Seller</Link>
          <DashboardNav role="delivery" compact />
          <button className="btn-back" onClick={signOutSupabase}>Sign out</button>
        </div>
      </section>

      {locationError ? <p className="admin-error">{locationError}</p> : null}
      {confirmationError ? <p className="admin-error">{confirmationError}</p> : null}

      <section className="local-shop-helper delivery-category-summary">
        <strong>Your delivery type</strong>
        {(profile?.deliveryCategories?.length ? profile.deliveryCategories : ['all']).map((categoryId) => (
          <span key={categoryId}>{getDeliveryCategory(categoryId).label}</span>
        ))}
        <small>Only matching delivery bookings will show here, unless you selected all.</small>
      </section>

      <section className="market-stats">
        <div><span>Active jobs</span><strong>{deliveryStats.active}</strong></div>
        <div><span>Completed</span><strong>{deliveryStats.completed}</strong></div>
        <div><span>Delivery earnings</span><strong>{formatMoney(deliveryStats.earnings)}</strong></div>
      </section>

      <section className="market-panel">
        <div className="market-list">
          {orders.map((order) => {
            const claimedByOther = order.deliveryId && order.deliveryId !== user.id
            return (
              <article key={order.id} className="order-card">
                <div>
                  <strong>{order.buyerName}</strong>
                  {getOrderBatchId(order) ? <p className="market-muted">Cart delivery group: one delivery fee can cover the grouped shop orders.</p> : null}
                  <p>{order.buyerPhone} / {order.buyerAddress}</p>
                  <p>{order.items?.map((item) => item.name).join(', ')}</p>
                  <p>Total: {formatMoney(order.total)}</p>
                </div>
                <div className="order-badge-stack">
                  <span className="delivery-type-badge">{getDeliveryCategory(order.deliveryCategory).shortLabel}</span>
                  <span className={`order-status status-${order.status}`}>{ORDER_STATUS[order.status] || order.status}</span>
                </div>
                <div className="market-actions">
                  {order.status === 'accepted' ? (
                    <button className="btn-primary" onClick={() => claimOrder(order.id)} disabled={claimedByOther}>
                      {claimedByOther ? 'Claimed' : 'Claim order'}
                    </button>
                  ) : null}
                  {order.deliveryId === user.id && order.status === 'out_for_delivery' ? (
                    <div className="delivery-confirm-box">
                      <OrderChat
                        order={order}
                        user={user}
                        profile={profile}
                        role="delivery"
                        title="Delivery chat"
                        helperText="Ask for directions, pickup notes, or arrival updates."
                      />
                      <div className="delivery-fee-chat">
                        <strong>Delivery fee chat</strong>
                        {order.deliveryFeeStatus === 'accepted' ? (
                          <p className="market-muted">Deal closed: {formatMoney(order.deliveryFee)} delivery fee agreed.</p>
                        ) : order.deliveryFeeStatus === 'buyer_countered' ? (
                          <>
                            <p className="market-muted">Buyer suggested <strong>{formatMoney(order.deliveryFeeOffer?.buyerAmount)}</strong>.</p>
                            <div className="market-actions">
                              <button className="btn-primary" type="button" onClick={() => acceptBuyerCounter(order)}>Accept fee</button>
                              <button className="btn-danger" type="button" onClick={() => rejectBuyerCounter(order)}>Reject</button>
                            </div>
                          </>
                        ) : order.deliveryFeeStatus === 'pending_buyer' ? (
                          <p className="market-muted">Waiting for buyer to accept or counter {formatMoney(order.deliveryFee)}.</p>
                        ) : order.deliveryFeeStatus === 'rejected' ? (
                          <p className="market-muted">Counter rejected. Wait for buyer to accept original fee or release the order.</p>
                        ) : (
                          <label>
                            Your delivery fee
                            <input
                              inputMode="numeric"
                              value={deliveryFeeInputs[order.id] || ''}
                              onChange={(event) => handleDeliveryFeeChange(order.id, event.target.value)}
                              placeholder="e.g. 3000"
                            />
                            <button className="btn-primary" type="button" onClick={() => proposeDeliveryFee(order)}>Send fee to buyer</button>
                          </label>
                        )}
                      </div>
                      <label>
                        Arrival code
                        <input
                          inputMode="numeric"
                          value={confirmationCodes[order.id] || ''}
                          onChange={(event) => handleConfirmationCodeChange(order.id, event.target.value)}
                          placeholder="4 digits"
                        />
                      </label>
                      <button className="btn-primary" onClick={() => markDelivered(order)}>Reached buyer</button>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
          {orders.length === 0 ? <p className="market-muted">No accepted orders match your delivery category yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

export default DeliveryDashboard
