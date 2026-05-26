import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { listBuyerOrders } from '../../services/supabaseMarketplace'
import { formatMoney, ORDER_STATUS } from '../../utils/marketplace'

function BuyerOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const loadOrders = async () => {
      const data = await listBuyerOrders(user.id)
      setOrders(data)
      setLoading(false)
    }
    loadOrders()
  }, [user])

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/buyer" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>Your Orders</h2>
            <p>View history and track your current purchases.</p>
          </div>
          <DashboardNav role="buyer" compact />
        </div>
      </header>

      <section className="market-panel">
        <div className="market-list">
          {loading ? (
            <p className="empty-message">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="empty-message">You haven't placed any orders yet.</p>
          ) : (
            orders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="order-card order-link">
                <div className="order-main-info">
                  <strong>{order.items?.map((item) => item.name).join(', ')}</strong>
                  <p className="order-price">{formatMoney(order.total)}</p>
                  <p className="order-date">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="order-status-box">
                  <span className={`order-status status-${order.status}`}>
                    {ORDER_STATUS[order.status] || order.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default BuyerOrders
