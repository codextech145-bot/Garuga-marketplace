import { supabase } from '../config/supabase'

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || ''

export const ROLES = ['buyer', 'seller', 'delivery']

export const DELIVERY_CATEGORIES = [
  {
    id: 'all',
    label: 'All delivery jobs',
    shortLabel: 'All',
    description: 'Show me boda, car, and truck delivery bookings.',
  },
  {
    id: 'boda',
    label: 'Boda / motorcycle',
    shortLabel: 'Boda',
    description: 'Best for food, groceries, small parcels, and quick local trips.',
  },
  {
    id: 'car',
    label: 'Car / small vehicle',
    shortLabel: 'Car',
    description: 'Good for medium goods that need more space or safer transport.',
  },
  {
    id: 'truck',
    label: 'Big car / truck',
    shortLabel: 'Truck',
    description: 'For hardware, construction materials, bulky goods, and big loads.',
  },
]

export function getDeliveryCategory(categoryId) {
  return DELIVERY_CATEGORIES.find((category) => category.id === categoryId) || DELIVERY_CATEGORIES[1]
}

export const BUSINESS_CATEGORIES = [
  {
    id: 'food',
    label: 'Food & Restaurants',
    description: 'Menus, daily specials, prep time, pickup and delivery orders.',
    features: ['Menu items', 'Availability toggle', 'Order accept/reject', 'Prep time'],
    itemLabel: 'menu item',
    settingsFields: [
      { name: 'prepTime', label: 'Average prep time', placeholder: 'e.g. 25 minutes' },
      { name: 'serviceModes', label: 'Service modes', placeholder: 'e.g. Delivery, pickup, dine-in' },
      { name: 'dailySpecial', label: 'Daily special', placeholder: 'e.g. Pilau combo today' },
    ],
    productFields: [
      { name: 'prepTime', label: 'Prep time', placeholder: 'e.g. 15 minutes' },
      { name: 'mealType', label: 'Meal type', type: 'select', options: ['Main meal', 'Snack', 'Drink', 'Dessert', 'Combo'] },
      { name: 'isDailySpecial', label: 'Daily special', type: 'checkbox' },
    ],
  },
  {
    id: 'retail',
    label: 'Retail Shop',
    description: 'General shop products with stock, prices, photos, and shop QR sharing.',
    features: ['Product catalog', 'Stock count', 'Featured items', 'Shop QR'],
    itemLabel: 'product',
    settingsFields: [
      { name: 'shopTagline', label: 'Shop tagline', placeholder: 'e.g. Everyday household goods' },
      { name: 'pickupPoint', label: 'Pickup point', placeholder: 'e.g. Opposite Garuga stage' },
    ],
    productFields: [
      { name: 'stockCount', label: 'Stock count', type: 'number', placeholder: 'e.g. 12' },
      { name: 'brand', label: 'Brand', placeholder: 'e.g. Nice, Movit, Unilever' },
      { name: 'featured', label: 'Featured item', type: 'checkbox' },
    ],
  },
  {
    id: 'grocery',
    label: 'Groceries',
    description: 'Basket orders, household essentials, delivery zones, and substitutions.',
    features: ['Cart orders', 'Item categories', 'Delivery zones', 'Substitutions'],
    itemLabel: 'grocery item',
    settingsFields: [
      { name: 'deliveryZones', label: 'Delivery zones', placeholder: 'e.g. Garuga, Nkumba, Abaita' },
      { name: 'substitutionPolicy', label: 'Substitution policy', placeholder: 'e.g. Call buyer before replacing item' },
    ],
    productFields: [
      { name: 'groceryCategory', label: 'Grocery category', type: 'select', options: ['Fresh food', 'Dry goods', 'Drinks', 'Household', 'Personal care'] },
      { name: 'unit', label: 'Unit', placeholder: 'e.g. kg, bunch, pack, bottle' },
      { name: 'allowSubstitution', label: 'Allow substitution', type: 'checkbox' },
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy / Health',
    description: 'Verified health sellers with safe call-first and prescription-aware flows.',
    features: ['Verified badge', 'Prescription toggle', 'Call first', 'Safety notes'],
    itemLabel: 'health item',
    settingsFields: [
      { name: 'licenseNote', label: 'License / verification note', placeholder: 'e.g. Registered pharmacy in Entebbe' },
      { name: 'consultationPhone', label: 'Consultation phone', placeholder: 'e.g. +256...' },
      { name: 'safetyNote', label: 'Safety note', placeholder: 'e.g. Prescription medicine requires pharmacist confirmation' },
    ],
    productFields: [
      { name: 'requiresPrescription', label: 'Requires prescription', type: 'checkbox' },
      { name: 'healthCategory', label: 'Health category', type: 'select', options: ['Medicine', 'First aid', 'Baby care', 'Personal care', 'Wellness'] },
      { name: 'callFirst', label: 'Buyer should call first', type: 'checkbox' },
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware',
    description: 'Construction supplies, bulk units, quote requests, and delivery needs.',
    features: ['Bulk pricing', 'Quote requests', 'Unit types', 'Truck delivery'],
    itemLabel: 'hardware item',
    settingsFields: [
      { name: 'quoteInstructions', label: 'Quote instructions', placeholder: 'e.g. Send quantities for site quote' },
      { name: 'truckDelivery', label: 'Truck delivery available', type: 'checkbox' },
    ],
    productFields: [
      { name: 'unitType', label: 'Unit type', type: 'select', options: ['Piece', 'Bag', 'Kg', 'Meter', 'Bundle', 'Trip'] },
      { name: 'bulkPrice', label: 'Bulk price note', placeholder: 'e.g. Discount after 20 bags' },
      { name: 'quoteOnly', label: 'Quote request only', type: 'checkbox' },
      { name: 'needsTruck', label: 'Needs truck delivery', type: 'checkbox' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Bookings and requests for skilled work, repairs, salons, and local services.',
    features: ['Service list', 'Bookings', 'Portfolio', 'Service area'],
    itemLabel: 'service',
    settingsFields: [
      { name: 'serviceArea', label: 'Service area', placeholder: 'e.g. Garuga, Entebbe, Kajjansi' },
      { name: 'bookingHours', label: 'Booking hours', placeholder: 'e.g. Mon-Sat, 8am-7pm' },
    ],
    productFields: [
      { name: 'priceType', label: 'Price type', type: 'select', options: ['Fixed price', 'Starts from', 'Quote after inspection'] },
      { name: 'duration', label: 'Duration', placeholder: 'e.g. 2 hours' },
      { name: 'portfolioNote', label: 'Portfolio note', placeholder: 'e.g. Ask for photos on WhatsApp' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    description: 'Clothes, shoes, and accessories with size, color, and photo galleries.',
    features: ['Sizes', 'Colors', 'Gallery', 'Variants'],
    itemLabel: 'fashion item',
    settingsFields: [
      { name: 'fittingPolicy', label: 'Fitting / return policy', placeholder: 'e.g. Fitting allowed at pickup' },
      { name: 'targetStyle', label: 'Style focus', placeholder: 'e.g. Women, men, children, school wear' },
    ],
    productFields: [
      { name: 'sizes', label: 'Sizes', placeholder: 'e.g. S, M, L, XL' },
      { name: 'colors', label: 'Colors', placeholder: 'e.g. Black, blue, red' },
      { name: 'genderAge', label: 'Gender / age', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'] },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    description: 'Devices and accessories with specs, condition, and warranty details.',
    features: ['Specs', 'Condition', 'Warranty', 'Inspection'],
    itemLabel: 'electronic item',
    settingsFields: [
      { name: 'inspectionPolicy', label: 'Inspection policy', placeholder: 'e.g. Buyer can test before paying' },
      { name: 'warrantyPolicy', label: 'Warranty policy', placeholder: 'e.g. 7 days shop warranty' },
    ],
    productFields: [
      { name: 'condition', label: 'Condition', type: 'select', options: ['New', 'Like new', 'Used - good', 'Used - fair'] },
      { name: 'warranty', label: 'Warranty', placeholder: 'e.g. 7 days, 1 month, none' },
      { name: 'specs', label: 'Specs', placeholder: 'e.g. 128GB, 8GB RAM, dual SIM' },
    ],
  },
  {
    id: 'gas_water',
    label: 'Gas / Water',
    description: 'Refills and recurring household delivery for gas cylinders and water.',
    features: ['Refill sizes', 'Fast reorder', 'Recurring orders', 'Address required'],
    itemLabel: 'refill item',
    settingsFields: [
      { name: 'deliveryCoverage', label: 'Delivery coverage', placeholder: 'e.g. Garuga and nearby villages' },
      { name: 'recurringOrders', label: 'Recurring orders available', type: 'checkbox' },
    ],
    productFields: [
      { name: 'refillSize', label: 'Refill size', placeholder: 'e.g. 6kg, 12kg, 20L jerrycan' },
      { name: 'depositRequired', label: 'Deposit required', type: 'checkbox' },
      { name: 'fastReorder', label: 'Fast reorder item', type: 'checkbox' },
    ],
  },
]

export function getBusinessCategory(categoryId) {
  return BUSINESS_CATEGORIES.find((category) => category.id === categoryId) || BUSINESS_CATEGORIES[0]
}

export function getSellerLanguage(categoryId) {
  const language = {
    food: {
      collection: 'My menu',
      collectionShort: 'Menu',
      itemSingular: 'menu item',
      itemPlural: 'menu items',
      addItem: 'Add menu item',
      editItem: 'Edit menu item',
      saveItem: 'Save menu item',
      availableLabel: 'Available today',
      empty: 'No menu items yet. Add your first meal, drink, or combo.',
      dashboardCopy: 'Manage your menu, food orders, and restaurant settings.',
      orderLabel: 'Food orders',
      requestLabel: 'Request a meal',
      buyerAction: 'Book',
    },
    retail: {
      collection: 'My stock',
      collectionShort: 'Stock',
      itemSingular: 'stock item',
      itemPlural: 'stock items',
      addItem: 'Add stock item',
      editItem: 'Edit stock item',
      saveItem: 'Save stock item',
      availableLabel: 'In stock',
      empty: 'No stock items yet. Add what buyers can pick from your shop.',
      dashboardCopy: 'Manage your stock, shop orders, and customer requests.',
      orderLabel: 'Shop orders',
      requestLabel: 'Request item',
      buyerAction: 'Order',
    },
    grocery: {
      collection: 'My groceries',
      collectionShort: 'Groceries',
      itemSingular: 'grocery item',
      itemPlural: 'grocery items',
      addItem: 'Add grocery item',
      editItem: 'Edit grocery item',
      saveItem: 'Save grocery item',
      availableLabel: 'Available today',
      empty: 'No grocery items yet. Add fresh food, household goods, or essentials.',
      dashboardCopy: 'Manage groceries, basket orders, and delivery requests.',
      orderLabel: 'Grocery orders',
      requestLabel: 'Request grocery item',
      buyerAction: 'Order',
    },
    pharmacy: {
      collection: 'My health items',
      collectionShort: 'Health items',
      itemSingular: 'health item',
      itemPlural: 'health items',
      addItem: 'Add health item',
      editItem: 'Edit health item',
      saveItem: 'Save health item',
      availableLabel: 'Available',
      empty: 'No health items yet. Add safe, approved items buyers can request.',
      dashboardCopy: 'Manage health items, safe requests, and buyer calls.',
      orderLabel: 'Health requests',
      requestLabel: 'Request health item',
      buyerAction: 'Request',
    },
    hardware: {
      collection: 'My materials',
      collectionShort: 'Materials',
      itemSingular: 'material',
      itemPlural: 'materials',
      addItem: 'Add material',
      editItem: 'Edit material',
      saveItem: 'Save material',
      availableLabel: 'Available',
      empty: 'No materials yet. Add hardware, tools, or construction supplies.',
      dashboardCopy: 'Manage materials, bulk requests, and delivery needs.',
      orderLabel: 'Material orders',
      requestLabel: 'Request material',
      buyerAction: 'Order',
    },
    services: {
      collection: 'My services',
      collectionShort: 'Services',
      itemSingular: 'service',
      itemPlural: 'services',
      addItem: 'Add service',
      editItem: 'Edit service',
      saveItem: 'Save service',
      availableLabel: 'Available for booking',
      empty: 'No services yet. Add the first service buyers can request.',
      dashboardCopy: 'Manage your services, quote requests, and bookings.',
      orderLabel: 'Bookings',
      requestLabel: 'Request a service',
      buyerAction: 'Request booking',
    },
    fashion: {
      collection: 'My fashion items',
      collectionShort: 'Fashion',
      itemSingular: 'fashion item',
      itemPlural: 'fashion items',
      addItem: 'Add fashion item',
      editItem: 'Edit fashion item',
      saveItem: 'Save fashion item',
      availableLabel: 'Available',
      empty: 'No fashion items yet. Add clothes, shoes, bags, or accessories.',
      dashboardCopy: 'Manage fashion items, size requests, and customer orders.',
      orderLabel: 'Fashion orders',
      requestLabel: 'Request fashion item',
      buyerAction: 'Order',
    },
    electronics: {
      collection: 'My devices',
      collectionShort: 'Devices',
      itemSingular: 'device',
      itemPlural: 'devices',
      addItem: 'Add device',
      editItem: 'Edit device',
      saveItem: 'Save device',
      availableLabel: 'Available',
      empty: 'No devices yet. Add phones, accessories, appliances, or electronics.',
      dashboardCopy: 'Manage devices, specs, warranties, and inspection requests.',
      orderLabel: 'Device orders',
      requestLabel: 'Request device',
      buyerAction: 'Order',
    },
    gas_water: {
      collection: 'My refills',
      collectionShort: 'Refills',
      itemSingular: 'refill item',
      itemPlural: 'refill items',
      addItem: 'Add refill item',
      editItem: 'Edit refill item',
      saveItem: 'Save refill item',
      availableLabel: 'Available for delivery',
      empty: 'No refill items yet. Add gas cylinders, water, or delivery options.',
      dashboardCopy: 'Manage refills, recurring orders, and fast deliveries.',
      orderLabel: 'Refill orders',
      requestLabel: 'Request refill',
      buyerAction: 'Order refill',
    },
  }

  return language[categoryId] || {
    collection: 'My products',
    collectionShort: 'Products',
    itemSingular: getBusinessCategory(categoryId).itemLabel || 'product',
    itemPlural: 'products',
    addItem: 'Add product',
    editItem: 'Edit product',
    saveItem: 'Save product',
    availableLabel: 'Available for ordering',
    empty: 'No products yet. Add your first one.',
    dashboardCopy: 'Manage your products, orders, and shop settings.',
    orderLabel: 'Orders',
    requestLabel: 'Request item',
    buyerAction: 'Order',
  }
}

export const ORDER_STATUS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
}

export function formatMoney(value) {
  const amount = Number(value || 0)
  return `UGX ${amount.toLocaleString()}`
}

export function getTodayStart() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export async function uploadToImgBB(file) {
  if (!file) return ''

  try {
    const session = supabase ? await supabase.auth.getSession() : null
    const token = session?.data?.session?.access_token
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (response.ok) {
      const data = await response.json()
      if (data.url) return data.url
    }
  } catch (error) {
    console.warn('Cloudflare image upload unavailable, trying fallback.', error)
  }

  if (!IMGBB_API_KEY) {
    throw new Error('Image upload is not configured.')
  }

  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()

  if (!data.success) {
    throw new Error('Image upload failed.')
  }

  return data.data.url
}
