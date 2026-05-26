import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import AddItemPage from './pages/AddItemPage'
import ProductDetail from './pages/ProductDetail'
import AuthPage from './pages/AuthPage'
import AboutPage from './pages/AboutPage'
import DashboardRedirect from './pages/DashboardRedirect'
import SellerDashboard from './pages/SellerDashboard'
import SellerOrders from './pages/seller/SellerOrders'
import SellerInventory from './pages/seller/SellerInventory'
import SellerProductEditor from './pages/seller/SellerProductEditor'
import SellerSettings from './pages/seller/SellerSettings'
import BuyerDashboard from './pages/BuyerDashboard'
import BuyerOrders from './pages/buyer/BuyerOrders'
import BuyerShops from './pages/buyer/BuyerShops'
import BuyerCart from './pages/buyer/BuyerCart'
import DeliveryDashboard from './pages/DeliveryDashboard'
import DeliveryAvailable from './pages/delivery/DeliveryAvailable'
import DeliveryActive from './pages/delivery/DeliveryActive'
import ShopPage from './pages/ShopPage'
import ShopProductPage from './pages/ShopProductPage'
import OrderTrackingPage from './pages/OrderTrackingPage'

const AdminPage = lazy(() => import('./pages/AdminPage'))

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem('garuga-theme')
      return saved === 'dark' || saved === 'light' ? saved : 'light'
    } catch {
      return 'light'
    }
  })
  const location = useLocation()
  const isHomeRoute = location.pathname === '/'
  const isProductRoute = location.pathname.startsWith('/product/')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem('garuga-theme', theme)
    } catch {
      // Ignore storage failures.
    }
  }, [theme])

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`
    const authPaths = ['/login', '/signup']

    if (authPaths.includes(location.pathname)) {
      return
    }

    try {
      window.localStorage.setItem('garuga-last-page', path)
    } catch {
      // Ignore storage failures.
    }
  }, [location.hash, location.pathname, location.search])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return (
    <AuthProvider>
      <Header theme={theme} onToggleTheme={toggleTheme} hideSellLinks={isProductRoute} />
      <main className={isHomeRoute ? 'home-main' : ''}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          
          {/* Seller Dashboard & Sub-pages */}
          <Route path="/dashboard/seller" element={<ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/seller/orders" element={<ProtectedRoute role="seller"><SellerOrders /></ProtectedRoute>} />
          <Route path="/dashboard/seller/inventory" element={<ProtectedRoute role="seller"><SellerInventory /></ProtectedRoute>} />
          <Route path="/dashboard/seller/products/new" element={<ProtectedRoute role="seller"><SellerProductEditor /></ProtectedRoute>} />
          <Route path="/dashboard/seller/products/:productId/edit" element={<ProtectedRoute role="seller"><SellerProductEditor /></ProtectedRoute>} />
          <Route path="/dashboard/seller/settings" element={<ProtectedRoute role="seller"><SellerSettings /></ProtectedRoute>} />

          {/* Buyer Dashboard & Sub-pages */}
          <Route path="/dashboard/buyer" element={<ProtectedRoute role="buyer"><BuyerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/buyer/orders" element={<ProtectedRoute role="buyer"><BuyerOrders /></ProtectedRoute>} />
          <Route path="/dashboard/buyer/shops" element={<ProtectedRoute role="buyer"><BuyerShops /></ProtectedRoute>} />
          <Route path="/dashboard/buyer/cart" element={<ProtectedRoute role="buyer"><BuyerCart /></ProtectedRoute>} />
          <Route path="/cart" element={<BuyerCart />} />

          {/* Delivery Dashboard & Sub-pages */}
          <Route path="/dashboard/delivery" element={<ProtectedRoute role="delivery"><DeliveryDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/delivery/available" element={<ProtectedRoute role="delivery"><DeliveryAvailable /></ProtectedRoute>} />
          <Route path="/dashboard/delivery/active" element={<ProtectedRoute role="delivery"><DeliveryActive /></ProtectedRoute>} />
          <Route path="/shop/:shopId" element={<ShopPage />} />
          <Route path="/shop/:shopId/product/:productId" element={<ShopProductPage />} />
          <Route path="/order/:orderId" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
          <Route path="/add" element={<ProtectedRoute><AddItemPage /></ProtectedRoute>} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/admin/*" element={<Suspense fallback={<p className="empty-message">Loading admin...</p>}><AdminPage /></Suspense>} />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  )
}

export default App
