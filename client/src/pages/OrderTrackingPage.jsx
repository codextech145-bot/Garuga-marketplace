import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link, useParams } from 'react-router-dom'
import OrderChat from '../components/OrderChat'
import { useAuth } from '../contexts/AuthContext'
import { createReport, getPublicShopByCodeOrId, subscribeToOrder, updateOrder } from '../services/supabaseMarketplace'
import { formatMoney, ORDER_STATUS } from '../utils/marketplace'
import logo from '/logo.png'

function OrderTrackingPage() {
  const { orderId } = useParams()
  const { user, profile } = useAuth()
  const [order, setOrder] = useState(null)
  const [shop, setShop] = useState(null)
  const [error, setError] = useState('')
  const [buyerFeeInput, setBuyerFeeInput] = useState('')
  const [reportCategory, setReportCategory] = useState('fraud')
  const [reportMessage, setReportMessage] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    try {
      unsubscribe = subscribeToOrder(
        orderId,
        (nextOrder) => {
          if (!active) return
          setError('')
          setOrder(nextOrder)
        },
        (loadError) => {
          console.error(loadError)
          if (active) setError('Could not load this order. Check that you are logged in with the right account.')
        }
      )
    } catch (loadError) {
      console.error(loadError)
      window.setTimeout(() => {
        if (active) setError('Could not load this order. Check that you are logged in with the right account.')
      }, 0)
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [orderId])

  useEffect(() => {
    if (!order?.shopId) return
    getPublicShopByCodeOrId(order.shopId).then(setShop).catch(() => setShop(null))
  }, [order?.shopId])

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return

    mapRef.current = L.map(mapElementRef.current).setView([0.3156, 32.5811], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current)
  }, [])

  useEffect(() => {
    const location = order?.deliveryLocation
    if (!location || !mapRef.current) return

    const latLng = [location.lat, location.lng]
    if (!markerRef.current) {
      markerRef.current = L.marker(latLng).addTo(mapRef.current)
    } else {
      markerRef.current.setLatLng(latLng)
    }
    mapRef.current.setView(latLng, 15)
  }, [order?.deliveryLocation])

  if (!order && error) {
    return (
      <div className="market-dashboard">
        <section className="market-panel">
          <h3>Order unavailable</h3>
          <p className="admin-error">{error}</p>
          <Link to="/dashboard/buyer" className="btn-primary">Buyer dashboard</Link>
        </section>
      </div>
    )
  }

  if (!order) {
    return <p className="empty-message">Loading order...</p>
  }

  const receiptDate = order.deliveryConfirmedAt || order.updatedAt || order.createdAt
  const deliveryFeeOffer = order.deliveryFeeOffer || {}

  const acceptDeliveryFee = async () => {
    await updateOrder(order.id, {
      delivery_fee_status: 'accepted',
      delivery_fee_offer: {
        ...deliveryFeeOffer,
        acceptedBy: 'buyer',
        message: `${order.buyerName} accepted the delivery fee.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
  }

  const counterDeliveryFee = async () => {
    const amount = Number(buyerFeeInput || 0)
    if (!amount || amount < 500) {
      setError('Enter a fair counter offer first.')
      return
    }

    setError('')
    await updateOrder(order.id, {
      delivery_fee_status: 'buyer_countered',
      delivery_fee_offer: {
        ...deliveryFeeOffer,
        buyerAmount: amount,
        message: `${order.buyerName} suggested ${formatMoney(amount)} for delivery.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    setBuyerFeeInput('')
  }

  const waitForAnotherDelivery = async () => {
    await updateOrder(order.id, {
      status: 'accepted',
      delivery_id: null,
      delivery_name: '',
      delivery_location: null,
      delivery_fee: 0,
      delivery_fee_status: 'waiting_new_delivery',
      delivery_fee_offer: {
        ...deliveryFeeOffer,
        message: `${order.buyerName} chose to wait for another delivery person.`,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (!user?.id) {
      setReportStatus('Log in to report a problem.')
      return
    }

    setReportStatus('Sending report...')
    try {
      await createReport({
        reporter_id: user.id,
        order_id: order.id,
        shop_id: order.shopId,
        reported_user_id: order.sellerId,
        category: reportCategory,
        message: reportMessage.trim() || `Buyer reported ${reportCategory.replaceAll('_', ' ')} on this order.`,
      })
      await updateOrder(order.id, {
        admin_status: 'review',
        risk_flags: [...(order.riskFlags || []), { type: reportCategory, by: user.id, at: new Date().toISOString() }],
      })
      setReportMessage('')
      setReportStatus('Report sent to Garuga admin.')
    } catch (reportError) {
      console.error(reportError)
      setReportStatus('Could not send report. Try again after refreshing.')
    }
  }

  return (
    <div className="market-dashboard">
      <section className="market-hero-panel">
        <div>
          <p className="market-eyebrow">Order tracking</p>
          <h2>{ORDER_STATUS[order.status] || order.status}</h2>
          <p>{order.items?.map((item) => item.name).join(', ')} / {formatMoney(order.total)}</p>
        </div>
        <Link to="/dashboard/buyer" className="btn-back">Buyer dashboard</Link>
      </section>

      <section className="market-panel">
        <h3>Delivery location</h3>
        {order.fulfillmentType === 'delivery' ? (
          <div className="delivery-fee-chat buyer-delivery-fee-chat">
            <strong>Delivery fee agreement</strong>
            {order.deliveryFeeStatus === 'accepted' ? (
              <p className="market-muted">Deal closed: {formatMoney(order.deliveryFee)} delivery fee agreed.</p>
            ) : order.deliveryFeeStatus === 'pending_buyer' ? (
              <>
                <p className="market-muted">
                  {order.deliveryName || 'Delivery partner'} requested <strong>{formatMoney(order.deliveryFee)}</strong>.
                </p>
                <div className="market-actions">
                  <button className="btn-primary" type="button" onClick={acceptDeliveryFee}>Accept fee</button>
                </div>
                <label>
                  Counter offer
                  <input
                    inputMode="numeric"
                    value={buyerFeeInput}
                    onChange={(event) => setBuyerFeeInput(event.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 2500"
                  />
                  <button className="btn-back" type="button" onClick={counterDeliveryFee}>Send counter offer</button>
                </label>
              </>
            ) : order.deliveryFeeStatus === 'buyer_countered' ? (
              <p className="market-muted">Waiting for delivery person to accept {formatMoney(deliveryFeeOffer.buyerAmount)}.</p>
            ) : order.deliveryFeeStatus === 'rejected' ? (
              <>
                <p className="market-muted">Delivery person rejected your counter. You can accept {formatMoney(order.deliveryFee)} or wait for another delivery person.</p>
                <div className="market-actions">
                  <button className="btn-primary" type="button" onClick={acceptDeliveryFee}>Accept original fee</button>
                  <button className="btn-back" type="button" onClick={waitForAnotherDelivery}>Wait for another delivery</button>
                </div>
              </>
            ) : order.deliveryFeeStatus === 'waiting_new_delivery' ? (
              <p className="market-muted">Waiting for another delivery person to claim this order.</p>
            ) : (
              <p className="market-muted">Delivery fee will appear here after a delivery person claims the order.</p>
            )}
          </div>
        ) : null}
        {order.deliveryConfirmationCode ? (
          <div className="delivery-code-card">
            <span>
              {order.fulfillmentType === 'pickup'
                ? 'Show this code to the seller when you reach the shop'
                : 'Give this code to the delivery person when the order reaches you'}
            </span>
            <strong>{order.deliveryConfirmationCode}</strong>
          </div>
        ) : null}
        <div ref={mapElementRef} className="delivery-map" />
        {!order.deliveryLocation ? <p className="market-muted">Location appears after a delivery partner claims the order.</p> : null}
      </section>

      <OrderChat
        order={order}
        user={user}
        profile={profile}
        role="buyer"
        title="Chat with seller and delivery"
        helperText="Use this for directions, pickup time, availability, and delivery updates."
      />

      <section className="market-panel order-report-panel">
        <h3>Report a problem</h3>
        <p className="market-muted">Use this if the seller, pickup, item, or delivery looks suspicious. Admin can hold the order and review it.</p>
        <form className="order-report-form" onSubmit={submitReport}>
          <label>
            Problem type
            <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>
              <option value="fraud">Fraud or fake listing</option>
              <option value="wrong_item">Wrong item</option>
              <option value="no_show">No show</option>
              <option value="abuse">Abuse or unsafe behavior</option>
              <option value="payment">Payment problem</option>
              <option value="delivery">Delivery problem</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Message
            <textarea value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} rows="3" placeholder="Tell admin what happened..." />
          </label>
          <button className="btn-danger" type="submit">Send report</button>
        </form>
        {reportStatus ? <p className="admin-hint">{reportStatus}</p> : null}
      </section>

      {order.status === 'delivered' ? (
        <section className="market-panel receipt-panel">
          <div className="receipt-document">
            <div className="receipt-header">
              <img src={logo} alt="Garuga Marketplace" />
              <div>
                <h3>Garuga Marketplace</h3>
                <p>Official buyer receipt</p>
              </div>
            </div>
            <div className="receipt-meta">
              <span>Receipt No.</span><strong>{order.id.slice(0, 8).toUpperCase()}</strong>
              <span>Shop</span><strong>{shop?.name || order.shopId}</strong>
              <span>Shop No.</span><strong>{shop?.shopCode || order.shopId.slice(0, 8)}</strong>
              <span>Buyer</span><strong>{order.buyerName}</strong>
              <span>Date</span><strong>{receiptDate ? new Date(receiptDate).toLocaleString() : '--'}</strong>
            </div>
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td>{item.name || item.requestText}</td>
                    <td>{item.quantity || 1}</td>
                    <td>{formatMoney(item.price)}</td>
                    <td>{formatMoney(Number(item.price || 0) * Number(item.quantity || 1))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total">
              <span>Items total</span>
              <strong>{formatMoney(order.total)}</strong>
            </div>
            <div className="receipt-total">
              <span>Delivery fee</span>
              <strong>{formatMoney(order.deliveryFee)}</strong>
            </div>
            <div className="receipt-total">
              <span>Grand total</span>
              <strong>{formatMoney(Number(order.total || 0) + Number(order.deliveryFee || 0))}</strong>
            </div>
            <p className="receipt-note">Thank you for using Garuga Marketplace. Keep this softcopy for your records.</p>
          </div>
          <button className="btn-primary receipt-print-button" onClick={() => window.print()}>
            Save receipt as PDF
          </button>
        </section>
      ) : null}
    </div>
  )
}

export default OrderTrackingPage
