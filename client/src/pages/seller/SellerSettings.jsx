import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardNav from '../../components/DashboardNav'
import { useAuth } from '../../contexts/AuthContext'
import { deleteSellerShop, getSellerShop, updateSellerShop } from '../../services/supabaseMarketplace'
import { withTimeout } from '../../utils/async'
import { getBusinessCategory } from '../../utils/marketplace'

function SellerSettings() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [shop, setShop] = useState(null)
  const [shopInfo, setShopInfo] = useState({ name: '', phone: '', email: '', location: '' })
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    if (!user) return undefined

    let active = true

    const loadSettings = async () => {
      setLoading(true)
      setMessage('')

      try {
        const nextShop = await withTimeout(getSellerShop(user.id, profile), 10000, 'Could not load shop settings.')
        if (!active) return

        setShop(nextShop)
        setShopInfo({
          name: nextShop.name || profile?.name || '',
          phone: nextShop.phone || profile?.phone || '',
          email: nextShop.email || profile?.email || '',
          location: nextShop.location || '',
        })
        setSettings(nextShop.settings || {})
      } catch (error) {
        console.error(error)
        if (active) {
          setMessage('Could not load shop settings. Check your connection and Supabase policies.')
          setMessageType('err')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSettings()

    return () => {
      active = false
    }
  }, [profile, user])

  const categoryConfig = getBusinessCategory(shop?.businessCategory)

  const handleInfoChange = (event) => {
    const { name, value } = event.target
    setShopInfo((current) => ({ ...current, [name]: value }))
  }

  const handleSettingChange = (event) => {
    const { name, value, type, checked } = event.target
    setSettings((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleShopStatusChange = (event) => {
    const { name, value, type, checked } = event.target
    setSettings((current) => ({
      ...current,
      shopClosed: name === 'shopClosed' ? checked : Boolean(current.shopClosed),
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    if (!shop) return

    setSaving(true)
    setMessage('')

    try {
      const updatedShop = await updateSellerShop(shop.id, {
        name: shopInfo.name.trim() || 'Garuga Shop',
        phone: shopInfo.phone.trim(),
        email: shopInfo.email.trim(),
        location: shopInfo.location.trim(),
        settings,
        updated_at: new Date().toISOString(),
      })
      setShop(updatedShop)
      setMessage('Shop settings saved.')
      setMessageType('ok')
    } catch (error) {
      console.error(error)
      setMessage('Could not save shop settings.')
      setMessageType('err')
    } finally {
      setSaving(false)
    }
  }

  const deleteShop = async () => {
    if (!shop) return

    setDeleting(true)
    setMessage('')

    try {
      await deleteSellerShop(shop.id)
      navigate('/dashboard/seller', { replace: true })
    } catch (error) {
      console.error(error)
      setMessage('Could not delete shop. Remove products first or check your Supabase policy.')
      setMessageType('err')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="market-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-row">
          <Link to="/dashboard/seller" className="btn-back" aria-label="Back to dashboard">←</Link>
          <div>
            <h2>Shop settings</h2>
            <p>Update the shop details buyers see before they order.</p>
          </div>
          <DashboardNav role="seller" compact />
        </div>
      </header>

      {message ? <p className={messageType === 'err' ? 'admin-error' : 'market-muted'}>{message}</p> : null}

      <section className="market-panel">
        {loading ? (
          <p className="empty-message">Loading shop settings...</p>
        ) : (
          <form className="market-form" onSubmit={saveSettings}>
            <div className="seller-feature-heading">
              <div>
                <h3>Public shop information</h3>
                <p className="market-muted">{shop?.shopCode ? `Shop code: ${shop.shopCode}` : categoryConfig.label}</p>
              </div>
              <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
            </div>

            <div className="seller-settings-grid">
              <label>Shop name<input name="name" value={shopInfo.name} onChange={handleInfoChange} required /></label>
              <label>Phone<input name="phone" value={shopInfo.phone} onChange={handleInfoChange} /></label>
              <label>Email<input type="email" name="email" value={shopInfo.email} onChange={handleInfoChange} /></label>
              <label>Location<input name="location" value={shopInfo.location} onChange={handleInfoChange} placeholder="e.g. Garuga Road, opposite the stage" /></label>
            </div>

            <div className="seller-feature-heading">
              <div>
                <h3>Shop status</h3>
                <p className="market-muted">Close the shop when you are away, sold out, or not taking orders.</p>
              </div>
            </div>

            <div className="seller-settings-grid">
              <label className="market-check">
                <input
                  type="checkbox"
                  name="shopClosed"
                  checked={Boolean(settings.shopClosed)}
                  onChange={handleShopStatusChange}
                />
                Temporarily close my shop
              </label>
              <label>
                Closed message
                <input
                  name="shopClosedMessage"
                  value={settings.shopClosedMessage || ''}
                  onChange={handleShopStatusChange}
                  placeholder="e.g. Closed today, back tomorrow morning"
                />
              </label>
            </div>

            <div className="seller-feature-heading">
              <div>
                <h3>{categoryConfig.label} features</h3>
                <p className="market-muted">{categoryConfig.description}</p>
              </div>
            </div>

            <div className="seller-settings-grid">
              {categoryConfig.settingsFields.map((field) => (
                <label key={field.name} className={field.type === 'checkbox' ? 'market-check' : ''}>
                  {field.type === 'checkbox' ? (
                    <>
                      <input type="checkbox" name={field.name} checked={Boolean(settings[field.name])} onChange={handleSettingChange} />
                      {field.label}
                    </>
                  ) : (
                    <>
                      {field.label}
                      <input
                        type={field.type || 'text'}
                        name={field.name}
                        value={settings[field.name] || ''}
                        onChange={handleSettingChange}
                        placeholder={field.placeholder || ''}
                      />
                    </>
                  )}
                </label>
              ))}
            </div>
          </form>
        )}
      </section>

      {!loading ? (
        <section className="market-panel danger-panel">
          <div className="seller-feature-heading">
            <div>
              <h3>Delete shop</h3>
              <p className="market-muted">This removes your shop from Garuga. Temporary closure is safer if you plan to return.</p>
            </div>
            {confirmDelete ? (
              <div className="market-actions">
                <button className="btn-danger" type="button" onClick={deleteShop} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Confirm delete'}
                </button>
                <button className="btn-back" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-danger" type="button" onClick={() => setConfirmDelete(true)}>Delete shop</button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default SellerSettings
