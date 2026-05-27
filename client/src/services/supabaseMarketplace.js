import { requirePublicSupabase, requireSupabase } from '../config/supabase'

function isExpiredSessionError(error) {
  const text = `${error?.message || ''} ${error?.error_description || ''} ${error?.error || ''}`.toLowerCase()
  return text.includes('jwt') || text.includes('token') || text.includes('refresh')
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    productName: row.name,
    price: row.price,
    description: row.description || '',
    available: row.available,
    photoURL: row.photo_url || '',
    details: row.details || {},
    negotiable: Boolean(row.negotiable),
    businessCategory: row.business_category || '',
    businessCategoryLabel: row.business_category_label || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapShop(row) {
  return {
    id: row.id,
    shopCode: row.shop_code || '',
    ownerId: row.owner_id,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    location: row.location || '',
    businessCategory: row.business_category || '',
    businessCategoryLabel: row.business_category_label || '',
    businessFeatures: row.business_features || [],
    settings: row.settings || {},
    setupComplete: row.setup_complete,
    verificationStatus: row.verification_status || 'unverified',
    isSuspended: Boolean(row.is_suspended),
    adminNotes: row.admin_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeDeliveryCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return ['all']
  return categories
}

function mapProfile(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    deliveryCategories: normalizeDeliveryCategories(row.delivery_categories),
    trustScore: Number(row.trust_score ?? 70),
    riskLevel: row.risk_level || 'normal',
    blocked: Boolean(row.blocked),
    verificationStatus: row.verification_status || 'unverified',
    adminNotes: row.admin_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOrder(row) {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    shopId: row.shop_id,
    sellerId: row.seller_id,
    deliveryId: row.delivery_id,
    deliveryName: row.delivery_name || '',
    status: row.status,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    buyerAddress: row.buyer_address,
    fulfillmentType: row.fulfillment_type || 'delivery',
    deliveryCategory: row.delivery_category || 'boda',
    deliveryConfirmationCode: row.delivery_confirmation_code || '',
    deliveryConfirmedAt: row.delivery_confirmed_at,
    deliveryFee: Number(row.delivery_fee || 0),
    deliveryFeeStatus: row.delivery_fee_status || 'not_started',
    deliveryFeeOffer: row.delivery_fee_offer || {},
    deliveryLocation: row.delivery_location,
    items: row.items || [],
    total: row.total,
    adminStatus: row.admin_status || 'normal',
    riskFlags: row.risk_flags || [],
    adminNotes: row.admin_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapItem(row) {
  const photoURLs = row.photo_urls || []
  return {
    id: row.id,
    sellerId: row.seller_id,
    productName: row.product_name,
    category: row.category,
    condition: row.condition,
    price: row.price,
    description: row.description || '',
    location: row.location || '',
    phone: row.phone || '',
    sellerName: row.seller_name || '',
    photoURLs,
    photoURL: photoURLs[0] || '',
    negotiable: Boolean(row.negotiable),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOrderMessage(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    senderId: row.sender_id,
    senderName: row.sender_name || '',
    senderRole: row.sender_role,
    message: row.message,
    createdAt: row.created_at,
  }
}

function mapMarketplaceConversation(row) {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    shopId: row.shop_id,
    productId: row.product_id,
    itemId: row.item_id,
    status: row.status,
    contextType: row.context_type,
    productSnapshot: row.product_snapshot || {},
    lastMessage: row.last_message || '',
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMarketplaceMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name || '',
    senderRole: row.sender_role,
    message: row.message,
    messageType: row.message_type || 'text',
    createdAt: row.created_at,
  }
}

function mapReport(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    orderId: row.order_id,
    shopId: row.shop_id,
    reportedUserId: row.reported_user_id,
    category: row.category || 'other',
    message: row.message || '',
    status: row.status || 'open',
    adminNotes: row.admin_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isAdminBypassSession() {
  try {
    return window.sessionStorage.getItem('garuga_admin_key_session') === 'admin-bypass'
  } catch {
    return false
  }
}

export async function signUpWithProfile({ email, password, name, phone, role, deliveryCategories }) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        role,
        delivery_categories: role === 'delivery' ? normalizeDeliveryCategories(deliveryCategories) : [],
      },
    },
  })

  if (error) throw error

  return data
}

export async function signInWithPassword({ email, password }) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function sendPasswordReset(email) {
  const client = requireSupabase()
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
  if (error) throw error
  return data
}

export async function updatePassword(password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function signOutSupabase() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile(userId) {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError && isExpiredSessionError(userError)) throw userError
  const authUser = userData?.user
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error

  if (!data && authUser) {
    const metadata = authUser.user_metadata || {}
    const { data: createdProfile, error: createError } = await client
      .from('profiles')
      .upsert({
        id: userId,
        email: authUser.email || '',
        name: metadata.name || '',
        phone: metadata.phone || '',
        role: metadata.role || 'buyer',
        delivery_categories:
          metadata.role === 'delivery' ? normalizeDeliveryCategories(metadata.delivery_categories) : [],
      })
      .select('*')
      .single()

    if (createError) throw createError

    return mapProfile(createdProfile)
  }

  if (!data) {
    throw new Error('Profile not found for this account.')
  }

  return mapProfile(data)
}

export async function getSellerShop(ownerId, profile) {
  const client = requireSupabase()
  const { data, error } = await client.from('shops').select('*').eq('owner_id', ownerId).maybeSingle()

  if (error) throw error
  if (data) return mapShop(data)

  return upsertSellerShop({
    owner_id: ownerId,
    name: profile?.name || 'Garuga Shop',
    phone: profile?.phone || '',
    email: profile?.email || '',
  })
}

export async function upsertSellerShop(shop) {
  const client = requireSupabase()
  const { data, error } = await client.from('shops').upsert(shop, { onConflict: 'owner_id' }).select('*').single()
  if (error) throw error
  return mapShop(data)
}

export async function updateSellerShop(shopId, payload) {
  const client = requireSupabase()
  const { data, error } = await client.from('shops').update(payload).eq('id', shopId).select('*').single()
  if (error) throw error
  return mapShop(data)
}

export async function listAdminProfiles() {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) {
      console.warn('Admin bypass could not read profiles:', error)
      return []
    }
    return (data || []).map(mapProfile)
  }

  const { data, error } = await client.functions.invoke('admin-api', {
    body: { action: 'listProfiles', key: window.sessionStorage.getItem('garuga_admin_key_session') || '' },
  })
  if (error) throw error
  return (data?.profiles || []).map(mapProfile)
}

export async function listAdminItems() {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { data, error } = await client.from('items').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapItem)
  }

  const { data, error } = await client.functions.invoke('admin-api', {
    body: { action: 'listItems', key: window.sessionStorage.getItem('garuga_admin_key_session') || '' },
  })
  if (error) throw error
  return (data?.items || []).map(mapItem)
}

export async function updateAdminItem(itemId, payload) {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { data, error } = await client.from('items').update(payload).eq('id', itemId).select('*').single()
    if (error) throw error
    return mapItem(data)
  }

  const { data, error } = await client.functions.invoke('admin-api', {
    body: { action: 'updateItem', key: window.sessionStorage.getItem('garuga_admin_key_session') || '', itemId, payload },
  })
  if (error) throw error
  return mapItem(data.item)
}

export async function deleteAdminItem(itemId) {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { error } = await client.from('items').delete().eq('id', itemId)
    if (error) throw error
    return
  }

  const { error } = await client.functions.invoke('admin-api', {
    body: { action: 'deleteItem', key: window.sessionStorage.getItem('garuga_admin_key_session') || '', itemId },
  })
  if (error) throw error
}

export async function listAdminShops() {
  const client = requireSupabase()
  const { data, error } = await client.from('shops').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapShop)
}

export async function updateAdminShop(shopId, payload) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('shops')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', shopId)
    .select('*')
    .single()
  if (error) throw error
  return mapShop(data)
}

export async function deleteAdminShop(shopId) {
  const client = requireSupabase()
  const { error } = await client.from('shops').delete().eq('id', shopId)
  if (error) throw error
}

export async function updateAdminProfile(userId, payload) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return mapProfile(data)
}

export async function deleteAdminProfile(userId) {
  const client = requireSupabase()
  const { error } = await client.from('profiles').delete().eq('id', userId)
  if (error) throw error
}

export async function listAdminOrders() {
  const client = requireSupabase()
  const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapOrder)
}

export async function updateAdminOrder(orderId, payload) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('orders')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('*')
    .single()
  if (error) throw error
  return mapOrder(data)
}

export async function listAdminReports() {
  const client = requireSupabase()
  const { data, error } = await client.from('reports').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapReport)
}

export async function createReport(report) {
  const client = requireSupabase()
  const { data, error } = await client.from('reports').insert(report).select('*').single()
  if (error) throw error
  return mapReport(data)
}

export async function updateAdminReport(reportId, payload) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('reports')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select('*')
    .single()
  if (error) throw error
  return mapReport(data)
}

export async function getSiteContent() {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { data, error } = await client.from('site_content').select('*').eq('id', 'main').maybeSingle()
    if (error) throw error
    return data?.data || null
  }

  const { data, error } = await client.functions.invoke('admin-api', {
    body: { action: 'getSiteContent', key: window.sessionStorage.getItem('garuga_admin_key_session') || '' },
  })
  if (error) throw error
  return data?.siteContent || null
}

export async function saveSiteContent(data, updatedBy) {
  const client = requireSupabase()
  if (isAdminBypassSession()) {
    const { error } = await client.from('site_content').upsert({
      id: 'main',
      data,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return
  }

  const { error } = await client.functions.invoke('admin-api', {
    body: {
      action: 'saveSiteContent',
      key: window.sessionStorage.getItem('garuga_admin_key_session') || '',
      data,
      updatedBy,
    },
  })
  if (error) throw error
}

export async function savePushSubscription({ userId, role, subscription }) {
  const client = requireSupabase()
  const endpoint = subscription?.endpoint
  if (!userId || !endpoint) return null

  const { data, error } = await client
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        role: role || null,
        endpoint,
        subscription,
        user_agent: navigator.userAgent || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function sendPushNotification(payload) {
  const client = requireSupabase()
  const { error } = await client.functions.invoke('send-push', { body: payload })
  if (error) {
    console.warn('Push function failed:', error)
  }
}

export async function deleteSellerShop(shopId) {
  const client = requireSupabase()
  const { error } = await client.from('shops').delete().eq('id', shopId)
  if (error) throw error
}

export async function listPublicShops() {
  const client = requirePublicSupabase()
  const { data, error } = await client
    .from('shops')
    .select('*')
    .eq('is_suspended', false)
    .or('setup_complete.eq.true,business_category.not.is.null')
    .order('name', { ascending: true })

  if (error) throw error
  return data.map(mapShop)
}

export async function getPublicShopByCodeOrId(shopCodeOrId) {
  const shops = await listPublicShops()
  return shops.find((shop) => shop.id === shopCodeOrId || shop.shopCode === shopCodeOrId) || null
}

export async function listShopProducts(shopId) {
  const client = requirePublicSupabase()
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapProduct)
}

export async function saveProduct(productId, payload) {
  const client = requireSupabase()
  const query = productId
    ? client.from('products').update(payload).eq('id', productId)
    : client.from('products').insert(payload)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return mapProduct(data)
}

export async function deleteProduct(productId) {
  const client = requireSupabase()
  const { error } = await client.from('products').delete().eq('id', productId)
  if (error) throw error
}

export async function createOrder(order) {
  const client = requireSupabase()
  const { data, error } = await client.from('orders').insert(order).select('*').single()
  if (error) throw error
  const mappedOrder = mapOrder(data)

  sendPushNotification({
    recipientUserIds: [mappedOrder.sellerId],
    title: order.items?.[0]?.requestText ? 'New shop request' : 'New order request',
    body: `${mappedOrder.buyerName} sent ${order.items?.[0]?.requestText ? 'a request' : 'an order'} to your shop.`,
    url: '/dashboard/seller',
    tag: `seller-order-${mappedOrder.id}`,
  })

  return mappedOrder
}

export async function getOrder(orderId) {
  const client = requireSupabase()
  const { data, error } = await client.from('orders').select('*').eq('id', orderId).single()
  if (error) throw error
  return mapOrder(data)
}

export async function updateOrder(orderId, payload) {
  const client = requireSupabase()
  const { data, error } = await client.from('orders').update(payload).eq('id', orderId).select('*').single()
  if (error) throw error
  const mappedOrder = mapOrder(data)

  if (payload.status) {
    sendPushNotification({
      recipientUserIds: [mappedOrder.buyerId],
      title: 'Your Garuga order was updated',
      body: `Order is now ${mappedOrder.status.replaceAll('_', ' ')}.`,
      url: `/order/${mappedOrder.id}`,
      tag: `buyer-order-${mappedOrder.id}`,
    })

    if (mappedOrder.status === 'accepted' && mappedOrder.fulfillmentType === 'delivery') {
      sendPushNotification({
        recipientRole: 'delivery',
        title: 'Delivery order available',
        body: `${mappedOrder.buyerName} needs delivery for ${mappedOrder.items?.map((item) => item.name || item.requestText).join(', ') || 'an order'}.`,
        url: '/dashboard/delivery',
        tag: `delivery-order-${mappedOrder.id}`,
      })
    }
  }

  if (payload.delivery_fee_status) {
    const messageByStatus = {
      pending_buyer: {
        recipientUserIds: [mappedOrder.buyerId],
        title: 'Delivery fee requested',
        body: `${mappedOrder.deliveryName || 'A delivery partner'} requested ${Number(payload.delivery_fee || mappedOrder.deliveryFee || 0).toLocaleString()} UGX for delivery.`,
        url: `/order/${mappedOrder.id}`,
        tag: `delivery-fee-${mappedOrder.id}`,
      },
      buyer_countered: {
        recipientUserIds: mappedOrder.deliveryId ? [mappedOrder.deliveryId] : [],
        title: 'Buyer countered delivery fee',
        body: `${mappedOrder.buyerName} suggested ${Number(mappedOrder.deliveryFeeOffer?.buyerAmount || 0).toLocaleString()} UGX.`,
        url: '/dashboard/delivery',
        tag: `delivery-fee-${mappedOrder.id}`,
      },
      accepted: {
        recipientUserIds: [mappedOrder.buyerId, mappedOrder.deliveryId].filter(Boolean),
        title: 'Delivery fee agreed',
        body: `Delivery fee agreed at ${Number(mappedOrder.deliveryFee || 0).toLocaleString()} UGX.`,
        url: `/order/${mappedOrder.id}`,
        tag: `delivery-fee-${mappedOrder.id}`,
      },
      rejected: {
        recipientUserIds: [mappedOrder.buyerId],
        title: 'Delivery fee rejected',
        body: 'The delivery partner rejected the counter offer. You can accept the original fee or wait for another rider.',
        url: `/order/${mappedOrder.id}`,
        tag: `delivery-fee-${mappedOrder.id}`,
      },
      waiting_new_delivery: {
        recipientRole: 'delivery',
        title: 'Delivery order available again',
        body: `${mappedOrder.buyerName} is waiting for another delivery fee offer.`,
        url: '/dashboard/delivery',
        tag: `delivery-fee-${mappedOrder.id}`,
      },
    }

    const notification = messageByStatus[payload.delivery_fee_status]
    if (notification) {
      sendPushNotification(notification)
    }
  }

  return mappedOrder
}

export async function listBuyerOrders(buyerId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapOrder)
}

export async function listSellerOrders(sellerId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapOrder)
}

export function subscribeToSellerOrders(sellerId, onChange) {
  const client = requireSupabase()

  const channel = client
    .channel(`seller-orders:${sellerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
      async () => {
        onChange(await listSellerOrders(sellerId))
      }
    )
    .subscribe()

  listSellerOrders(sellerId).then(onChange)

  return () => {
    client.removeChannel(channel)
  }
}

export function subscribeToBuyerOrders(buyerId, onChange) {
  const client = requireSupabase()

  const channel = client
    .channel(`buyer-orders:${buyerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `buyer_id=eq.${buyerId}` },
      async () => {
        onChange(await listBuyerOrders(buyerId))
      }
    )
    .subscribe()

  listBuyerOrders(buyerId).then(onChange)

  return () => {
    client.removeChannel(channel)
  }
}

export async function listDeliveryOrders() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('orders')
    .select('*')
    .in('status', ['accepted', 'out_for_delivery', 'delivered'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapOrder)
}

export function subscribeToDeliveryOrders(onChange) {
  const client = requireSupabase()

  const channel = client
    .channel('delivery-orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      async () => {
        onChange(await listDeliveryOrders())
      }
    )
    .subscribe()

  listDeliveryOrders().then(onChange)

  return () => {
    client.removeChannel(channel)
  }
}

export function subscribeToOrder(orderId, onChange, onError) {
  const client = requireSupabase()

  const channel = client
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      async () => {
        try {
          onChange(await getOrder(orderId))
        } catch (error) {
          onError?.(error)
        }
      }
    )
    .subscribe()

  getOrder(orderId).then(onChange).catch((error) => onError?.(error))

  return () => {
    client.removeChannel(channel)
  }
}

export async function listOrderMessages(orderId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('order_messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data.map(mapOrderMessage)
}

export async function sendOrderMessage({ orderId, senderId, senderName, senderRole, message }) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('order_messages')
    .insert({
      order_id: orderId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      message: message.trim(),
    })
    .select('*')
    .single()

  if (error) throw error
  const mappedMessage = mapOrderMessage(data)

  const order = await getOrder(orderId)
  const recipientUserIds = [order.buyerId, order.sellerId, order.deliveryId]
    .filter(Boolean)
    .filter((userId) => userId !== senderId)

  if (recipientUserIds.length) {
    sendPushNotification({
      recipientUserIds,
      title: `New message from ${senderName || 'Garuga'}`,
      body: mappedMessage.message,
      url: senderRole === 'delivery' ? `/order/${orderId}` : `/order/${orderId}`,
      tag: `order-chat-${orderId}`,
    })
  }

  return mappedMessage
}

export function subscribeToOrderMessages(orderId, onChange, onError) {
  const client = requireSupabase()

  const channel = client
    .channel(`order-messages:${orderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` },
      async () => {
        try {
          onChange(await listOrderMessages(orderId))
        } catch (error) {
          onError?.(error)
        }
      }
    )
    .subscribe()

  listOrderMessages(orderId).then(onChange).catch((error) => onError?.(error))

  return () => {
    client.removeChannel(channel)
  }
}

export async function startMarketplaceConversation({
  buyerId,
  sellerId,
  shopId = null,
  productId = null,
  itemId = null,
  productSnapshot = {},
  openingMessage = '',
  senderName = '',
  senderRole = 'buyer',
}) {
  const client = requireSupabase()

  if (!buyerId || !sellerId) throw new Error('Both buyer and seller are required to start a chat.')
  if (buyerId === sellerId) throw new Error('You cannot start a chat with yourself.')

  const query = client
    .from('marketplace_conversations')
    .select('*')
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)

  const scopedQuery = productId
    ? query.eq('product_id', productId)
    : itemId
      ? query.eq('item_id', itemId)
      : query.eq('shop_id', shopId)

  const { data: existing, error: existingError } = await scopedQuery.maybeSingle()
  if (existingError) throw existingError

  let conversation = existing
  if (!conversation) {
    const { data, error } = await client
      .from('marketplace_conversations')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        shop_id: shopId,
        product_id: productId,
        item_id: itemId,
        context_type: productId || itemId ? 'product' : 'shop',
        product_snapshot: productSnapshot,
        last_message: openingMessage.trim() || 'Chat started',
        last_message_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) throw error
    conversation = data
  }

  if (openingMessage.trim()) {
    await sendMarketplaceMessage({
      conversationId: conversation.id,
      senderId: buyerId,
      senderName,
      senderRole,
      message: openingMessage,
      messageType: 'text',
    })
  }

  return mapMarketplaceConversation(conversation)
}

export async function listMarketplaceConversations(userId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('marketplace_conversations')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapMarketplaceConversation)
}

export async function getMarketplaceConversation(conversationId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('marketplace_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error) throw error
  return mapMarketplaceConversation(data)
}

export async function listMarketplaceMessages(conversationId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('marketplace_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapMarketplaceMessage)
}

export async function sendMarketplaceMessage({
  conversationId,
  senderId,
  senderName,
  senderRole,
  message,
  messageType = 'text',
}) {
  const client = requireSupabase()
  const cleanMessage = message.trim()
  if (!cleanMessage) throw new Error('Message cannot be empty.')

  const { data, error } = await client
    .from('marketplace_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      message: cleanMessage,
      message_type: messageType,
    })
    .select('*')
    .single()

  if (error) throw error

  await client
    .from('marketplace_conversations')
    .update({
      last_message: cleanMessage,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  const mappedMessage = mapMarketplaceMessage(data)
  const conversation = await getMarketplaceConversation(conversationId)
  const recipientUserIds = [conversation.buyerId, conversation.sellerId].filter((id) => id && id !== senderId)

  if (recipientUserIds.length) {
    sendPushNotification({
      recipientUserIds,
      title: `New chat from ${senderName || 'Garuga'}`,
      body: mappedMessage.message,
      url: `/chats/${conversationId}`,
      tag: `marketplace-chat-${conversationId}`,
    })
  }

  return mappedMessage
}

export function subscribeToMarketplaceMessages(conversationId, onChange, onError) {
  const client = requireSupabase()

  const channel = client
    .channel(`marketplace-messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'marketplace_messages', filter: `conversation_id=eq.${conversationId}` },
      async () => {
        try {
          onChange(await listMarketplaceMessages(conversationId))
        } catch (error) {
          onError?.(error)
        }
      }
    )
    .subscribe()

  listMarketplaceMessages(conversationId).then(onChange).catch((error) => onError?.(error))

  return () => {
    client.removeChannel(channel)
  }
}

export async function listItems() {
  const client = requirePublicSupabase()
  const { data, error } = await client
    .from('items')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapItem)
}

export async function createItem(item) {
  const client = requireSupabase()
  const { data, error } = await client.from('items').insert(item).select('*').single()
  if (error) throw error
  return mapItem(data)
}

export async function getItem(itemId) {
  const client = requirePublicSupabase()
  const { data, error } = await client.from('items').select('*').eq('id', itemId).single()
  if (error) throw error
  return mapItem(data)
}

export async function listRelatedItems(category, excludeId) {
  const client = requirePublicSupabase()
  let request = client
    .from('items')
    .select('*')
    .eq('status', 'active')
    .eq('category', category)
    .limit(4)

  if (excludeId) {
    request = request.neq('id', excludeId)
  }

  const { data, error } = await request
  if (error) throw error
  return data.map(mapItem)
}
