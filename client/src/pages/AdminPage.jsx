import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { requireSupabase } from '../config/supabase'
import { defaultSiteContent, mergeSiteContent } from '../config/siteContent'
import { BUSINESS_CATEGORIES } from '../utils/marketplace'
import {
  deleteAdminItem,
  deleteAdminProfile,
  deleteAdminShop,
  getSiteContent,
  listAdminItems,
  listAdminOrders,
  listAdminProfiles,
  listAdminReports,
  listAdminShops,
  saveSiteContent as saveSupabaseSiteContent,
  updateAdminItem,
  updateAdminOrder,
  updateAdminProfile,
  updateAdminReport,
  updateAdminShop,
} from '../services/supabaseMarketplace'

const PRODUCT_CATEGORIES = [
  'All',
  'Electronics',
  'Clothing',
  'Food',
  'Home & Garden',
  'Vehicles',
  'Animals',
  'Services',
  'Other',
]

const EDIT_CATEGORIES = PRODUCT_CATEGORIES.filter((c) => c !== 'All')
const CONDITIONS = ['New', 'Like New', 'Used - Good', 'Used - Fair']
const STATUSES = ['active', 'sold', 'hidden']
const USER_ROLES = ['buyer', 'seller', 'delivery']
const RISK_LEVELS = ['normal', 'watch', 'high', 'blocked']
const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected']
const ORDER_ADMIN_STATUSES = ['normal', 'review', 'held', 'cleared']
const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed']
const ADMIN_TERMINAL_URL = 'http://127.0.0.1:5174'
const ADMIN_AUTH_BYPASS = true
const TERMINAL_COMMANDS = [
  { id: 'publishAll', label: 'Publish site', description: 'Build the client and deploy Cloudflare Pages production.' },
  { id: 'build', label: 'Build only', description: 'Create a fresh production build without deploying.' },
  { id: 'deployHosting', label: 'Deploy hosting', description: 'Deploy the current client/dist folder to Cloudflare Pages.' },
]
const ADMIN_SESSION_KEY = 'garuga_admin_key_session'

const CATEGORY_ICONS = {
  food: '🍽️',
  retail: '🏪',
  grocery: '🛒',
  pharmacy: '💊',
  hardware: '🔧',
  services: '🛠️',
  fashion: '👗',
  electronics: '📱',
  gas_water: '⛽',
}

function buildDeployCommand(commandId = 'publishAll') {
  const commandMap = {
    build: [`npm --prefix client run build`],
    deployHosting: [`cd client`, `npx wrangler pages deploy dist --project-name garuga-marketplace --branch main`],
    publishAll: [`npm --prefix client run deploy:cloudflare`],
  }
  return [...(commandMap[commandId] || commandMap.publishAll)].join('\n')
}

function formatDate(date) {
  if (!date) return '--'
  const parsed = date.toDate ? date.toDate() : new Date(date)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleString()
}

function formatDateShort(date) {
  if (!date) return '--'
  const parsed = date.toDate ? date.toDate() : new Date(date)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function buildAdvertDates(durationHours) {
  const publishedAt = new Date()
  const safeHours = Number(durationHours)
  const duration = Number.isFinite(safeHours) && safeHours > 0 ? safeHours : 24
  const expiresAt = new Date(publishedAt.getTime() + duration * 60 * 60 * 1000)
  return { publishedAt, expiresAt }
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
}

function getRoleBadgeClass(role) {
  if (role === 'buyer') return 'admin-role-buyer'
  if (role === 'seller') return 'admin-role-seller'
  if (role === 'delivery') return 'admin-role-delivery'
  return 'admin-role-default'
}

function getRiskBadgeClass(level) {
  if (level === 'blocked' || level === 'high') return 'admin-risk-high'
  if (level === 'watch') return 'admin-risk-watch'
  return 'admin-risk-normal'
}

function getShopLabel(shopId, shops) {
  const shop = shops.find((entry) => entry.id === shopId)
  if (!shop) return shopId ? `Shop ${shopId.slice(0, 8)}` : 'No shop'
  return `${shop.shopCode || 'G--'} · ${shop.name || 'Unnamed shop'}`
}

function getUserLabel(userId, users) {
  const user = users.find((entry) => entry.id === userId)
  if (!user) return userId ? `User ${userId.slice(0, 8)}` : 'No user'
  return user.name || user.email || `User ${userId.slice(0, 8)}`
}

function buildFraudSignals({ users = [], shops = [], orders = [], reports = [] }) {
  const signals = []
  users.filter((u) => u.blocked || ['high', 'blocked'].includes(u.riskLevel)).forEach((u) => {
    signals.push({
      id: `user-${u.id}`,
      level: u.blocked ? 'blocked' : u.riskLevel,
      title: `${u.name || u.email || 'User'} needs review`,
      detail: `Role: ${u.role || 'unknown'} · Trust score: ${u.trustScore ?? 70}`,
    })
  })

  shops.filter((s) => s.isSuspended || s.verificationStatus === 'rejected').forEach((s) => {
    signals.push({
      id: `shop-${s.id}`,
      level: s.isSuspended ? 'blocked' : 'high',
      title: `${s.shopCode || 'Shop'} ${s.isSuspended ? 'is suspended' : 'was rejected'}`,
      detail: s.name || 'Unnamed shop',
    })
  })

  orders.filter((o) => ['review', 'held'].includes(o.adminStatus)).forEach((o) => {
    signals.push({
      id: `order-${o.id}`,
      level: o.adminStatus === 'held' ? 'high' : 'watch',
      title: `Order ${o.id.slice(0, 8)} is ${o.adminStatus}`,
      detail: `${o.fulfillmentType || 'delivery'} · UGX ${Number(o.total || 0).toLocaleString()}`,
    })
  })

  reports.filter((r) => ['open', 'reviewing'].includes(r.status)).forEach((r) => {
    signals.push({
      id: `report-${r.id}`,
      level: r.status === 'reviewing' ? 'watch' : 'high',
      title: `Report: ${r.category.replaceAll('_', ' ')}`,
      detail: r.message || 'No message added yet',
    })
  })

  return signals.slice(0, 12)
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPanel({ adminKey, authError, onAdminKeyChange, onSubmit }) {
  return (
    <div className="form-container">
      <h2>Admin Access</h2>
      <p className="admin-hint">Enter the 15-digit Garuga admin key to open the control center.</p>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="adminKey">Admin key</label>
          <input
            id="adminKey"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{15}"
            maxLength={15}
            value={adminKey}
            onChange={onAdminKeyChange}
            required
            autoComplete="one-time-code"
            placeholder="15 digits"
          />
        </div>
        {authError ? <p className="admin-error">{authError}</p> : null}
        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Unlock admin</button>
      </form>
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
function AdminLayout({
  user, items, itemsLoading, users, usersLoading,
  shops, shopsLoading, orders, ordersLoading, reports, reportsLoading,
  siteContent, saveError, saveSuccess, contentLoading,
  onRefresh, onSignOut, onSaveSiteContent, onPublishAdvert, onDisableAdvert,
  onUpdateProduct, onDeleteProduct, onCopyDeployCommand, onRunDeploy,
  deploying, deployOutput, deployCommand, terminalInput, terminalShell,
  terminalStatus, isLocalhost, onTerminalInputChange, onTerminalShellChange,
  onRunTerminalCommand, onClearTerminal, onSiteContentChange,
  onDeleteUser, onCreateUser, onUpdateUser, onUpdateShop, onDeleteShop,
  onUpdateOrder, onUpdateReport,
}) {
  const location = useLocation()
  const adminLinks = [
    { to: '/admin', label: 'Control', end: true },
    { to: '/admin/shops', label: 'Shops' },
    { to: '/admin/categories', label: 'Categories' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/orders', label: 'Orders' },
    { to: '/admin/fraud', label: 'Fraud' },
    { to: '/admin/contacts', label: 'Contacts' },
    { to: '/admin/products', label: 'Products' },
    { to: '/admin/advert', label: 'Advert' },
    { to: '/admin/website', label: 'Website' },
    { to: '/admin/publish', label: 'Publishing' },
  ]

  return (
    <div className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Garuga Control Center</p>
          <h2 className="admin-title">Shops, users, orders, and fraud signals in one place.</h2>
          <p className="admin-subtitle">Signed in as <b>{user.email || 'Unknown'}</b></p>
        </div>
        <div className="admin-topbar-actions">
          <button className="btn-back" onClick={onRefresh} disabled={itemsLoading || contentLoading || shopsLoading || usersLoading || ordersLoading}>Refresh</button>
          <button className="btn-back" onClick={onSignOut}>Sign out</button>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Admin sections">
        {adminLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `admin-tab ${isActive || location.pathname === link.to ? 'active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {saveError ? <p className="admin-error">{saveError}</p> : null}
      {saveSuccess ? <p className="admin-success">{saveSuccess}</p> : null}

      <Routes>
        <Route index element={<AdminHome items={items} itemsLoading={itemsLoading} users={users} shops={shops} orders={orders} reports={reports} siteContent={siteContent} />} />
        <Route path="shops" element={<AdminShops shops={shops} shopsLoading={shopsLoading} users={users} onUpdateShop={onUpdateShop} onDeleteShop={onDeleteShop} />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="users" element={<AdminUsers users={users} usersLoading={usersLoading} onDeleteUser={onDeleteUser} onCreateUser={onCreateUser} onUpdateUser={onUpdateUser} />} />
        <Route path="orders" element={<AdminOrders orders={orders} ordersLoading={ordersLoading} shops={shops} users={users} onUpdateOrder={onUpdateOrder} />} />
        <Route path="fraud" element={<AdminFraud users={users} shops={shops} orders={orders} reports={reports} reportsLoading={reportsLoading} onUpdateUser={onUpdateUser} onUpdateShop={onUpdateShop} onUpdateOrder={onUpdateOrder} onUpdateReport={onUpdateReport} />} />
        <Route path="contacts" element={<AdminContacts items={items} itemsLoading={itemsLoading} />} />
        <Route path="products" element={<AdminProducts items={items} itemsLoading={itemsLoading} />} />
        <Route path="products/:id" element={<AdminProductEdit items={items} itemsLoading={itemsLoading} onUpdateProduct={onUpdateProduct} onDeleteProduct={onDeleteProduct} />} />
        <Route path="advert" element={<AdminAdvertStudio siteContent={siteContent} onSiteContentChange={onSiteContentChange} onPublishAdvert={onPublishAdvert} onDisableAdvert={onDisableAdvert} />} />
        <Route path="website" element={<AdminWebsiteSettings siteContent={siteContent} onSiteContentChange={onSiteContentChange} onSaveSiteContent={onSaveSiteContent} />} />
        <Route path="publish" element={<AdminPublish deploying={deploying} deployOutput={deployOutput} deployCommand={deployCommand} terminalInput={terminalInput} terminalShell={terminalShell} terminalStatus={terminalStatus} isLocalhost={isLocalhost} onCopyDeployCommand={onCopyDeployCommand} onRunDeploy={onRunDeploy} onTerminalInputChange={onTerminalInputChange} onTerminalShellChange={onTerminalShellChange} onRunTerminalCommand={onRunTerminalCommand} onClearTerminal={onClearTerminal} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────
function AdminHome({ items, itemsLoading, users, shops, orders, reports, siteContent }) {
  const totalItems = items.length
  const activeItems = items.filter((item) => (item.status || 'active') === 'active').length
  const activeOrders = orders.filter((order) => !['delivered', 'rejected'].includes(order.status)).length
  const flaggedOrders = orders.filter((order) => ['review', 'held'].includes(order.adminStatus)).length
  const openReports = reports.filter((report) => ['open', 'reviewing'].includes(report.status)).length
  const currentListings = items.slice(0, 6)
  const fraudSignals = buildFraudSignals({ users, shops, orders, reports })
  const categories = items.reduce((acc, item) => {
    const name = item.category || 'Other'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})

  return (
    <div className="admin-section-grid">
      <section className="admin-card admin-card-hero">
        <h3>Overview</h3>
        <div className="admin-stats">
          {[
            { label: 'Total listed', value: totalItems },
            { label: 'Active', value: activeItems },
            { label: 'Shops', value: shops.length },
            { label: 'Users', value: users.length },
            { label: 'Live orders', value: activeOrders },
            { label: 'Fraud queue', value: flaggedOrders + openReports },
          ].map(({ label, value }) => (
            <div key={label} className="admin-stat">
              <span className="admin-stat-label">{label}</span>
              <strong>{itemsLoading ? '--' : value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>Control center queue</h3>
        <div className="admin-command-grid">
          <Link to="/admin/shops" className="admin-command-card">
            <strong>{shops.filter((shop) => shop.verificationStatus !== 'verified').length}</strong>
            <span>shops need verification</span>
          </Link>
          <Link to="/admin/users" className="admin-command-card">
            <strong>{users.filter((u) => u.blocked || u.riskLevel !== 'normal').length}</strong>
            <span>users watched or blocked</span>
          </Link>
          <Link to="/admin/orders" className="admin-command-card">
            <strong>{flaggedOrders}</strong>
            <span>orders held for review</span>
          </Link>
          <Link to="/admin/fraud" className="admin-command-card">
            <strong>{openReports}</strong>
            <span>open reports</span>
          </Link>
        </div>
      </section>

      <section className="admin-card">
        <h3>Anti-fraud signals</h3>
        <div className="admin-activity-list">
          {fraudSignals.length === 0 ? (
            <p className="admin-hint">No fraud signals yet. That is the quiet dashboard we like to see.</p>
          ) : fraudSignals.map((signal) => (
            <div key={signal.id} className="admin-activity-row">
              <div>
                <p className="admin-item-name">{signal.title}</p>
                <p className="admin-item-sub">{signal.detail}</p>
              </div>
              <span className={`admin-risk-pill ${getRiskBadgeClass(signal.level)}`}>{signal.level}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>Recent listings</h3>
        <div className="admin-activity-list">
          {currentListings.length === 0 ? (
            <p className="admin-hint">No listings yet.</p>
          ) : currentListings.map((item) => (
            <Link key={item.id} to={`/admin/products/${item.id}`} className="admin-activity-row admin-activity-link">
              <div>
                <p className="admin-item-name">{item.productName}</p>
                <p className="admin-item-sub">{item.category || 'Other'}</p>
              </div>
              <strong>UGX {Number(item.price || 0).toLocaleString()}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>Products by category</h3>
        <div className="admin-category-grid">
          {Object.keys(categories).length === 0 ? (
            <p className="admin-hint">No category data yet.</p>
          ) : Object.entries(categories).map(([name, count]) => (
            <div key={name} className="admin-category-chip">
              <span>{name}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>Live advert status</h3>
        <div className="admin-preview-card">
          <p className="admin-preview-badge">{siteContent.promoEyebrow || 'No eyebrow set'}</p>
          <h4>{siteContent.promoTitle || 'No title'}</h4>
          <p>{siteContent.promoMessage || 'No message'}</p>
        </div>
        {[
          { label: 'Advert enabled', value: siteContent.promoEnabled ? 'Yes' : 'No' },
          { label: 'Close delay', value: `${siteContent.promoCloseDelaySeconds || 3}s` },
          { label: 'Expires', value: siteContent.promoExpiresAt ? formatDate(siteContent.promoExpiresAt) : '--' },
        ].map(({ label, value }) => (
          <div key={label} className="admin-preview-note">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
    </div>
  )
}

// ── Categories Preview ────────────────────────────────────────────────────────
function AdminCategories() {
  return (
    <div className="admin-section-grid admin-section-grid-wide" style={{ gridTemplateColumns: '1fr' }}>
      <section className="admin-card">
        <h3>Business categories</h3>
        <p className="admin-hint">
          These are all the seller types available on Garuga Marketplace. Each category has unique product fields, settings, and features tailored to that business.
        </p>
        <div className="admin-categories-grid">
          {BUSINESS_CATEGORIES.map((cat) => (
            <div key={cat.id} className="admin-category-preview-card">
              <div className="admin-cat-header">
                <span className="admin-cat-icon">{CATEGORY_ICONS[cat.id] || '🏷️'}</span>
                <div>
                  <p className="admin-cat-title">{cat.label}</p>
                  <p className="admin-cat-desc">{cat.description}</p>
                </div>
              </div>

              <div className="admin-cat-features">
                {cat.features.map((f) => (
                  <span key={f} className="admin-cat-feature-chip">{f}</span>
                ))}
              </div>

              <div className="admin-cat-fields">
                <p className="admin-cat-fields-label">Product fields</p>
                <div className="admin-cat-field-list">
                  {cat.productFields.map((field) => (
                    <span key={field.name} className="admin-cat-field-chip">{field.label}</span>
                  ))}
                </div>
                <p className="admin-cat-item-label">
                  Listed as: <strong>{cat.itemLabel}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Shops ─────────────────────────────────────────────────────────────────────
function AdminShops({ shops, shopsLoading, users, onUpdateShop, onDeleteShop }) {
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return shops
    return shops.filter((shop) =>
      [shop.name, shop.shopCode, shop.phone, shop.location, shop.businessCategoryLabel, shop.businessCategory]
        .some((value) => String(value || '').toLowerCase().includes(term))
    )
  }, [shops, search])

  return (
    <div className="admin-section-grid admin-section-grid-wide" style={{ gridTemplateColumns: '1fr' }}>
      <section className="admin-card">
        <div className="admin-table-heading">
          <div>
            <h3>Shop control</h3>
            <p className="admin-hint">{shopsLoading ? 'Loading...' : `${shops.length} shop${shops.length !== 1 ? 's' : ''} connected to Supabase`}</p>
          </div>
          <div className="admin-search admin-search-inline">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop, code, phone..." />
          </div>
        </div>

        {shopsLoading ? (
          <p className="empty-message">Loading shops...</p>
        ) : filtered.length === 0 ? (
          <p className="admin-hint">No shops found.</p>
        ) : (
          <div className="admin-control-list">
            {filtered.map((shop) => (
              <article key={shop.id} className={`admin-control-row ${shop.isSuspended ? 'is-danger' : ''}`}>
                <div>
                  <p className="admin-item-name">{shop.shopCode || 'No code'} · {shop.name || 'Unnamed shop'}</p>
                  <p className="admin-item-sub">
                    Owner: {getUserLabel(shop.ownerId, users)} · {shop.businessCategoryLabel || shop.businessCategory || 'No category'}
                  </p>
                  <p className="admin-item-sub">{shop.phone || 'No phone'} · {shop.location || 'No location'}</p>
                </div>
                <div className="admin-control-actions">
                  <label>
                    Status
                    <select value={shop.verificationStatus} onChange={(e) => onUpdateShop(shop.id, { verification_status: e.target.value })}>
                      {VERIFICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Notes
                    <input value={shop.adminNotes} onChange={(e) => onUpdateShop(shop.id, { admin_notes: e.target.value })} placeholder="Admin notes" />
                  </label>
                  <button className={shop.isSuspended ? 'btn-back' : 'btn-danger'} onClick={() => onUpdateShop(shop.id, { is_suspended: !shop.isSuspended })}>
                    {shop.isSuspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  {confirmDeleteId === shop.id ? (
                    <div className="admin-confirm-strip">
                      <span>Delete shop and products?</span>
                      <button className="btn-danger" onClick={() => { onDeleteShop(shop.id); setConfirmDeleteId(null) }}>Yes</button>
                      <button className="btn-back" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-danger" onClick={() => setConfirmDeleteId(shop.id)}>Delete</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────
function AdminUsers({ users, usersLoading, onDeleteUser, onCreateUser, onUpdateUser }) {
  const [search, setSearch] = useState('')
  const [activeRole, setActiveRole] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState('buyer')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const byRole = activeRole === 'all' ? users : users.filter((u) => u.role === activeRole)
    if (!term) return byRole
    return byRole.filter((u) =>
      [u.name, u.email, u.phone, u.role].some((v) => String(v || '').toLowerCase().includes(term))
    )
  }, [users, search, activeRole])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!newEmail || !newPassword || !newName) {
      setAddError('Name, email and password are required.')
      return
    }
    setAdding(true)
    const result = await onCreateUser({ name: newName, email: newEmail, password: newPassword, phone: newPhone, role: newRole })
    setAdding(false)
    if (result.ok) {
      setShowAddForm(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewPhone(''); setNewRole('buyer')
    } else {
      setAddError(result.error || 'Could not create account.')
    }
  }

  const handleDeleteConfirm = async (userId) => {
    await onDeleteUser(userId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="admin-section-grid admin-section-grid-wide" style={{ gridTemplateColumns: '1fr' }}>
      <section className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>User accounts</h3>
            <p className="admin-hint" style={{ marginBottom: 0 }}>
              {usersLoading ? 'Loading...' : `${users.length} registered account${users.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="btn-primary" onClick={() => { setShowAddForm((v) => !v); setAddError('') }}>
            {showAddForm ? 'Cancel' : '+ Add account'}
          </button>
        </div>

        {showAddForm && (
          <form className="admin-add-user-panel" onSubmit={handleAdd}>
            <h4>Create new account</h4>
            <div className="admin-form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label>Full name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Amara Nakato" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Phone</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+256..." />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {USER_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
            </div>
            {addError ? <p className="admin-error" style={{ margin: '0.5rem 0' }}>{addError}</p> : null}
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? 'Creating...' : 'Create account'}
            </button>
          </form>
        )}

        <div className="admin-search">
          <input
            type="text"
            placeholder="Search by name, email, phone, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-category-tabs">
          {['all', ...USER_ROLES].map((role) => (
            <button key={role} className={`admin-category-tab ${activeRole === role ? 'active' : ''}`} onClick={() => setActiveRole(role)}>
              {role === 'all' ? 'All users' : `${role}s`} ({role === 'all' ? users.length : users.filter((u) => u.role === role).length})
            </button>
          ))}
        </div>

        {usersLoading ? (
          <p className="empty-message">Loading users...</p>
        ) : filtered.length === 0 ? (
          <p className="admin-hint">No accounts found{search ? ' matching your search' : ''}.</p>
        ) : (
          <div className="admin-users-grid">
            {filtered.map((u) => (
              <div key={u.id} className="admin-user-card">
                <div className="admin-user-header">
                  <div className="admin-user-avatar">{getInitials(u.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <p className="admin-user-name">{u.name || 'No name'}</p>
                    <p className="admin-user-email">{u.email || '--'}</p>
                  </div>
                </div>

                <div className="admin-user-body">
                  <div className="admin-user-detail">
                    <span className={`admin-role-badge ${getRoleBadgeClass(u.role)}`}>{u.role || 'no role'}</span>
                  </div>
                  {u.phone ? (
                    <div className="admin-user-detail">
                      Phone <a href={`tel:${u.phone}`} style={{ color: 'var(--brand-orange)', fontWeight: 600, textDecoration: 'none' }}>{u.phone}</a>
                    </div>
                  ) : null}
                  <div className="admin-user-detail">
                    <span className={`admin-risk-pill ${getRiskBadgeClass(u.riskLevel)}`}>{u.blocked ? 'blocked' : u.riskLevel}</span>
                    <strong>{u.trustScore ?? 70}/100</strong>
                  </div>
                  {u.role === 'delivery' ? (
                    <div className="admin-user-detail">
                      Delivery: <strong>{(u.deliveryCategories || ['all']).join(', ')}</strong>
                    </div>
                  ) : null}
                  <div className="admin-user-controls">
                    <select value={u.role || 'buyer'} onChange={(e) => onUpdateUser(u.id, { role: e.target.value })}>
                      {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <select value={u.riskLevel || 'normal'} onChange={(e) => onUpdateUser(u.id, { risk_level: e.target.value })}>
                      {RISK_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                    <input type="number" min="0" max="100" value={u.trustScore ?? 70} onChange={(e) => onUpdateUser(u.id, { trust_score: Number(e.target.value || 0) })} />
                  </div>
                  <input className="admin-note-input" value={u.adminNotes || ''} onChange={(e) => onUpdateUser(u.id, { admin_notes: e.target.value })} placeholder="Admin notes" />
                </div>

                <div className="admin-user-footer">
                  <span className="admin-user-joined">Joined {formatDateShort(u.createdAt)}</span>
                  <button className={u.blocked ? 'btn-back' : 'btn-danger'} style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }} onClick={() => onUpdateUser(u.id, { blocked: !u.blocked, risk_level: !u.blocked ? 'blocked' : 'normal' })}>
                    {u.blocked ? 'Unblock' : 'Block'}
                  </button>
                  {confirmDeleteId === u.id ? (
                    <div className="admin-confirm-strip">
                      <span>Delete this account?</span>
                      <button className="btn-danger" style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }} onClick={() => handleDeleteConfirm(u.id)}>Yes, delete</button>
                      <button className="btn-back" style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-danger" style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }} onClick={() => setConfirmDeleteId(u.id)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Orders ────────────────────────────────────────────────────────────────────
function AdminOrders({ orders, ordersLoading, shops, users, onUpdateOrder }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orders
    return orders.filter((order) =>
      [
        order.id,
        order.buyerName,
        order.buyerPhone,
        order.status,
        order.fulfillmentType,
        getShopLabel(order.shopId, shops),
        getUserLabel(order.sellerId, users),
      ].some((value) => String(value || '').toLowerCase().includes(term))
    )
  }, [orders, search, shops, users])

  return (
    <div className="admin-section-grid admin-section-grid-wide" style={{ gridTemplateColumns: '1fr' }}>
      <section className="admin-card">
        <div className="admin-table-heading">
          <div>
            <h3>Orders and bookings</h3>
            <p className="admin-hint">{ordersLoading ? 'Loading...' : `${orders.length} order${orders.length !== 1 ? 's' : ''} across shops`}</p>
          </div>
          <div className="admin-search admin-search-inline">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, buyer, shop..." />
          </div>
        </div>

        {ordersLoading ? (
          <p className="empty-message">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <p className="admin-hint">No orders found.</p>
        ) : (
          <div className="admin-control-list">
            {filtered.map((order) => (
              <article key={order.id} className={`admin-control-row ${order.adminStatus === 'held' ? 'is-danger' : ''}`}>
                <div>
                  <p className="admin-item-name">{order.buyerName || 'Buyer'} · UGX {Number(order.total || 0).toLocaleString()}</p>
                  <p className="admin-item-sub">{getShopLabel(order.shopId, shops)} · Seller: {getUserLabel(order.sellerId, users)}</p>
                  <p className="admin-item-sub">
                    {order.fulfillmentType || 'delivery'} · {order.status} · Code {order.deliveryConfirmationCode || '--'} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="admin-control-actions">
                  <label>
                    Admin status
                    <select value={order.adminStatus || 'normal'} onChange={(e) => onUpdateOrder(order.id, { admin_status: e.target.value })}>
                      {ORDER_ADMIN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Order status
                    <select value={order.status || 'pending'} onChange={(e) => onUpdateOrder(order.id, { status: e.target.value })}>
                      {['pending', 'accepted', 'rejected', 'out_for_delivery', 'delivered'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Notes
                    <input value={order.adminNotes || ''} onChange={(e) => onUpdateOrder(order.id, { admin_notes: e.target.value })} placeholder="Admin notes" />
                  </label>
                  <button className={order.adminStatus === 'held' ? 'btn-back' : 'btn-danger'} onClick={() => onUpdateOrder(order.id, { admin_status: order.adminStatus === 'held' ? 'normal' : 'held' })}>
                    {order.adminStatus === 'held' ? 'Release' : 'Hold'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Fraud ─────────────────────────────────────────────────────────────────────
function AdminFraud({ users, shops, orders, reports, reportsLoading, onUpdateUser, onUpdateShop, onUpdateOrder, onUpdateReport }) {
  const signals = buildFraudSignals({ users, shops, orders, reports })
  const riskyUsers = users.filter((u) => u.blocked || u.riskLevel !== 'normal')
  const riskyShops = shops.filter((s) => s.isSuspended || s.verificationStatus === 'rejected' || s.verificationStatus === 'pending')

  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card admin-card-hero">
        <h3>Anti-fraud command desk</h3>
        <p className="admin-hint">Start simple: verify shops, block risky accounts, hold suspicious orders, and resolve reports. This is the free anti-fraud layer before paid KYC or payment verification.</p>
        <div className="admin-command-grid">
          <div className="admin-command-card"><strong>{signals.length}</strong><span>active signals</span></div>
          <div className="admin-command-card"><strong>{riskyUsers.length}</strong><span>watched users</span></div>
          <div className="admin-command-card"><strong>{riskyShops.length}</strong><span>shops to verify</span></div>
          <div className="admin-command-card"><strong>{reports.filter((r) => ['open', 'reviewing'].includes(r.status)).length}</strong><span>open reports</span></div>
        </div>
      </section>

      <section className="admin-card">
        <h3>Signals</h3>
        <div className="admin-activity-list">
          {signals.length === 0 ? <p className="admin-hint">No signals yet.</p> : signals.map((signal) => (
            <div key={signal.id} className="admin-activity-row">
              <div>
                <p className="admin-item-name">{signal.title}</p>
                <p className="admin-item-sub">{signal.detail}</p>
              </div>
              <span className={`admin-risk-pill ${getRiskBadgeClass(signal.level)}`}>{signal.level}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>Reports</h3>
        {reportsLoading ? (
          <p className="empty-message">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="admin-hint">No user reports yet.</p>
        ) : (
          <div className="admin-control-list">
            {reports.map((report) => (
              <article key={report.id} className="admin-control-row">
                <div>
                  <p className="admin-item-name">{report.category.replaceAll('_', ' ')}</p>
                  <p className="admin-item-sub">{report.message || 'No message'}</p>
                  <p className="admin-item-sub">Reporter: {getUserLabel(report.reporterId, users)} · Order: {report.orderId?.slice(0, 8) || '--'}</p>
                </div>
                <div className="admin-control-actions">
                  <select value={report.status} onChange={(e) => onUpdateReport(report.id, { status: e.target.value })}>
                    {REPORT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <input value={report.adminNotes || ''} onChange={(e) => onUpdateReport(report.id, { admin_notes: e.target.value })} placeholder="Resolution notes" />
                  {report.reportedUserId ? <button className="btn-danger" onClick={() => onUpdateUser(report.reportedUserId, { blocked: true, risk_level: 'blocked' })}>Block user</button> : null}
                  {report.shopId ? <button className="btn-danger" onClick={() => onUpdateShop(report.shopId, { is_suspended: true })}>Suspend shop</button> : null}
                  {report.orderId ? <button className="btn-danger" onClick={() => onUpdateOrder(report.orderId, { admin_status: 'held' })}>Hold order</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Contacts ──────────────────────────────────────────────────────────────────
function AdminContacts({ items, itemsLoading }) {
  const [search, setSearch] = useState('')
  const contactRows = useMemo(() => {
    return items.filter((item) => item.phone).map((item) => ({
      id: item.id,
      name: item.sellerName || 'Anonymous',
      phone: item.phone,
      productName: item.productName,
      category: item.category || 'Other',
    }))
  }, [items])

  const filteredContacts = contactRows.filter((row) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [row.name, row.phone, row.productName, row.category].some((v) => String(v).toLowerCase().includes(term))
  })

  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <h3>Registered contacts</h3>
        <div className="admin-search">
          <input type="text" placeholder="Search name, phone, product, category..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="admin-contact-list">
          {itemsLoading ? (
            <p className="empty-message">Loading contacts...</p>
          ) : filteredContacts.length === 0 ? (
            <p className="admin-hint">No contacts found.</p>
          ) : filteredContacts.map((row) => (
            <div key={`${row.id}-${row.phone}`} className="admin-contact-row">
              <div>
                <p className="admin-item-name">{row.name}</p>
                <p className="admin-item-sub">{row.productName}</p>
              </div>
              <div className="admin-contact-actions">
                <a href={`tel:${row.phone}`} className="admin-contact-link">{row.phone}</a>
                <span className="admin-contact-tag">{row.category}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Products ──────────────────────────────────────────────────────────────────
function AdminProducts({ items, itemsLoading }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') || 'All'
  const filteredProducts = activeCategory === 'All' ? items : items.filter((item) => (item.category || 'Other') === activeCategory)

  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <h3>Products by category</h3>
        <div className="admin-category-tabs">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button key={cat} className={`admin-category-tab ${activeCategory === cat ? 'active' : ''}`} onClick={() => setSearchParams(cat === 'All' ? {} : { category: cat })}>
              {cat}
            </button>
          ))}
        </div>
        <div className="admin-product-list">
          {itemsLoading ? (
            <p className="empty-message">Loading products...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="admin-hint">No products in this category.</p>
          ) : filteredProducts.map((item) => {
            const photoUrl = item.photoURL || item.photoURLs?.[0] || ''
            return (
              <Link key={item.id} to={`/admin/products/${item.id}${activeCategory !== 'All' ? `?category=${encodeURIComponent(activeCategory)}` : ''}`} className="admin-item admin-item-link">
                <div className="admin-item-photo">
                  {photoUrl ? <img src={photoUrl} alt={item.productName} loading="lazy" /> : <span>No Photo</span>}
                </div>
                <div className="admin-item-meta">
                  <p className="admin-item-name">{item.productName}</p>
                  <p className="admin-item-sub">{item.category || 'Other'} · {item.status || 'active'}</p>
                </div>
                <strong>UGX {Number(item.price || 0).toLocaleString()}</strong>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Product Edit ──────────────────────────────────────────────────────────────
function buildProductFormData(product) {
  const urls = Array.isArray(product.photoURLs) ? product.photoURLs : []
  const leadPhoto = product.photoURL || urls[0] || ''
  const mergedPhotos = [leadPhoto, ...urls.filter((u) => u && u !== leadPhoto)].filter(Boolean)

  return {
    productName: product.productName || '',
    category: product.category || 'Other',
    condition: product.condition || 'Used - Good',
    price: product.price ?? '',
    description: product.description || '',
    location: product.location || '',
    phone: product.phone || '',
    sellerName: product.sellerName || '',
    status: product.status || 'active',
    photoURLsText: mergedPhotos.join('\n'),
  }
}

function AdminProductEdit({ items, itemsLoading, onUpdateProduct, onDeleteProduct }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const product = items.find((item) => item.id === id)
  const backCategory = searchParams.get('category')
  const backTarget = backCategory ? `/admin/products?category=${encodeURIComponent(backCategory)}` : '/admin/products'

  if (itemsLoading) return <p className="empty-message">Loading product...</p>
  if (!product) return (
    <section className="admin-card">
      <h3>Product not found</h3>
      <button className="btn-back" onClick={() => navigate(backTarget)}>Back to products</button>
    </section>
  )

  return (
    <AdminProductEditForm
      key={product.id}
      product={product}
      backTarget={backTarget}
      onUpdateProduct={onUpdateProduct}
      onDeleteProduct={onDeleteProduct}
    />
  )
}

function AdminProductEditForm({ product, backTarget, onUpdateProduct, onDeleteProduct }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(() => buildProductFormData(product))
  const [localError, setLocalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    setSaving(true)
    const price = Number(formData.price)
    if (!Number.isFinite(price) || price < 0) {
      setLocalError('Price must be a valid number.')
      setSaving(false)
      return
    }
    const photoURLs = formData.photoURLsText.split('\n').map((u) => u.trim()).filter(Boolean)
    const payload = {
      productName: formData.productName.trim(),
      category: formData.category,
      condition: formData.condition,
      price,
      description: formData.description.trim(),
      location: formData.location.trim(),
      phone: formData.phone.trim(),
      sellerName: formData.sellerName.trim(),
      status: formData.status,
      photoURL: photoURLs[0] || '',
      photoURLs,
      updatedAt: new Date(),
    }
    const success = await onUpdateProduct(product.id, payload)
    setSaving(false)
    if (success) navigate(backTarget)
    else setLocalError('Could not save product changes.')
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${product.productName}"? This cannot be undone.`)) return
    setLocalError('')
    setDeleting(true)
    const success = await onDeleteProduct(product.id)
    setDeleting(false)
    if (success) navigate(backTarget)
    else setLocalError('Could not delete this product.')
  }

  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <div className="admin-edit-header">
          <div>
            <h3>Edit product</h3>
            <p className="admin-hint">Changes are saved immediately to Supabase.</p>
          </div>
          <div className="admin-edit-actions">
            <button className="btn-back" type="button" onClick={() => navigate(backTarget)}>Back</button>
            <button className="btn-danger" type="button" onClick={handleDelete} disabled={deleting || saving}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product name</label>
            <input name="productName" value={formData.productName} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group half">
              <label>Condition</label>
              <select name="condition" value={formData.condition} onChange={handleChange}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>Price (UGX)</label>
              <input name="price" type="number" min="0" value={formData.price} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" rows="4" value={formData.description} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group half">
              <label>Seller name</label>
              <input name="sellerName" value={formData.sellerName} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label>Phone</label>
              <input name="phone" value={formData.phone} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input name="location" value={formData.location} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Photo URLs (one per line)</label>
            <textarea name="photoURLsText" rows="4" value={formData.photoURLsText} onChange={handleChange} />
          </div>
          {localError ? <p className="admin-error">{localError}</p> : null}
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </section>
    </div>
  )
}

// ── Advert Studio ─────────────────────────────────────────────────────────────
function AdminAdvertStudio({ siteContent, onSiteContentChange, onPublishAdvert, onDisableAdvert }) {
  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <h3>Advert studio</h3>
        <p className="admin-hint">Create a homepage advert. Visitors see it immediately — close button appears after the delay.</p>
        <label className="admin-toggle">
          <input type="checkbox" name="promoEnabled" checked={siteContent.promoEnabled} onChange={onSiteContentChange} />
          <span>Advert enabled</span>
        </label>
        <div className="form-group">
          <label>Eyebrow (small label above headline)</label>
          <input name="promoEyebrow" value={siteContent.promoEyebrow} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Headline</label>
          <input name="promoTitle" value={siteContent.promoTitle} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea name="promoMessage" rows="4" value={siteContent.promoMessage} onChange={onSiteContentChange} />
        </div>
        <div className="form-row">
          <div className="form-group half">
            <label>Button label</label>
            <input name="promoCtaLabel" value={siteContent.promoCtaLabel} onChange={onSiteContentChange} />
          </div>
          <div className="form-group half">
            <label>Button URL</label>
            <input name="promoCtaUrl" value={siteContent.promoCtaUrl} onChange={onSiteContentChange} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group half">
            <label>Close delay (seconds)</label>
            <input name="promoCloseDelaySeconds" type="number" min="0" value={siteContent.promoCloseDelaySeconds} onChange={onSiteContentChange} />
          </div>
          <div className="form-group half">
            <label>Duration (hours)</label>
            <input name="promoDurationHours" type="number" min="1" value={siteContent.promoDurationHours} onChange={onSiteContentChange} />
          </div>
        </div>
        <div className="admin-deploy-actions">
          <button className="btn-primary" onClick={onPublishAdvert}>Publish advert</button>
          <button className="btn-back" onClick={onDisableAdvert}>Remove advert</button>
        </div>
      </section>

      <section className="admin-card">
        <h3>Live preview</h3>
        <div className="admin-ad-preview admin-ad-preview-live">
          <button className="admin-ad-close" type="button" disabled>×</button>
          <p className="market-promo-eyebrow">{siteContent.promoEyebrow || 'Eyebrow text'}</p>
          <h4>{siteContent.promoTitle || 'Headline goes here'}</h4>
          <p>{siteContent.promoMessage || 'Message goes here...'}</p>
          <span className="admin-preview-cta">{siteContent.promoCtaLabel || 'Button label'}</span>
        </div>
        <div className="admin-checklist">
          <p>Close button appears after {siteContent.promoCloseDelaySeconds || 3} seconds.</p>
          <p>Advert stays live for {siteContent.promoDurationHours || 24} hours unless removed earlier.</p>
          <p>Publishing creates a new version — users see the update on next visit.</p>
        </div>
      </section>
    </div>
  )
}

// ── Website Settings ──────────────────────────────────────────────────────────
function AdminWebsiteSettings({ siteContent, onSiteContentChange, onSaveSiteContent }) {
  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <h3>Homepage announcement</h3>
        <label className="admin-toggle">
          <input type="checkbox" name="announcementEnabled" checked={siteContent.announcementEnabled} onChange={onSiteContentChange} />
          <span>Show announcement hero</span>
        </label>
        <div className="form-group">
          <label>Badge</label>
          <input name="announcementBadge" value={siteContent.announcementBadge} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Title</label>
          <input name="announcementTitle" value={siteContent.announcementTitle} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea name="announcementMessage" rows="4" value={siteContent.announcementMessage} onChange={onSiteContentChange} />
        </div>
        <div className="form-row">
          <div className="form-group half">
            <label>Button label</label>
            <input name="announcementCtaLabel" value={siteContent.announcementCtaLabel} onChange={onSiteContentChange} />
          </div>
          <div className="form-group half">
            <label>Button URL</label>
            <input name="announcementCtaUrl" value={siteContent.announcementCtaUrl} onChange={onSiteContentChange} />
          </div>
        </div>
      </section>

      <section className="admin-card">
        <h3>Footer and support info</h3>
        <label className="admin-toggle">
          <input type="checkbox" name="infoBarEnabled" checked={siteContent.infoBarEnabled} onChange={onSiteContentChange} />
          <span>Show info bar</span>
        </label>
        <div className="form-group">
          <label>Info bar text</label>
          <textarea name="infoBarText" rows="3" value={siteContent.infoBarText} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Support heading</label>
          <input name="supportLabel" value={siteContent.supportLabel} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>Support phone</label>
          <input name="supportPhone" value={siteContent.supportPhone} onChange={onSiteContentChange} />
        </div>
        <div className="form-group">
          <label>WhatsApp preset message</label>
          <textarea name="supportWhatsappMessage" rows="3" value={siteContent.supportWhatsappMessage} onChange={onSiteContentChange} />
        </div>
        <button className="btn-primary admin-save-button" onClick={onSaveSiteContent}>Save website settings</button>
      </section>
    </div>
  )
}

// ── Publish ───────────────────────────────────────────────────────────────────
function AdminPublish({
  deploying, deployOutput, deployCommand, terminalInput, terminalShell,
  terminalStatus, isLocalhost, onCopyDeployCommand, onRunDeploy,
  onTerminalInputChange, onTerminalShellChange, onRunTerminalCommand, onClearTerminal,
}) {
  const selectedCommand = TERMINAL_COMMANDS.find((c) => c.id === deployCommand) || TERMINAL_COMMANDS[0]
  const terminalReady = terminalStatus === 'online'

  return (
    <div className="admin-section-grid admin-section-grid-wide">
      <section className="admin-card">
        <div className="admin-terminal-heading">
          <div>
            <h3>Publish terminal</h3>
            <p className="admin-hint">Run deploy commands through your local Garuga deploy bridge.</p>
          </div>
          <span className={`admin-terminal-status ${terminalReady ? 'online' : 'offline'}`}>
            {terminalReady ? 'Connected' : terminalStatus === 'checking' ? 'Checking' : 'Offline'}
          </span>
        </div>
        {!terminalReady ? <p className="admin-hint">Start the bridge with <code>npm --prefix client run admin:server</code>, then open this page on localhost.</p> : null}
        {!isLocalhost ? <p className="admin-hint">One-click publishing works best from localhost:5173/admin/publish — browsers may block local terminal access from the live site.</p> : null}
        <div className="admin-terminal-options">
          {TERMINAL_COMMANDS.map((cmd) => (
            <button key={cmd.id} type="button" className={`admin-terminal-option ${deployCommand === cmd.id ? 'active' : ''}`} onClick={() => onRunDeploy(cmd.id, { previewOnly: true })} disabled={deploying}>
              <strong>{cmd.label}</strong>
              <span>{cmd.description}</span>
            </button>
          ))}
        </div>
        <div className="admin-deploy-actions">
          <button className="btn-back" onClick={onCopyDeployCommand}>Copy command</button>
          <button className="btn-primary" onClick={() => onRunDeploy(deployCommand)} disabled={!terminalReady || deploying}>
            {deploying ? 'Running...' : selectedCommand.label}
          </button>
        </div>
        <div className="admin-terminal">
          <div className="admin-terminal-topbar">
            <span>Garuga local terminal</span>
            <span>{ADMIN_TERMINAL_URL}</span>
          </div>
          <pre className="admin-pre admin-terminal-command">{buildDeployCommand(deployCommand)}</pre>
          <pre className="admin-pre admin-pre-output">{deployOutput || 'Ready. Choose a command above, then run it.'}</pre>
          <form className="admin-terminal-form" onSubmit={onRunTerminalCommand}>
            <select value={terminalShell} onChange={onTerminalShellChange} disabled={deploying} aria-label="Shell">
              <option value="powershell">PowerShell</option>
              <option value="cmd">CMD</option>
            </select>
            <span>{terminalShell === 'cmd' ? 'CMD' : 'PS'}</span>
            <input value={terminalInput} onChange={onTerminalInputChange} disabled={!terminalReady || !isLocalhost || deploying} placeholder={terminalShell === 'cmd' ? 'Type a CMD command...' : 'Type a PowerShell command...'} autoComplete="off" />
            <button type="submit" className="btn-primary" disabled={!terminalReady || !isLocalhost || deploying}>Run</button>
            <button type="button" className="btn-back" onClick={onClearTerminal} disabled={deploying}>Clear</button>
          </form>
        </div>
      </section>

      <section className="admin-card">
        <h3>How it connects</h3>
        <p className="admin-hint">The site is static and cannot run PowerShell by itself. The local bridge listens only on your computer and only accepts the publish commands above.</p>
        <div className="admin-checklist">
          <p>Keep <code>npm --prefix client run admin:server</code> running while you publish locally.</p>
          <p>Use <strong>Publish site</strong> for normal updates after saving content or code changes.</p>
          <p>If your Cloudflare Pages project is connected to Git, pushing to the production branch can publish without using the local terminal.</p>
        </div>
      </section>
    </div>
  )
}

// ── Main AdminPage ────────────────────────────────────────────────────────────
function AdminPage() {
  const [user, setUser] = useState(null)
  const authLoading = false
  const [adminKey, setAdminKey] = useState('')
  const [authError, setAuthError] = useState('')

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [shops, setShops] = useState([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [siteContent, setSiteContent] = useState(defaultSiteContent)
  const [contentLoading, setContentLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployOutput, setDeployOutput] = useState('')
  const [deployCommand, setDeployCommand] = useState('publishAll')
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalShell, setTerminalShell] = useState('powershell')
  const [terminalStatus, setTerminalStatus] = useState('checking')
  useEffect(() => {
    try {
      if (ADMIN_AUTH_BYPASS) {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'admin-bypass')
        setUser({ uid: 'admin-bypass', email: 'Admin bypass access' })
        return
      }

      if (window.sessionStorage.getItem(ADMIN_SESSION_KEY)) {
        setUser({ uid: 'admin-key', email: 'Admin key access' })
      }
    } catch {
      // Ignore session storage failures.
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadDashboardData()
    loadUsers()
    loadShops()
    loadOrders()
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  useEffect(() => {
    let cancelled = false
    async function checkTerminal() {
      setTerminalStatus('checking')
      try {
        const response = await fetch(`${ADMIN_TERMINAL_URL}/health`)
        if (!cancelled) setTerminalStatus(response.ok ? 'online' : 'offline')
      } catch {
        if (!cancelled) setTerminalStatus('offline')
      }
    }
    checkTerminal()
    const id = window.setInterval(checkTerminal, 10000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  const loadDashboardData = async () => {
    setItemsLoading(true)
    setContentLoading(true)
    setSaveError('')
    try {
      const [nextItems, nextSiteContent] = await Promise.all([listAdminItems(), getSiteContent()])
      setItems(nextItems)
      setSiteContent(nextSiteContent ? mergeSiteContent(nextSiteContent) : defaultSiteContent)
    } catch (error) {
      console.error('Error loading admin data:', error)
      setSaveError('Could not load admin data. Check Supabase tables and policies.')
    } finally {
      setItemsLoading(false)
      setContentLoading(false)
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      setUsers(await listAdminProfiles())
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const loadShops = async () => {
    setShopsLoading(true)
    try {
      setShops(await listAdminShops())
    } catch (error) {
      console.error('Error loading shops:', error)
      setSaveError('Could not load shops. Run the latest Supabase upgrade SQL.')
    } finally {
      setShopsLoading(false)
    }
  }

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      setOrders(await listAdminOrders())
    } catch (error) {
      console.error('Error loading orders:', error)
      setSaveError('Could not load orders. Run the latest Supabase upgrade SQL.')
    } finally {
      setOrdersLoading(false)
    }
  }

  const loadReports = async () => {
    setReportsLoading(true)
    try {
      setReports(await listAdminReports())
    } catch (error) {
      console.error('Error loading reports:', error)
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }

  const saveSiteContent = async (data, successMessage = 'Website content saved.') => {
    setSaveError('')
    setSaveSuccess('')
    try {
      await saveSupabaseSiteContent(data, null)
      setSiteContent(mergeSiteContent(data))
      setSaveSuccess(successMessage)
      return true
    } catch (error) {
      console.error('Save error:', error)
      setSaveError('Could not save changes. Verify Supabase site_content policy.')
      return false
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    const cleanKey = adminKey.replace(/\D/g, '')

    if (cleanKey.length !== 15) {
      setAuthError('Enter the full 15-digit admin key.')
      return
    }

    try {
      const client = requireSupabase()
      const { data, error } = await client.functions.invoke('verify-admin-key', {
        body: { key: cleanKey },
      })

      if (error || !data?.ok) {
        setAuthError('Wrong admin key, or the Supabase ADMIN_KEY_HASH secret has not been updated/deployed.')
        return
      }

      window.sessionStorage.setItem(ADMIN_SESSION_KEY, cleanKey)
      setUser({ uid: 'admin-key', email: 'Admin key access' })
      setAdminKey('')
    } catch (error) {
      console.error('Auth error:', error)
      setAuthError('Could not reach the Supabase verify-admin-key function. Deploy the function and ADMIN_KEY_HASH secret, then try again.')
    }
  }

  const handleSignOut = () => {
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
    } catch {
      // Ignore session storage failures.
    }
    setUser(null)
    setItems([])
    setUsers([])
    setShops([])
    setOrders([])
    setReports([])
    setSiteContent(defaultSiteContent)
  }

  const handleSiteContentChange = (e) => {
    const { name, value, type, checked } = e.target
    setSiteContent((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setSaveSuccess('')
  }

  const handlePublishAdvert = async () => {
    const { publishedAt, expiresAt } = buildAdvertDates(siteContent.promoDurationHours)
    await saveSiteContent({ ...siteContent, promoEnabled: true, promoPublishedAt: publishedAt, promoExpiresAt: expiresAt, promoVersion: `${publishedAt.getTime()}` }, 'Advert published.')
  }

  const handleDisableAdvert = async () => {
    await saveSiteContent({ ...siteContent, promoEnabled: false }, 'Advert removed.')
  }

  const handleUpdateProduct = async (id, payload) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      const dbPayload = {
        product_name: payload.productName,
        category: payload.category,
        condition: payload.condition,
        price: Number(payload.price || 0),
        description: payload.description || '',
        location: payload.location || '',
        phone: payload.phone || '',
        seller_name: payload.sellerName || '',
        photo_urls: payload.photoURLs || [],
        status: payload.status || 'active',
        updated_at: new Date().toISOString(),
      }
      const updatedItem = await updateAdminItem(id, dbPayload)
      setItems((prev) => prev.map((item) => (item.id === id ? updatedItem : item)))
      setSaveSuccess('Product updated.')
      return true
    } catch (error) {
      console.error('Update error:', error)
      setSaveError('Could not update product.')
      return false
    }
  }

  const handleDeleteProduct = async (id) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      await deleteAdminItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setSaveSuccess('Product deleted.')
      return true
    } catch (error) {
      console.error('Delete error:', error)
      setSaveError('Could not delete product.')
      return false
    }
  }

  const handleUpdateUser = async (id, payload) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      const updatedUser = await updateAdminProfile(id, payload)
      setUsers((prev) => prev.map((entry) => (entry.id === id ? updatedUser : entry)))
      setSaveSuccess('User updated.')
      return true
    } catch (error) {
      console.error('User update error:', error)
      setSaveError('Could not update user. Check profile policies.')
      return false
    }
  }

  const handleDeleteUser = async (id) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      await deleteAdminProfile(id)
      setUsers((prev) => prev.filter((entry) => entry.id !== id))
      setSaveSuccess('Profile deleted. If the auth account still exists, remove it later in Supabase Auth admin.')
      return true
    } catch (error) {
      console.error('User delete error:', error)
      setSaveError('Could not delete profile. Supabase Auth user may still need manual deletion.')
      return false
    }
  }

  const handleCreateUser = async () => {
    return { ok: false, error: 'Create buyer, seller, and delivery accounts from the normal signup page so Supabase Auth owns the account.' }
  }

  const handleUpdateShop = async (id, payload) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      const updatedShop = await updateAdminShop(id, payload)
      setShops((prev) => prev.map((shop) => (shop.id === id ? updatedShop : shop)))
      setSaveSuccess('Shop updated.')
      return true
    } catch (error) {
      console.error('Shop update error:', error)
      setSaveError('Could not update shop.')
      return false
    }
  }

  const handleDeleteShop = async (id) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      await deleteAdminShop(id)
      setShops((prev) => prev.filter((shop) => shop.id !== id))
      setSaveSuccess('Shop deleted.')
      return true
    } catch (error) {
      console.error('Shop delete error:', error)
      setSaveError('Could not delete shop.')
      return false
    }
  }

  const handleUpdateOrder = async (id, payload) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      const updatedOrder = await updateAdminOrder(id, payload)
      setOrders((prev) => prev.map((order) => (order.id === id ? updatedOrder : order)))
      setSaveSuccess('Order updated.')
      return true
    } catch (error) {
      console.error('Order update error:', error)
      setSaveError('Could not update order.')
      return false
    }
  }

  const handleUpdateReport = async (id, payload) => {
    setSaveError('')
    setSaveSuccess('')
    try {
      const updatedReport = await updateAdminReport(id, payload)
      setReports((prev) => prev.map((report) => (report.id === id ? updatedReport : report)))
      setSaveSuccess('Report updated.')
      return true
    } catch (error) {
      console.error('Report update error:', error)
      setSaveError('Could not update report.')
      return false
    }
  }

  const handleCopyDeployCommand = async () => {
    try {
      await navigator.clipboard.writeText(buildDeployCommand(deployCommand))
      setDeployOutput('Copied deploy command to clipboard.')
    } catch {
      setDeployOutput('Could not copy. Use the command block below.')
    }
  }

  const handleRunDeploy = async (commandId = deployCommand, options = {}) => {
    setDeployCommand(commandId)
    if (options.previewOnly) { setDeployOutput(''); return }
    setDeploying(true)
    setDeployOutput(`> ${buildDeployCommand(commandId)}\n\nRunning...`)
    try {
      const response = await fetch(`${ADMIN_TERMINAL_URL}/run-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId }),
      })
      const text = await response.text()
      setDeployOutput(text || (response.ok ? 'Command completed.' : 'Command failed.'))
      setTerminalStatus(response.ok ? 'online' : 'offline')
    } catch {
      setTerminalStatus('offline')
      setDeployOutput('Could not reach the local terminal. Run: npm --prefix client run admin:server')
    } finally {
      setDeploying(false)
    }
  }

  const handleRunTerminalCommand = async (e) => {
    e.preventDefault()
    const command = terminalInput.trim()
    if (!command) return
    setDeploying(true)
    setDeployOutput(`${terminalShell === 'cmd' ? 'CMD' : 'PS'} ${command}\n\n`)
    try {
      const response = await fetch(`${ADMIN_TERMINAL_URL}/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, shell: terminalShell }),
      })
      if (!response.body) {
        const text = await response.text()
        setDeployOutput(text || (response.ok ? 'Command completed.' : 'Command failed.'))
        setTerminalStatus(response.ok ? 'online' : 'offline')
        return
      }
      setDeployOutput('')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        setDeployOutput((prev) => prev + decoder.decode(value, { stream: true }))
      }
      setDeployOutput((prev) => prev + decoder.decode())
      setTerminalStatus(response.ok ? 'online' : 'offline')
    } catch {
      setTerminalStatus('offline')
      setDeployOutput('Could not reach the local terminal. Run: npm --prefix client run admin:server')
    } finally {
      setDeploying(false)
    }
  }

  const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

  if (authLoading) return <p className="empty-message">Loading admin...</p>

  if (!user) {
    return (
      <LoginPanel
        adminKey={adminKey}
        authError={authError}
        onAdminKeyChange={(e) => setAdminKey(e.target.value.replace(/\D/g, '').slice(0, 15))}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <AdminLayout
      user={user} items={items} itemsLoading={itemsLoading}
      users={users} usersLoading={usersLoading}
      shops={shops} shopsLoading={shopsLoading}
      orders={orders} ordersLoading={ordersLoading}
      reports={reports} reportsLoading={reportsLoading}
      siteContent={siteContent} saveError={saveError} saveSuccess={saveSuccess}
      contentLoading={contentLoading} onRefresh={() => { loadDashboardData(); loadUsers(); loadShops(); loadOrders(); loadReports() }}
      onSignOut={handleSignOut} onSaveSiteContent={() => saveSiteContent(siteContent, 'Website settings saved.')}
      onPublishAdvert={handlePublishAdvert} onDisableAdvert={handleDisableAdvert}
      onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct}
      onDeleteUser={handleDeleteUser} onCreateUser={handleCreateUser} onUpdateUser={handleUpdateUser}
      onUpdateShop={handleUpdateShop} onDeleteShop={handleDeleteShop}
      onUpdateOrder={handleUpdateOrder} onUpdateReport={handleUpdateReport}
      onCopyDeployCommand={handleCopyDeployCommand} onRunDeploy={handleRunDeploy}
      deploying={deploying} deployOutput={deployOutput} deployCommand={deployCommand}
      terminalInput={terminalInput} terminalShell={terminalShell} terminalStatus={terminalStatus}
      isLocalhost={isLocalhost}
      onTerminalInputChange={(e) => setTerminalInput(e.target.value)}
      onTerminalShellChange={(e) => setTerminalShell(e.target.value)}
      onRunTerminalCommand={handleRunTerminalCommand} onClearTerminal={() => setDeployOutput('')}
      onSiteContentChange={handleSiteContentChange}
    />
  )
}

export default AdminPage
