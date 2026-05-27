import { useNavigate } from 'react-router-dom'

function ItemCard({ item }) {
  const navigate = useNavigate()

  const openDetails = () => navigate(`/product/${item.id}`)

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetails()
    }
  }

  const photoUrl = item.photoURL || (Array.isArray(item.photoURLs) ? item.photoURLs[0] : '')

  return (
    <div
      className="item-card"
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      aria-label={`View details for ${item.productName}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={item.productName} className="item-photo" loading="lazy" />
      ) : (
        <div className="item-photo-placeholder">No Photo</div>
      )}

      <h3>{item.productName}</h3>
      <div className="item-card-meta">
        {item.category ? <span>{item.category}</span> : null}
        {item.location ? <span>{item.location}</span> : null}
      </div>
      <p className="price">UGX {Number(item.price).toLocaleString()}</p>
      {item.negotiable ? <span className="item-negotiable">Negotiable</span> : null}
    </div>
  )
}

export default ItemCard
