import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DashboardNav from '../components/DashboardNav'
import { useAuth } from '../contexts/AuthContext'
import {
  getMarketplaceConversation,
  sendMarketplaceMessage,
  subscribeToMarketplaceMessages,
} from '../services/supabaseMarketplace'
import { formatMoney } from '../utils/marketplace'

function formatMessageTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ChatRoomPage() {
  const { conversationId } = useParams()
  const { user, profile, role } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    let active = true

    const loadConversation = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getMarketplaceConversation(conversationId)
        if (active) setConversation(data)
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load this chat.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadConversation()
    const unsubscribe = subscribeToMarketplaceMessages(
      conversationId,
      (nextMessages) => {
        if (active) setMessages(nextMessages)
      },
      () => {
        if (active) setError('Could not load chat messages.')
      }
    )

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [conversationId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const submitMessage = async (event) => {
    event.preventDefault()
    const cleanMessage = message.trim()
    if (!cleanMessage || !user) return

    setSending(true)
    setError('')
    try {
      await sendMarketplaceMessage({
        conversationId,
        senderId: user.id,
        senderName: profile?.name || user.email || 'Garuga user',
        senderRole: role || 'buyer',
        message: cleanMessage,
      })
      setMessage('')
    } catch (sendError) {
      console.error(sendError)
      setError('Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const product = conversation?.productSnapshot || {}
  const otherSide = conversation?.sellerId === user?.id ? 'Buyer' : 'Seller'

  return (
    <div className="market-dashboard chat-room-page">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/chats" className="btn-back" aria-label="Back to chats">←</Link>
          <div>
            <p className="market-eyebrow">Negotiation room</p>
            <h2>{product.name || `${otherSide} chat`}</h2>
            <p>Keep price discussion, pickup plans, and delivery decisions inside Garuga.</p>
          </div>
          <DashboardNav role={role || 'buyer'} compact />
        </div>
      </header>

      <section className="market-panel chat-room-panel">
        {loading ? <p className="empty-message">Loading chat...</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}

        {conversation ? (
          <div className="chat-product-strip">
            {product.photoURL ? <img src={product.photoURL} alt={product.name || 'Product'} /> : <div className="chat-thread-photo">Deal</div>}
            <div>
              <strong>{product.name || 'Marketplace deal'}</strong>
              <span>
                {product.price ? formatMoney(product.price) : 'Price to discuss'}
                {product.negotiable ? ' / Negotiable' : ''}
              </span>
            </div>
            {product.url ? <Link to={product.url} className="btn-back">View listing</Link> : null}
          </div>
        ) : null}

        <div className="chat-message-list" ref={listRef}>
          {messages.length === 0 ? (
            <p className="empty-message">No messages yet. Start with a clear question.</p>
          ) : (
            messages.map((chatMessage) => {
              const mine = chatMessage.senderId === user?.id
              return (
                <article key={chatMessage.id} className={`chat-message ${mine ? 'mine' : ''}`}>
                  <div>
                    <strong>{chatMessage.senderName || chatMessage.senderRole}</strong>
                    <span>{formatMessageTime(chatMessage.createdAt)}</span>
                  </div>
                  <p>{chatMessage.message}</p>
                </article>
              )
            })
          )}
        </div>

        <form className="chat-compose-form" onSubmit={submitMessage}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type your message..."
            disabled={sending}
          />
          <button className="btn-primary" disabled={sending || !message.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default ChatRoomPage
