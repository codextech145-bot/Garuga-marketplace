function ShopTrustBadge({ status }) {
  const isVerified = status === 'verified'

  return (
    <span className={`shop-trust-badge ${isVerified ? 'verified' : 'new'}`}>
      {isVerified ? 'Verified shop' : 'New shop'}
    </span>
  )
}

export default ShopTrustBadge
