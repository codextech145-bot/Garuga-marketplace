import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { getSellerShop, listShopProducts, saveProduct } from '../../services/supabaseMarketplace'
import { withTimeout } from '../../utils/async'
import { getBusinessCategory, getSellerLanguage, uploadToImgBB } from '../../utils/marketplace'

const EMPTY_PRODUCT = {
  name: '',
  price: '',
  description: '',
  available: true,
  details: {},
  photoURL: '',
}

function SellerProductEditor() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [shop, setShop] = useState(null)
  const [formData, setFormData] = useState(EMPTY_PRODUCT)
  const [photoFile, setPhotoFile] = useState(null)
  const [loading, setLoading] = useState(Boolean(productId))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    if (!user) return undefined

    let active = true

    const loadEditor = async () => {
      setLoading(true)
      setMessage('')

      try {
        const nextShop = await withTimeout(getSellerShop(user.id, profile), 10000, 'Could not load shop.')
        if (!active) return
        setShop(nextShop)

        if (productId) {
          const products = await withTimeout(listShopProducts(nextShop.id), 10000, 'Could not load products.')
          const product = products.find((item) => item.id === productId)
          if (!product) throw new Error('Product not found.')

          setFormData({
            name: product.name || '',
            price: product.price || '',
            description: product.description || '',
            available: product.available !== false,
            details: product.details || {},
            photoURL: product.photoURL || '',
          })
        } else {
          setFormData(EMPTY_PRODUCT)
        }
      } catch (error) {
        console.error(error)
        if (active) {
          setMessage(error.message || 'Could not load product editor.')
          setMessageType('err')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEditor()

    return () => {
      active = false
    }
  }, [productId, profile, user])

  const categoryConfig = getBusinessCategory(shop?.businessCategory)
  const labels = getSellerLanguage(shop?.businessCategory)

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleDetailChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({
      ...current,
      details: {
        ...(current.details || {}),
        [name]: type === 'checkbox' ? checked : value,
      },
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!shop) return

    setSaving(true)
    setMessage('')

    try {
      const photoURL = photoFile ? await uploadToImgBB(photoFile) : formData.photoURL || ''
      await saveProduct(productId || '', {
        shop_id: shop.id,
        seller_id: user.id,
        name: formData.name.trim(),
        price: Number(formData.price),
        description: formData.description.trim(),
        available: Boolean(formData.available),
        photo_url: photoURL,
        details: formData.details || {},
        business_category: shop.businessCategory,
        business_category_label: shop.businessCategoryLabel,
        updated_at: new Date().toISOString(),
      })

      navigate('/dashboard/seller/inventory')
    } catch (error) {
      console.error(error)
      setMessage('Could not save product. Check your connection.')
      setMessageType('err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/seller/inventory" className="btn-back" aria-label={`Back to ${labels.collection.toLowerCase()}`}>←</Link>
          <div>
            <h2>{productId ? labels.editItem : labels.addItem}</h2>
            <p>{categoryConfig.itemLabel} details for your shop.</p>
          </div>
          <DashboardNav role="seller" sellerCategory={shop?.businessCategory} compact />
        </div>
      </header>

      <section className="market-panel">
        {loading ? (
          <p className="empty-message">Loading {labels.itemSingular} editor...</p>
        ) : (
          <form className="market-form" onSubmit={handleSubmit}>
            <label>Name<input name="name" value={formData.name} onChange={handleChange} required /></label>
            <label>Price (UGX)<input type="number" min="0" name="price" value={formData.price} onChange={handleChange} required /></label>
            <label>Description<textarea name="description" value={formData.description} onChange={handleChange} rows="3" /></label>

            {categoryConfig.productFields.map((field) => (
              <label key={field.name} className={field.type === 'checkbox' ? 'market-check' : ''}>
                {field.type === 'checkbox' ? (
                  <>
                    <input type="checkbox" name={field.name} checked={Boolean(formData.details?.[field.name])} onChange={handleDetailChange} />
                    {field.label}
                  </>
                ) : field.type === 'select' ? (
                  <>
                    {field.label}
                    <select name={field.name} value={formData.details?.[field.name] || ''} onChange={handleDetailChange}>
                      <option value="">Select...</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    {field.label}
                    <input
                      type={field.type || 'text'}
                      name={field.name}
                      value={formData.details?.[field.name] || ''}
                      onChange={handleDetailChange}
                      placeholder={field.placeholder || ''}
                    />
                  </>
                )}
              </label>
            ))}

            <label>
              {productId ? 'Replace photo' : 'Photo'}
              <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
            </label>

            {productId && formData.photoURL ? (
              <img className="product-edit-preview" src={formData.photoURL} alt="Current product" />
            ) : null}

            <label className="market-check">
              <input type="checkbox" name="available" checked={formData.available} onChange={handleChange} />
              {labels.availableLabel}
            </label>

            <div className="market-actions">
              <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : labels.saveItem}</button>
              <Link to="/dashboard/seller/inventory" className="btn-back">Cancel</Link>
            </div>

            {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}
          </form>
        )}
      </section>
    </div>
  )
}

export default SellerProductEditor
