import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import { useAuth } from '../contexts/AuthContext'
import { getItem, listRelatedItems, startMarketplaceConversation } from '../services/supabaseMarketplace'
import { withTimeout } from '../utils/async'

function normalizeUgandaPhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('0') ? `256${digits.slice(1)}` : digits
}

function buildWhatsAppLink({ phone, productName, price, url }) {
  const whatsappNumber = normalizeUgandaPhone(phone)
  if (!whatsappNumber) return ''

  const formattedPrice = Number.isFinite(Number(price)) ? `UGX ${Number(price).toLocaleString()}` : ''
  const parts = [
    `Hi! I saw your "${productName}" on Garuga Marketplace.`,
    formattedPrice ? `Price: ${formattedPrice}.` : '',
    url ? `Link: ${url}` : ''
  ].filter(Boolean)

  const message = encodeURIComponent(parts.join(' '))
  return `https://wa.me/${whatsappNumber}?text=${message}`
}

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const [item, setItem] = useState(null)
  const [relatedItems, setRelatedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  useEffect(() => {
    loadItem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadItem = async () => {
    setLoading(true)
    try {
      const data = await withTimeout(getItem(id), 10000, 'Could not load this product. Supabase did not respond.')
      setItem(data)
      setLoadError('')
      setCurrentPhotoIndex(0)

      if (data.category) {
        setRelatedItems(await withTimeout(listRelatedItems(data.category, id), 10000, 'Could not load related products.'))
      } else {
        setRelatedItems([])
      }
    } catch (error) {
      console.error('Error loading item:', error)
      setLoadError(error.message || 'Could not load this product.')
      setItem(null)
      setRelatedItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!item) return

    const shareData = {
      title: item.productName,
      text: `${item.productName} - UGX ${Number(item.price).toLocaleString()} on Garuga Marketplace`,
      url: window.location.href
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled or not supported
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const handleCall = () => {
    if (!item?.phone) return
    window.location.href = `tel:${item.phone}`
  }

  const handleWhatsApp = () => {
    if (!item) return
    const link = buildWhatsAppLink({
      phone: item.phone,
      productName: item.productName,
      price: item.price,
      url: window.location.href
    })
    if (!link) return
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const handleChatSeller = async () => {
    if (!item) return
    if (!user) {
      navigate('/login')
      return
    }
    if (!item.sellerId) {
      alert('This seller is not connected to in-app chat yet.')
      return
    }
    if (item.sellerId === user.id) {
      alert('This is your own listing.')
      return
    }

    try {
      const conversation = await startMarketplaceConversation({
        buyerId: user.id,
        sellerId: item.sellerId,
        itemId: item.id,
        productSnapshot: {
          name: item.productName,
          price: item.price,
          photoURL: item.photoURL,
          negotiable: item.negotiable,
          url: `/product/${item.id}`,
        },
        openingMessage: `Hi, I am interested in ${item.productName}. Is it still available${item.negotiable ? ' and can we negotiate?' : '?'}`,
        senderName: profile?.name || user.email || 'Garuga buyer',
        senderRole: role || 'buyer',
      })
      navigate(`/chats/${conversation.id}`)
    } catch (error) {
      console.error(error)
      alert(error.message || 'Could not start chat.')
    }
  }

  const photos =
    item?.photoURLs && item.photoURLs.length > 0 ? item.photoURLs : item?.photoURL ? [item.photoURL] : []

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50 && photos.length > 1) {
      if (diff > 0 && currentPhotoIndex < photos.length - 1) {
        setCurrentPhotoIndex((prev) => prev + 1)
      } else if (diff < 0 && currentPhotoIndex > 0) {
        setCurrentPhotoIndex((prev) => prev - 1)
      }
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Unknown'
    const d = date.toDate ? date.toDate() : new Date(date)
    const now = new Date()
    const diffTime = Math.abs(now - d)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return d.toLocaleDateString()
  }

  const conditionEmoji = {
    New: '✨',
    'Like New': '👌',
    'Used - Good': '✅',
    'Used - Fair': '⚠️'
  }

  const categoryEmoji = {
    Electronics: '📱',
    Clothing: '👕',
    Food: '🥬',
    'Home & Garden': '🏠',
    Vehicles: '🚗',
    Animals: '🐄',
    Services: '🔧',
    Other: '📦'
  }

  if (loading) {
    return <p className="empty-message">Loading...</p>
  }

  if (!item) {
    return (
      <div className="product-detail-container">
        <p className="empty-message">{loadError || 'Product not found'}</p>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
      </div>
    )
  }

  const whatsappLink = buildWhatsAppLink({
    phone: item.phone,
    productName: item.productName,
    price: item.price,
    url: typeof window !== 'undefined' ? window.location.href : ''
  })

  return (
    <div className="product-detail-container">
      <div className="product-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button className="btn-icon" onClick={handleShare} title="Share">
          📤
        </button>
      </div>

      <div className="product-detail-layout">
        <div className="product-detail-left">
          {photos.length > 0 ? (
            <div
              className="photo-gallery"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img src={photos[currentPhotoIndex]} alt={item.productName} className="product-main-photo" />
              {photos.length > 1 && (
                <>
                  <div className="photo-dots">
                    {photos.map((_, i) => (
                      <span
                        key={i}
                        className={`photo-dot ${i === currentPhotoIndex ? 'active' : ''}`}
                        onClick={() => setCurrentPhotoIndex(i)}
                      />
                    ))}
                  </div>
                  <button
                    className="gallery-nav prev"
                    onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, prev - 1))}
                    style={{ display: currentPhotoIndex > 0 ? 'block' : 'none' }}
                  >
                    ‹
                  </button>
                  <button
                    className="gallery-nav next"
                    onClick={() => setCurrentPhotoIndex((prev) => Math.min(photos.length - 1, prev + 1))}
                    style={{ display: currentPhotoIndex < photos.length - 1 ? 'block' : 'none' }}
                  >
                    ›
                  </button>
                  <span className="photo-counter">
                    {currentPhotoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="product-main-photo-placeholder">📷 No Photo</div>
          )}

          <div className="product-info-card">
            <div className="product-description">
              <h3>About this item</h3>
              <p>{item.description ? item.description : 'No description provided.'}</p>
            </div>
          </div>
        </div>

        <div className="product-detail-right">
          <div className="product-info-card">
            <div className="product-badges">
              <span className="badge badge-category">
                {categoryEmoji[item.category] || '📦'} {item.category || 'Other'}
              </span>
              {item.condition ? (
                <span className="badge badge-condition">
                  {conditionEmoji[item.condition] || '✅'} {item.condition}
                </span>
              ) : null}
            </div>

            <h1 className="product-title">{item.productName}</h1>
            <p className="product-price">UGX {Number(item.price).toLocaleString()}</p>
            {item.negotiable ? <p className="negotiable-pill">Negotiable / chat before buying</p> : null}

            <div className="product-contact-lines">
              <div className="product-contact-line">
                <span className="product-contact-icon">📍</span>
                <div>
                  <p className="detail-label">Location</p>
                  <p className="detail-value">{item.location || 'Not provided'}</p>
                </div>
              </div>

              <div className="product-contact-line">
                <span className="product-contact-icon">📞</span>
                <div>
                  <p className="detail-label">Phone</p>
                  {item.phone ? (
                    <a className="detail-value" href={`tel:${item.phone}`}>
                      {item.phone}
                    </a>
                  ) : (
                    <p className="detail-value">Not provided</p>
                  )}
                </div>
              </div>

              <div className="product-contact-line">
                <span className="product-contact-icon">🕒</span>
                <div>
                  <p className="detail-label">Posted</p>
                  <p className="detail-value">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            </div>

            {whatsappLink ? (
              <a className="btn-whatsapp" href={whatsappLink} target="_blank" rel="noopener noreferrer">
                💬 Chat on WhatsApp
              </a>
            ) : null}
            <button className="btn-primary" type="button" onClick={handleChatSeller} disabled={!item.sellerId || item.sellerId === user?.id}>
              Chat seller in Garuga
            </button>
          </div>

          <div className="seller-card">
            <div className="seller-header">
              <div className="seller-avatar">
                {item.sellerName ? item.sellerName.charAt(0).toUpperCase() : '👤'}
              </div>
              <div>
                <p className="seller-label">Seller</p>
                <p className="seller-name">{item.sellerName || 'Anonymous'}</p>
              </div>
            </div>
            {item.phone ? <p className="seller-phone">📞 {item.phone}</p> : null}
          </div>

          <div className="safety-tip">
            <span className="safety-icon">🛡️</span>
            <p>Safety tip: Don't send money in advance. Meet in person to inspect the item.</p>
          </div>
        </div>
      </div>

      {relatedItems.length > 0 && (
        <div className="related-products">
          <h2>You might also like</h2>
          <div className="related-grid">
            {relatedItems.map((relatedItem) => (
              <ItemCard key={relatedItem.id} item={relatedItem} />
            ))}
          </div>
        </div>
      )}

      <div className="action-bar">
        <button className="btn-action btn-call" onClick={handleCall} disabled={!item.phone}>
          <span>📞</span>
          <span>Call</span>
        </button>
        <button className="btn-action btn-whatsapp-action" onClick={handleWhatsApp} disabled={!whatsappLink}>
          <span>💬</span>
          <span>WhatsApp</span>
        </button>
        <button className="btn-action" onClick={handleChatSeller} disabled={!item.sellerId || item.sellerId === user?.id}>
          <span>💼</span>
          <span>Garuga chat</span>
        </button>
      </div>
    </div>
  )
}

export default ProductDetail
