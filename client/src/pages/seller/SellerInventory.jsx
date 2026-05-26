import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { deleteProduct, getSellerShop, listShopProducts } from '../../services/supabaseMarketplace'
import { withTimeout } from '../../utils/async'
import { formatMoney, getBusinessCategory, getSellerLanguage } from '../../utils/marketplace'

function SellerInventory() {
  const { user, profile } = useAuth()
  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const loadProducts = async (shopId) => {
    const nextProducts = await withTimeout(listShopProducts(shopId), 10000, 'Could not load products.')
    setProducts(nextProducts)
  }

  useEffect(() => {
    if (!user) return undefined

    let active = true

    const loadInventory = async () => {
      setLoading(true)
      setError('')

      try {
        const nextShop = await withTimeout(getSellerShop(user.id, profile), 10000, 'Could not load shop.')
        const nextProducts = nextShop?.id
          ? await withTimeout(listShopProducts(nextShop.id), 10000, 'Could not load products.')
          : []

        if (!active) return
        setShop(nextShop)
        setProducts(nextProducts)
      } catch (loadError) {
        console.error(loadError)
        if (active) setError('Could not load your products. Check your connection and Supabase policies.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadInventory()

    return () => {
      active = false
    }
  }, [profile, user])

  const categoryConfig = getBusinessCategory(shop?.businessCategory)
  const labels = getSellerLanguage(shop?.businessCategory)
  const availableCount = products.filter((product) => product.available !== false).length

  const handleDelete = async (productId) => {
    if (!shop) return

    try {
      await deleteProduct(productId)
      setConfirmDeleteId(null)
      setMessage('Product deleted.')
      await loadProducts(shop.id)
    } catch (deleteError) {
      console.error(deleteError)
      setMessage('Could not delete product.')
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/seller" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>{labels.collection}</h2>
            <p>View {labels.itemPlural} and open the editing page when you need changes.</p>
          </div>
          <DashboardNav role="seller" sellerCategory={shop?.businessCategory} compact />
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {message ? <p className="market-muted">{message}</p> : null}

      <section className="market-stats">
        <div><span>Total {labels.itemPlural}</span><strong>{products.length}</strong></div>
        <div><span>Available</span><strong>{availableCount}</strong></div>
        <div><span>Category</span><strong>{shop?.businessCategoryLabel || categoryConfig.label}</strong></div>
      </section>

      <section className="market-panel">
        <div className="seller-feature-heading">
          <div>
            <h3>{labels.collectionShort} ({products.length})</h3>
            <p className="market-muted">Keep this page simple for checking your shop list.</p>
          </div>
          <Link to="/dashboard/seller/products/new" className="btn-primary">{labels.addItem}</Link>
        </div>

        <div className="market-list">
          {loading ? (
            <p className="empty-message">Loading {labels.itemPlural}...</p>
          ) : products.length === 0 ? (
            <p className="market-muted">{labels.empty}</p>
          ) : (
            products.map((product) => (
              <article key={product.id} className="market-row">
                {product.photoURL ? <img src={product.photoURL} alt={product.name} /> : <div className="market-thumb">No photo</div>}
                <div>
                  <strong>{product.name}</strong>
                  <p>{formatMoney(product.price)} / {product.available === false ? 'Unavailable' : labels.availableLabel}</p>
                  {product.description ? <p className="market-muted">{product.description}</p> : null}
                </div>
                <div className="market-row-actions">
                  {confirmDeleteId === product.id ? (
                    <>
                      <button className="btn-danger" type="button" onClick={() => handleDelete(product.id)}>Delete</button>
                      <button className="btn-back" type="button" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <Link className="btn-back" to={`/dashboard/seller/products/${product.id}/edit`}>Edit</Link>
                      <button className="btn-danger" type="button" onClick={() => setConfirmDeleteId(product.id)}>Delete</button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default SellerInventory
