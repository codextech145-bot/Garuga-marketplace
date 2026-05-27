import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import ShopTrustBadge from '../../components/ShopTrustBadge'
import { useAuth } from '../../contexts/AuthContext'
import { listPublicShops, startMarketplaceConversation } from '../../services/supabaseMarketplace'

function BuyerShops() {
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadShops = async () => {
      const data = await listPublicShops()
      setShops(data)
      setLoading(false)
    }
    loadShops()
  }, [])

  const handleTalkToShop = async (event, shop) => {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      navigate('/login')
      return
    }

    if (shop.ownerId === user.id) {
      setMessage('This is your own shop.')
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
    } catch (error) {
      console.error(error)
      setMessage(error.message || 'Could not start shop chat.')
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/buyer" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>Local Shops</h2>
            <p>Explore sellers and businesses in Garuga.</p>
          </div>
          <DashboardNav role="buyer" compact />
        </div>
      </header>

      <section className="market-panel">
        {message ? <p className="market-muted">{message}</p> : null}
        <div className="shop-grid">
          {loading ? (
            <p className="empty-message">Loading shops...</p>
          ) : shops.length === 0 ? (
            <p className="empty-message">No shops registered yet.</p>
          ) : (
            shops.map((shop) => (
              <Link key={shop.id} to={`/shop/${shop.shopCode || shop.id}`} className="shop-card">
                <div className="shop-card-content">
                  <ShopTrustBadge status={shop.verificationStatus} />
                  <strong>{shop.name}</strong>
                  <span className="shop-category">{shop.businessCategoryLabel}</span>
                  <p className="shop-location">Location: {shop.location || 'Garuga'}</p>
                  <button className="btn-back shop-chat-button" type="button" onClick={(event) => handleTalkToShop(event, shop)}>
                    Talk to shop
                  </button>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default BuyerShops
