import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../components/DashboardNav'
import { useAuth } from '../contexts/AuthContext'
import { listMarketplaceConversations } from '../services/supabaseMarketplace'
import { formatMoney } from '../utils/marketplace'

function formatChatDate(value) {
  if (!value) return 'New'
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ChatsPage() {
  const { user, profile, role } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return undefined
    let active = true

    const loadChats = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await listMarketplaceConversations(user.id)
        if (active) setConversations(data)
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load chats. Check the chat database migration.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadChats()
    const interval = window.setInterval(loadChats, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [user])

  const title = useMemo(() => {
    if (role === 'seller') return 'Seller chats'
    if (role === 'delivery') return 'Delivery chats'
    return 'Buyer chats'
  }, [role])

  return (
    <div className="market-dashboard chats-page">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <div>
            <p className="market-eyebrow">Garuga Chat Center</p>
            <h2>{title}</h2>
            <p>Negotiate, confirm stock, and keep deal history inside Garuga.</p>
          </div>
          <DashboardNav role={role || 'buyer'} compact />
        </div>
      </header>

      <section className="market-panel chat-center-panel">
        <div className="chat-center-heading">
          <div>
            <h3>Messages</h3>
            <p className="market-muted">Signed in as {profile?.name || user?.email || 'Garuga user'}.</p>
          </div>
          <Link to="/" className="btn-back">Find products</Link>
        </div>

        {loading ? <p className="empty-message">Loading chats...</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}

        {!loading && conversations.length === 0 ? (
          <div className="empty-message chat-empty-state">
            <strong>No chats yet.</strong>
            <span>Open a product and tap Chat seller to start negotiating.</span>
          </div>
        ) : null}

        <div className="chat-thread-list">
          {conversations.map((conversation) => {
            const product = conversation.productSnapshot || {}
            const isSellerView = conversation.sellerId === user.id
            return (
              <Link key={conversation.id} to={`/chats/${conversation.id}`} className="chat-thread-card">
                {product.photoURL ? <img src={product.photoURL} alt={product.name || 'Product'} /> : <div className="chat-thread-photo">Chat</div>}
                <div>
                  <div className="chat-thread-title-row">
                    <strong>{product.name || 'Marketplace chat'}</strong>
                    <span>{formatChatDate(conversation.lastMessageAt)}</span>
                  </div>
                  <p>{conversation.lastMessage || 'Chat started'}</p>
                  <small>
                    {isSellerView ? 'Buyer conversation' : 'Seller conversation'}
                    {product.price ? ` / ${formatMoney(product.price)}` : ''}
                    {product.negotiable ? ' / Negotiable' : ''}
                  </small>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default ChatsPage
