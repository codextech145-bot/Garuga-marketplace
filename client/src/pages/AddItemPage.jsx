import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createItem } from '../services/supabaseMarketplace'
import { uploadToImgBB } from '../utils/marketplace'

const CATEGORIES = [
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Food', label: 'Food' },
  { value: 'Home & Garden', label: 'Home & Garden' },
  { value: 'Vehicles', label: 'Vehicles' },
  { value: 'Animals', label: 'Animals' },
  { value: 'Services', label: 'Services' },
  { value: 'Other', label: 'Other' }
]

const CONDITIONS = [
  { value: 'New', label: 'New' },
  { value: 'Like New', label: 'Like New' },
  { value: 'Used - Good', label: 'Used - Good' },
  { value: 'Used - Fair', label: 'Used - Fair' }
]

function AddItemPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [formData, setFormData] = useState({
    productName: '',
    category: 'Other',
    condition: 'Used - Good',
    price: '',
    description: '',
    location: '',
    phone: profile?.phone || '',
    sellerName: profile?.name || ''
  })
  const [photoFiles, setPhotoFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ message: '', percent: 0 })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5)
    setPhotoFiles(files)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    const photoURLs = []

    if (photoFiles.length > 0) {
      setUploadProgress({ message: 'Uploading photos...', percent: 0 })
      for (let i = 0; i < photoFiles.length; i++) {
        setUploadProgress({
          message: `Uploading photo ${i + 1} of ${photoFiles.length}...`,
          percent: Math.round(((i + 1) / photoFiles.length) * 100),
        })
        const url = await uploadToImgBB(photoFiles[i])
        photoURLs.push(url)
      }
    }

    try {
      await createItem({
        seller_id: user.id,
        product_name: formData.productName.trim(),
        category: formData.category,
        condition: formData.condition,
        price: Number(formData.price),
        description: formData.description.trim(),
        location: formData.location.trim(),
        phone: formData.phone.trim(),
        seller_name: formData.sellerName.trim(),
        photo_urls: photoURLs,
        status: 'active',
      })

      alert('Item posted successfully!')
      navigate('/')
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Error posting item. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress({ message: '', percent: 0 })
    }
  }

  return (
    <div className="form-container">
      <h2>Sell an Item</h2>
      <form id="addItemForm" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="productName">Product Name *</label>
          <input type="text" id="productName" name="productName" value={formData.productName} onChange={handleChange} required placeholder="e.g., iPhone 13 Pro" />
        </div>

        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="category">Category *</label>
            <select id="category" name="category" value={formData.category} onChange={handleChange} required>
              {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
            </select>
          </div>

          <div className="form-group half">
            <label htmlFor="condition">Condition *</label>
            <select id="condition" name="condition" value={formData.condition} onChange={handleChange} required>
              {CONDITIONS.map((cond) => <option key={cond.value} value={cond.value}>{cond.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="price">Price (UGX) *</label>
          <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required min="0" placeholder="e.g., 1500000" />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description (optional)</label>
          <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Describe your item: features, defects, reason for selling..." />
        </div>

        <div className="form-group">
          <label htmlFor="sellerName">Your Name *</label>
          <input type="text" id="sellerName" name="sellerName" value={formData.sellerName} onChange={handleChange} required placeholder="e.g., John" />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location *</label>
          <input type="text" id="location" name="location" value={formData.location} onChange={handleChange} required placeholder="e.g., Entebbe, Kampala" />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number *</label>
          <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required placeholder="e.g., 0771234567" />
        </div>

        <div className="form-group">
          <label htmlFor="productPhoto">Product Photos (up to 5)</label>
          <input type="file" id="productPhoto" name="productPhoto" accept="image/*" multiple onChange={handleFileChange} />
          <small className="form-hint">First photo will be the main image. Add up to 5 photos.</small>
        </div>

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress.percent}%` }}></div>
            </div>
            <span>{uploadProgress.message}</span>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Post Item'}
        </button>
      </form>
    </div>
  )
}

export default AddItemPage
