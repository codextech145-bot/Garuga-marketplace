import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import ShopTrustBadge from '../../components/ShopTrustBadge'
import { listPublicShops } from '../../services/supabaseMarketplace'

function BuyerShops() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadShops = async () => {
      const data = await listPublicShops()
      setShops(data)
      setLoading(false)
    }
    loadShops()
  }, [])

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
