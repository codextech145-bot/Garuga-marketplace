import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { createOrder, listPublicShops } from '../../services/supabaseMarketplace'
import { createCartBatchId, getCartCount, readCart, writeCart, getCartTotal } from '../../utils/cart'
import { DELIVERY_CATEGORIES, formatMoney, getDeliveryCategory } from '../../utils/marketplace'

function createDeliveryConfirmationCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function BuyerCart() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [cart, setCart] = useState(() => readCart())
  const [shops, setShops] = useState([])
  const [buyerData, setBuyerData] = useState({
    buyerName: profile?.name || '',
    buyerPhone: profile?.phone || '',
    buyerAddress: '',
    fulfillmentType: 'delivery',
    deliveryCategory: 'boda',
    buyerNote: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [createdOrderId, setCreatedOrderId] = useState('')

  useEffect(() => {
    writeCart(cart)
  }, [cart])

  useEffect(() => {
    setBuyerData((current) => ({
      ...current,
      buyerName: current.buyerName || profile?.name || '',
      buyerPhone: current.buyerPhone || profile?.phone || '',
    }))
  }, [profile?.name, profile?.phone])

  useEffect(() => {
    listPublicShops().then(setShops).catch((error) => console.error(error))
  }, [])

  const cartTotal = useMemo(() => getCartTotal(cart), [cart])
  const cartItemCount = useMemo(() => getCartCount(cart), [cart])
  const groupedCart = useMemo(() => {
    return cart.reduce((groups, item) => {
      if (!groups[item.shopId]) groups[item.shopId] = []
      groups[item.shopId].push(item)
      return groups
    }, {})
  }, [cart])

  const shopSummaries = useMemo(() => {
    return Object.entries(groupedCart).map(([shopId, items]) => ({
      shopId,
      shopName: items[0]?.shopName || 'Shop',
      itemCount: getCartCount(items),
      subtotal: getCartTotal(items),
      items,
    }))
  }, [groupedCart])

  const cartShopIds = useMemo(() => new Set(cart.map((item) => item.shopId)), [cart])
  const shopCount = shopSummaries.length

  const updateQuantity = (index, value) => {
    const safeQuantity = Math.max(1, Number(value || 1))
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity: safeQuantity } : item)))
  }

  const adjustQuantity = (index, change) => {
    setCart((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + change) }
          : item
      )
    )
  }

  const removeItem = (index) => {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const clearCart = () => {
    setCart([])
    setMessage('Cart cleared.')
    setMessageType('ok')
  }

  const handleBuyerChange = (event) => {
    const { name, value } = event.target
    setBuyerData((current) => ({ ...current, [name]: value }))
  }

  const submitOrders = async (event) => {
    event.preventDefault()
    if (!cart.length || !user) return

    setSubmitting(true)
    setMessage('')
    setCreatedOrderId('')

    try {
      const createdOrders = []
      const cartBatchId = createCartBatchId()
      const bookingCode = createDeliveryConfirmationCode()

      for (const [shopId, items] of Object.entries(groupedCart)) {
        const firstItem = items[0]
        const order = await createOrder({
          buyer_id: user.id,
          shop_id: shopId,
          seller_id: firstItem.sellerId,
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            lineTotal: Number(item.price || 0) * Number(item.quantity || 1),
            buyerNote: buyerData.buyerNote.trim(),
            cartBatchId,
            cartBatchSize: cart.length,
            cartBatchShopCount: shopCount,
          })),
          total: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0),
          status: 'pending',
          fulfillment_type: buyerData.fulfillmentType,
          delivery_category:
            buyerData.fulfillmentType === 'delivery' ? buyerData.deliveryCategory || firstItem.deliveryCategory || 'boda' : 'boda',
          delivery_confirmation_code: bookingCode,
          buyer_name: buyerData.buyerName.trim(),
          buyer_phone: buyerData.buyerPhone.trim(),
          buyer_address:
            buyerData.fulfillmentType === 'delivery'
              ? buyerData.buyerAddress.trim()
              : `Pickup at ${firstItem.shopName}`,
        })
        createdOrders.push(order)
      }

      setCart([])
      setCreatedOrderId(createdOrders[0]?.id || '')
      setMessage('Orders sent. Each shop received only its own items, and delivery will be handled as one cart trip.')
      setMessageType('ok')
    } catch (error) {
      console.error(error)
      setMessage('Could not send cart orders. Please try again.')
      setMessageType('err')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to={user ? '/dashboard/buyer' : '/'} className="btn-back" aria-label="Back">←</Link>
          <div>
            <h2>Cart</h2>
            <p>Review items by shop, then sign in only when you are ready to checkout.</p>
          </div>
          {user ? <DashboardNav role="buyer" compact /> : <Link to="/login" state={{ from: location }} className="btn-primary">Sign in to checkout</Link>}
        </div>
      </header>

      {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}
      {createdOrderId ? <Link className="btn-primary" to={`/order/${createdOrderId}`}>Track first order</Link> : null}

      <section className="cart-pro-summary">
        <div>
          <span>Items</span>
          <strong>{cartItemCount}</strong>
        </div>
        <div>
          <span>Shops</span>
          <strong>{shopCount}</strong>
        </div>
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(cartTotal)}</strong>
        </div>
        <div>
          <span>Delivery fee</span>
          <strong>Agreed after</strong>
        </div>
      </section>

      <section className="market-panel">
        <div className="seller-feature-heading">
          <div>
            <h3>Selected items</h3>
            <p className="market-muted">Items from different shops are sent as separate orders.</p>
          </div>
          <div className="cart-header-actions">
            <strong>{formatMoney(cartTotal)}</strong>
            {cart.length ? <button className="btn-back" type="button" onClick={clearCart}>Clear cart</button> : null}
          </div>
        </div>

        <div className="cart-shop-groups">
          {cart.length === 0 ? (
            <p className="market-muted">Your cart is empty. Add items from shops below.</p>
          ) : (
            shopSummaries.map((summary) => (
              <section key={summary.shopId} className="cart-shop-card">
                <div className="cart-shop-heading">
                  <div>
                    <strong>{summary.shopName}</strong>
                    <span>{summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}</span>
                  </div>
                  <strong>{formatMoney(summary.subtotal)}</strong>
                </div>
                <div className="market-list">
                  {summary.items.map((item) => {
                    const cartIndex = cart.findIndex(
                      (cartItem) => cartItem.shopId === item.shopId && cartItem.productId === item.productId
                    )
                    const lineTotal = Number(item.price || 0) * Number(item.quantity || 1)
                    return (
                      <article key={`${item.shopId}-${item.productId}`} className="cart-row">
                        <div>
                          <strong>{item.name}</strong>
                          <p>{formatMoney(item.price)} each</p>
                          <small>Line total: {formatMoney(lineTotal)}</small>
                        </div>
                        <div className="cart-quantity-control">
                          <button type="button" onClick={() => adjustQuantity(cartIndex, -1)}>-</button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => updateQuantity(cartIndex, event.target.value)}
                          />
                          <button type="button" onClick={() => adjustQuantity(cartIndex, 1)}>+</button>
                        </div>
                        <button className="btn-back" type="button" onClick={() => removeItem(cartIndex)}>Remove</button>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      {cart.length ? (
        <section className="market-panel cart-total-panel">
          <h3>Checkout summary</h3>
          <div className="cart-total-row"><span>Products subtotal</span><strong>{formatMoney(cartTotal)}</strong></div>
          <div className="cart-total-row"><span>Delivery fee</span><strong>Seller/delivery confirms</strong></div>
          <div className="cart-total-row cart-grand-total"><span>Total products now</span><strong>{formatMoney(cartTotal)}</strong></div>
          <p className="market-muted">Delivery fee is not added yet because Garuga lets the delivery partner and buyer agree on it before the trip starts.</p>
        </section>
      ) : null}

      {cart.length && !user ? (
        <section className="market-panel">
          <h3>Ready to checkout?</h3>
          <p className="market-muted">Your cart is saved on this device. Sign in to send the order, track delivery, and receive updates.</p>
          <Link to="/login" state={{ from: location }} className="btn-primary">Sign in to send order</Link>
        </section>
      ) : null}

      {cart.length && user ? (
        <section className="market-panel">
          <h3>Order details</h3>
          <form className="market-form cart-checkout-form" onSubmit={submitOrders}>
            <label>Name<input name="buyerName" value={buyerData.buyerName} onChange={handleBuyerChange} required /></label>
            <label>Phone<input name="buyerPhone" value={buyerData.buyerPhone} onChange={handleBuyerChange} required /></label>
            <label>
              Delivery or pickup?
              <select name="fulfillmentType" value={buyerData.fulfillmentType} onChange={handleBuyerChange}>
                <option value="delivery">Bring it to me</option>
                <option value="pickup">I will come physically</option>
              </select>
            </label>
            {buyerData.fulfillmentType === 'delivery' ? (
              <>
                <label>Where should it be delivered?<textarea name="buyerAddress" value={buyerData.buyerAddress} onChange={handleBuyerChange} required rows="3" /></label>
                <label>
                  What transport is needed?
                  <select name="deliveryCategory" value={buyerData.deliveryCategory} onChange={handleBuyerChange}>
                    {DELIVERY_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                  <small className="form-hint">{getDeliveryCategory(buyerData.deliveryCategory).description}</small>
                </label>
              </>
            ) : null}
            <label>
              Note to seller or delivery person
              <textarea
                name="buyerNote"
                value={buyerData.buyerNote}
                onChange={handleBuyerChange}
                rows="3"
                placeholder="Example: Call me near the stage, or bring change."
              />
            </label>
            <button className="btn-primary" disabled={submitting}>{submitting ? 'Sending...' : `Send ${shopCount} order${shopCount === 1 ? '' : 's'} worth ${formatMoney(cartTotal)}`}</button>
          </form>
        </section>
      ) : null}

      <section className="market-panel">
        <h3>Add more from shops</h3>
        <div className="shop-grid">
          {shops.map((shop) => (
            <Link key={shop.id} to={`/shop/${shop.shopCode || shop.id}`} className="shop-card">
              <strong>{shop.name}</strong>
              <span>{shop.businessCategoryLabel || 'Local shop'}</span>
              <small>{cartShopIds.has(shop.id) ? 'Already in cart' : shop.phone || 'Open shop'}</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default BuyerCart
