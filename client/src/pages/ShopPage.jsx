import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ShopTrustBadge from '../components/ShopTrustBadge'
import { useAuth } from '../contexts/AuthContext'
import { createOrder, getPublicShopByCodeOrId, listShopProducts, startMarketplaceConversation } from '../services/supabaseMarketplace'
import { DELIVERY_CATEGORIES, formatMoney, getDeliveryCategory, getSellerLanguage } from '../utils/marketplace'
import { withTimeout } from '../utils/async'
import { addCartItem, getCartCount, readCart, writeCart } from '../utils/cart'

function getDefaultDeliveryCategory(shop, product) {
  if (product?.details?.needsTruck || shop?.businessCategory === 'hardware') return 'truck'
  return 'boda'
}

function createDeliveryConfirmationCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function ShopPage() {
  const { shopId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [requestingCustom, setRequestingCustom] = useState(false)
  const [buyerData, setBuyerData] = useState({
    buyerName: profile?.name || '',
    buyerPhone: profile?.phone || '',
    buyerAddress: '',
    fulfillmentType: 'delivery',
    deliveryCategory: 'boda',
  })
  const [customRequest, setCustomRequest] = useState('')
  const [cardQuantities, setCardQuantities] = useState({})
  const [cartCount, setCartCount] = useState(() => getCartCount(readCart()))
  const [quantity, setQuantity] = useState(1)
  const [orderId, setOrderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setBuyerData((current) => ({
      ...current,
      buyerName: current.buyerName || profile?.name || '',
      buyerPhone: current.buyerPhone || profile?.phone || '',
    }))
  }, [profile?.name, profile?.phone])

  useEffect(() => {
    let active = true

    const loadShop = async () => {
      try {
        const nextShop = await getPublicShopByCodeOrId(shopId)
        const nextProducts = nextShop ? await withTimeout(listShopProducts(nextShop.id), 10000, 'Could not load shop products.') : []
        if (!active) return
        setShop(nextShop)
        setProducts(nextProducts)
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load this shop.')
      }
    }

    loadShop()

    return () => {
      active = false
    }
  }, [shopId])

  const availableProducts = useMemo(() => products.filter((product) => product.available !== false), [products])
  const isFoodShop = shop?.businessCategory === 'food'
  const isServiceShop = shop?.businessCategory === 'services'
  const labels = getSellerLanguage(shop?.businessCategory)
  const shopClosed = Boolean(shop?.settings?.shopClosed)
  const loginState = { from: location }
  const handleBuyerChange = (event) => {
    const { name, value } = event.target
    setBuyerData((current) => ({ ...current, [name]: value }))
  }

  const addToCart = (product, amount = 1) => {
    if (!shop || !product || shopClosed) return
    const safeQuantity = Math.max(1, Number(amount || 1))
    const nextCart = addCartItem(readCart(), {
      shopId: shop.id,
      shopName: shop.name,
      sellerId: shop.ownerId,
      productId: product.id,
      name: product.name,
      price: Number(product.price || 0),
      quantity: safeQuantity,
      deliveryCategory: getDefaultDeliveryCategory(shop, product),
    })
    writeCart(nextCart)
    setCartCount(getCartCount(nextCart))
    setCardQuantities((current) => ({ ...current, [product.id]: 1 }))
  }

  const handleTalkToShop = async () => {
    if (!shop) return
    if (!user) {
      navigate('/login')
      return
    }
    if (shop.ownerId === user.id) {
      setError('This is your own shop.')
      return
    }

    try {
      const conversation = await startMarketplaceConversation({
        buyerId: user.id,
        sellerId: shop.ownerId,
        shopId: shop.id,
        productSnapshot: {
          name: shop.name,
          shopName: shop.name,
          category: shop.businessCategoryLabel,
          url: `/shop/${shop.shopCode || shop.id}`,
        },
        openingMessage: `Hi ${shop.name}, I want to ask about your shop.`,
        senderName: profile?.name || user.email || 'Garuga buyer',
        senderRole: role || 'buyer',
      })
      navigate(`/chats/${conversation.id}`)
    } catch (chatError) {
      console.error(chatError)
      setError(chatError.message || 'Could not start shop chat.')
    }
  }

  const updateCardQuantity = (productId, value) => {
    setCardQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, Number(value || 1)),
    }))
  }

  const submitOrder = async (event) => {
    event.preventDefault()
    if ((!selected && !requestingCustom) || !shop || !user || shopClosed) return

    setSubmitting(true)
    setError('')
    try {
      const isCustomRequest = requestingCustom && !selected
      const requestText = customRequest.trim()
      const order = await createOrder({
        buyer_id: user.id,
        shop_id: shop.id,
        seller_id: shop.ownerId,
        items: [
          isCustomRequest
            ? {
                requestText,
                name: `Request: ${requestText.slice(0, 60)}`,
                category: shop.businessCategoryLabel || shop.businessCategory || 'Shop request',
                price: 0,
                quantity: 1,
              }
            : {
                productId: selected.id,
                name: selected.name,
                price: Number(selected.price || 0),
                quantity: Math.max(1, Number(quantity || 1)),
              },
        ],
        total: isCustomRequest ? 0 : Number(selected.price || 0) * Math.max(1, Number(quantity || 1)),
        status: 'pending',
        fulfillment_type: buyerData.fulfillmentType,
        delivery_category:
          buyerData.fulfillmentType === 'delivery'
            ? buyerData.deliveryCategory || getDefaultDeliveryCategory(shop, selected)
            : 'boda',
        delivery_confirmation_code: createDeliveryConfirmationCode(),
        buyer_name: buyerData.buyerName.trim(),
        buyer_phone: buyerData.buyerPhone.trim(),
        buyer_address:
          buyerData.fulfillmentType === 'delivery'
            ? buyerData.buyerAddress.trim()
            : `Pickup at ${shop.name}`,
      })
      setOrderId(order.id)
      setSelected(null)
      setRequestingCustom(false)
      setCustomRequest('')
    } catch (orderError) {
      console.error(orderError)
      setError('Could not place order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`market-dashboard ${isFoodShop ? 'local-restaurant-page' : ''}`}>
      <section className="market-hero-panel shop-booking-hero">
        <div>
          <p className="market-eyebrow">{isFoodShop ? 'Local food booking' : isServiceShop ? 'Service booking' : 'Shop booking'}</p>
          {shop ? <ShopTrustBadge status={shop.verificationStatus} /> : null}
          <h2>{shop?.name || 'Shop'}</h2>
          <p>
            {isFoodShop
              ? 'Tap food, choose delivery or pickup, then the seller confirms your booking.'
              : isServiceShop
                ? 'Choose a service, share what you need, and the provider confirms availability.'
              : 'Choose what you need, then book delivery or pickup at the shop.'}
          </p>
          <div className="shop-contact-row">
            <span>{shop?.phone || 'No phone listed'}</span>
            {shop?.location ? <span>{shop.location}</span> : null}
            {shop?.phone ? <a className="btn-back" href={`tel:${shop.phone}`}>Call shop</a> : null}
            <button className="btn-back" type="button" onClick={handleTalkToShop} disabled={!shop || shop.ownerId === user?.id}>
              Talk to shop
            </button>
          </div>
        </div>
        <Link to={user ? '/dashboard/buyer' : '/'} className="btn-back">
          {user ? 'Buyer dashboard' : 'Home'}
        </Link>
        <Link to={user ? '/dashboard/buyer/cart' : '/cart'} className="btn-primary">Cart ({cartCount})</Link>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      {shopClosed ? (
        <section className="market-panel shop-closed-panel">
          <h3>Shop closed for now</h3>
          <p className="market-muted">
            {shop?.settings?.shopClosedMessage || 'This seller is not taking orders at the moment. Please check again later.'}
          </p>
          {shop?.phone ? <a className="btn-primary" href={`tel:${shop.phone}`}>Call shop</a> : null}
        </section>
      ) : null}

      {orderId ? (
        <section className="market-panel">
            <h3>{isServiceShop ? 'Request sent' : 'Booking sent'}</h3>
            <p className="market-muted">The seller has received it and will confirm soon.</p>
          <Link className="btn-primary" to={`/order/${orderId}`}>Track order</Link>
        </section>
      ) : null}

      {isFoodShop ? (
        <section className="local-shop-helper">
          <strong>How it works</strong>
          <span>1. Tap a meal</span>
          <span>2. Choose delivery or pickup</span>
          <span>3. Wait for confirmation</span>
        </section>
      ) : null}

      <section className="menu-grid">
        <article className="menu-card request-card">
          <div>
            <h3>{labels.requestLabel}</h3>
            <p>Ask {shop?.name || 'this shop'} for something that is not listed yet.</p>
            {!shopClosed ? (
              <button
                type="button"
                className="menu-card-action"
                onClick={() => {
                  setSelected(null)
                  setRequestingCustom(true)
                }}
              >
                {labels.requestLabel}
              </button>
            ) : null}
          </div>
        </article>
        {availableProducts.map((product) => (
          <Link
            key={product.id}
            to={`/shop/${shop.shopCode || shop.id}/product/${product.id}`}
            className="menu-card"
          >
            {product.photoURL ? <img src={product.photoURL} alt={product.name} /> : <div className="menu-photo">No photo</div>}
            <div>
              <h3>{product.name}</h3>
              <p>{product.description || 'No description'}</p>
              <strong>{formatMoney(product.price)}</strong>
              <label className="menu-card-quantity" onClick={(event) => event.stopPropagation()}>
                Qty
                <input
                  type="number"
                  min="1"
                  value={cardQuantities[product.id] || 1}
                  onChange={(event) => updateCardQuantity(product.id, event.target.value)}
                />
              </label>
              <div className="menu-card-actions">
                <button type="button" className="menu-card-action">
                  View
                </button>
                {!shopClosed ? (
                  <button
                    type="button"
                    className="menu-card-action"
                    onClick={(event) => {
                      event.stopPropagation()
                      addToCart(product, cardQuantities[product.id] || 1)
                    }}
                  >
                  {isServiceShop ? 'Request' : 'Add'}
                  </button>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </section>

      {selected ? (
        <section className="market-panel order-panel">
          <h3>{labels.buyerAction} {selected.name}</h3>
          {!user ? (
            <div className="market-actions">
              <p className="market-muted">You can browse shops freely. Sign in when you are ready to order, request, or track delivery.</p>
              <Link to="/login" state={loginState} className="btn-primary">Sign in to continue</Link>
              <button type="button" className="btn-back" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          ) : (
          <form className="market-form" onSubmit={submitOrder}>
            <label>Name<input name="buyerName" value={buyerData.buyerName} onChange={handleBuyerChange} required /></label>
            <label>Phone<input name="buyerPhone" value={buyerData.buyerPhone} onChange={handleBuyerChange} required /></label>
            <label>
              Delivery or pickup?
              <select name="fulfillmentType" value={buyerData.fulfillmentType} onChange={handleBuyerChange}>
                <option value="delivery">{isServiceShop ? 'Provider comes to me' : 'Bring it to me'}</option>
                <option value="pickup">{isServiceShop ? 'I will visit the provider' : 'I will come physically'}</option>
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
            ) : (
              <p className="market-muted">This is just a booking. You will come physically and pick it from {shop?.name || 'the shop'}.</p>
            )}
            <p>{isServiceShop ? 'Starting price' : 'Total'}: <strong>{formatMoney(selected.price)}</strong></p>
            <label>
              Quantity
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} />
            </label>
            <div className="market-actions">
              {!isServiceShop ? <button type="button" className="btn-primary" onClick={() => addToCart(selected, 1)}>Add to cart</button> : null}
              <button className="btn-primary" disabled={submitting}>{submitting ? 'Sending...' : isServiceShop ? 'Send service request' : 'Send booking now'}</button>
              <button type="button" className="btn-back" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          </form>
          )}
        </section>
      ) : null}

      {requestingCustom ? (
        <section className="market-panel order-panel">
          <h3>{labels.requestLabel}</h3>
          {!user ? (
            <div className="market-actions">
              <p className="market-muted">Sign in to send requests to this seller.</p>
              <Link to="/login" state={loginState} className="btn-primary">Sign in to continue</Link>
              <button type="button" className="btn-back" onClick={() => setRequestingCustom(false)}>Cancel</button>
            </div>
          ) : (
          <form className="market-form" onSubmit={submitOrder}>
            <label>
              What do you need?
              <textarea
                value={customRequest}
                onChange={(event) => setCustomRequest(event.target.value)}
                required
                rows="4"
                placeholder="Example: I need a 13kg gas regulator, or a blue school sweater size 8."
              />
            </label>
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
            <p className="market-muted">The seller will reply by phone and confirm price before accepting.</p>
            <div className="market-actions">
              <button className="btn-primary" disabled={submitting}>{submitting ? 'Sending...' : 'Send request'}</button>
              <button type="button" className="btn-back" onClick={() => setRequestingCustom(false)}>Cancel</button>
            </div>
          </form>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default ShopPage
