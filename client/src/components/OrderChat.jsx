import { useEffect, useRef, useState } from 'react'
import { sendOrderMessage, subscribeToOrderMessages } from '../services/supabaseMarketplace'

function formatChatTime(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function OrderChat({ order, user, profile, role, title = 'Order chat', helperText = 'Message about this order.' }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!order?.id || !user?.id) return undefined

    let active = true
    const unsubscribe = subscribeToOrderMessages(
      order.id,
      (nextMessages) => {
        if (!active) return
        setMessages(nextMessages)
        setError('')
      },
      (loadError) => {
        console.error(loadError)
        if (active) setError('Could not load chat. Run the latest Supabase upgrade SQL.')
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [order?.id, user?.id])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const submitMessage = async (event) => {
    event.preventDefault()
    const cleanMessage = draft.trim()
    if (!cleanMessage || !order?.id || !user?.id) return

    setSending(true)
    setError('')
    try {
      await sendOrderMessage({
        orderId: order.id,
        senderId: user.id,
        senderName: profile?.name || order.buyerName || 'Garuga user',
        senderRole: role || profile?.role || 'buyer',
        message: cleanMessage,
      })
      setDraft('')
    } catch (sendError) {
      console.error(sendError)
      setError('Could not send message. Check Supabase chat table and permissions.')
    } finally {
      setSending(false)
    }
  }

  if (!order?.id || !user?.id) return null

  return (
    <section className="order-chat-panel">
      <div className="order-chat-heading">
        <div>
          <h3>{title}</h3>
          <p>{helperText}</p>
        </div>
        <span>{messages.length}</span>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="order-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="market-muted">No messages yet. Start with a short update.</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === user.id
            return (
              <article key={message.id} className={`order-chat-message ${mine ? 'mine' : ''}`}>
                <div>
                  <strong>{message.senderName || message.senderRole}</strong>
                  <span>{message.senderRole} / {formatChatTime(message.createdAt)}</span>
                </div>
                <p>{message.message}</p>
              </article>
            )
          })
        )}
      </div>

      <form className="order-chat-form" onSubmit={submitMessage}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message..."
          maxLength={500}
        />
        <button className="btn-primary" disabled={sending || !draft.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  )
}

export default OrderChat
