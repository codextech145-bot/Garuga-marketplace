export const CART_STORAGE_KEY = 'garuga-shop-cart'

export function readCart() {
  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function writeCart(cart) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  } catch {
    // Ignore storage failures.
  }
}

export function addCartItem(cart, item) {
  const safeQuantity = Math.max(1, Number(item.quantity || 1))
  const existing = cart.find((cartItem) => cartItem.productId === item.productId && cartItem.shopId === item.shopId)

  if (existing) {
    return cart.map((cartItem) =>
      cartItem === existing
        ? { ...cartItem, quantity: Number(cartItem.quantity || 1) + safeQuantity }
        : cartItem
    )
  }

  return [...cart, { ...item, quantity: safeQuantity }]
}

export function getCartCount(cart) {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
}

export function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0)
}

export function createCartBatchId() {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getOrderBatchId(order) {
  return order?.items?.find((item) => item.cartBatchId)?.cartBatchId || ''
}
