import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ShopTrustBadge from '../components/ShopTrustBadge'
import { useAuth } from '../contexts/AuthContext'
import { getPublicShopByCodeOrId, listShopProducts, startMarketplaceConversation } from '../services/supabaseMarketplace'
import { addCartItem, getCartCount, readCart, writeCart } from '../utils/cart'
import { withTimeout } from '../utils/async'
import { formatMoney, getSellerLanguage } from '../utils/marketplace'

function getDefaultDeliveryCategory(shop, product) {
  if (product?.details?.needsTruck || shop?.businessCategory === 'hardware') return 'truck'
  return 'boda'
}

function ShopProductPage() {
  const { shopId, productId } = useParams()
  const { user, profile, role } = useAuth()
  const [shop, setShop] = useState(null)
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [cartCount, setCartCount] = useState(() => getCartCount(readCart()))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadProduct = async () => {
      setLoading(true)
      setError('')

      try {
        const nextShop = await getPublicShopByCodeOrId(shopId)
        const products = nextShop ? await withTimeout(listShopProducts(nextShop.id), 10000, 'Could not load shop listings.') : []
        const nextProduct = products.find((item) => item.id === productId)

        if (!active) return
        setShop(nextShop)
        setProduct(nextProduct || null)
        setRelated(products.filter((item) => item.id !== productId && item.available !== false).slice(0, 6))
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load this listing.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProduct()

    return () => {
      active = false
    }
  }, [productId, shopId])

  const labels = getSellerLanguage(shop?.businessCategory)
  const shopClosed = Boolean(shop?.settings?.shopClosed)

  const handleAddToCart = () => {
    if (!shop || !product || shopClosed) return

    const nextCart = addCartItem(readCart(), {
      shopId: shop.id,
      shopName: shop.name,
      sellerId: shop.ownerId,
      productId: product.id,
      name: product.name,
      price: Number(product.price || 0),
      quantity,
      deliveryCategory: getDefaultDeliveryCategory(shop, product),
    })
    writeCart(nextCart)
    setCartCount(getCartCount(nextCart))
    setMessage(`${product.name} added to cart.`)
  }

  const handleChatSeller = async () => {
    if (!shop || !product) return
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (shop.ownerId === user.id) {
      setMessage('This is your own shop listing.')
      return
    }

    try {
      const conversation = await startMarketplaceConversation({
        buyerId: user.id,
        sellerId: shop.ownerId,
        shopId: shop.id,
        productId: product.id,
        productSnapshot: {
          name: product.name,
          price: product.price,
          photoURL: product.photoURL,
          negotiable: product.negotiable,
          shopName: shop.name,
          url: `/shop/${shop.shopCode || shop.id}/product/${product.id}`,
        },
        openingMessage: `Hi, I am interested in ${product.name}. Is it still available${product.negotiable ? ' and can we negotiate?' : '?'}`,
        senderName: profile?.name || user.email || 'Garuga buyer',
        senderRole: role || 'buyer',
      })
      window.location.href = `/chats/${conversation.id}`
    } catch (chatError) {
      console.error(chatError)
      setError(chatError.message || 'Could not start chat.')
    }
  }

  if (loading) return <p className="empty-message">Loading listing...</p>

  if (error || !shop || !product) {
    return (
      <div className="market-dashboard">
        <section className="market-panel">
          <h3>Listing unavailable</h3>
          <p className="market-muted">{error || 'This listing could not be found.'}</p>
          <Link to={`/shop/${shopId}`} className="btn-primary">Back to shop</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="market-dashboard shop-product-page">
      <header className="dashboard-header shop-product-header">
        <div className="dashboard-title-row">
          <Link to={`/shop/${shop.shopCode || shop.id}`} className="btn-back" aria-label="Back to shop">←</Link>
          <div>
            <h2>{product.name}</h2>
            <p>{shop.name} / {shop.shopCode || 'Local shop'} / {labels.itemSingular}</p>
            <ShopTrustBadge status={shop.verificationStatus} />
          </div>
          <Link to={user ? '/dashboard/buyer/cart' : '/cart'} className="btn-primary">Cart ({cartCount})</Link>
        </div>
      </header>

      {message ? <p className="market-muted">{message}</p> : null}

      <section className="product-detail-layout shop-product-layout">
        <div className="product-detail-left shop-product-media-card">
          <div className="shop-product-shop-strip">
            <span>{shop.businessCategoryLabel || 'Local shop'}</span>
            <strong>{shop.name}</strong>
            <ShopTrustBadge status={shop.verificationStatus} />
          </div>
          {product.photoURL ? (
            <img src={product.photoURL} alt={product.name} className="product-main-photo" />
          ) : (
            <div className="product-main-photo-placeholder">No photo</div>
          )}
        </div>

        <div className="product-detail-right">
          <section className="product-info-card shop-product-info-card">
            <p className="market-eyebrow">{labels.buyerAction}</p>
            <h1 className="product-title">{product.name}</h1>
            <p className="product-price">{formatMoney(product.price)}</p>
            {product.negotiable ? <p className="negotiable-pill">Negotiable / chat before ordering</p> : null}
            <p>{product.description || 'No description provided.'}</p>
            {shopClosed ? (
              <p className="admin-error">{shop.settings?.shopClosedMessage || 'This shop is closed for now.'}</p>
            ) : null}

            <label>
              Quantity
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))} />
            </label>

            <div className="market-actions">
              <button className="btn-primary" type="button" onClick={handleAddToCart} disabled={shopClosed}>
                Add to cart
              </button>
              <button className="btn-back" type="button" onClick={handleChatSeller} disabled={shop.ownerId === user?.id}>
                Chat seller
              </button>
              <Link to={`/shop/${shop.shopCode || shop.id}`} className="btn-back">More from shop</Link>
            </div>
          </section>
        </div>
      </section>

      <section className="market-panel shop-related-panel">
        <h3>More from {shop.name}</h3>
        <div className="menu-grid">
          {related.map((item) => (
            <Link key={item.id} to={`/shop/${shop.shopCode || shop.id}/product/${item.id}`} className="menu-card">
              {item.photoURL ? <img src={item.photoURL} alt={item.name} /> : <div className="menu-photo">No photo</div>}
              <div>
                <h3>{item.name}</h3>
                <p>{item.description || 'No description'}</p>
                <strong>{formatMoney(item.price)}</strong>
              </div>
            </Link>
          ))}
          {related.length === 0 ? <p className="market-muted">No other listings yet.</p> : null}
        </div>
      </section>
    </div>
  )
}

export default ShopProductPage
