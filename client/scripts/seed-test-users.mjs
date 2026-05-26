import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(__dirname, '..')

function readEnvFile() {
  try {
    return Object.fromEntries(
      readFileSync(resolve(clientRoot, '.env'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=')
          return [line.slice(0, index), line.slice(index + 1)]
        })
    )
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile()
const supabaseUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run this from PowerShell after setting SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const serviceRolePayload = decodeJwtPayload(serviceRoleKey)
if (serviceRolePayload?.exp && serviceRolePayload.exp * 1000 <= Date.now()) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is expired.')
  console.error('Copy a fresh service_role key from Supabase Dashboard > Project Settings > API.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const password = 'GarugaTest123!'
const testUsers = [
  {
    email: 'garuga.buyer.test@example.com',
    name: 'Garuga Test Buyer',
    phone: '+256700000101',
    role: 'buyer',
    delivery_categories: [],
  },
  {
    email: 'garuga.seller.test@example.com',
    name: 'Garuga Test Seller',
    phone: '+256700000202',
    role: 'seller',
    delivery_categories: [],
  },
  {
    email: 'garuga.delivery.boda.test@example.com',
    name: 'Garuga Test Boda',
    phone: '+256700000303',
    role: 'delivery',
    delivery_categories: ['boda'],
  },
  {
    email: 'garuga.delivery.truck.test@example.com',
    name: 'Garuga Test Truck',
    phone: '+256700000404',
    role: 'delivery',
    delivery_categories: ['truck'],
  },
]

async function findUserByEmail(email) {
  let page = 1
  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 100) return null
    page += 1
  }
  return null
}

async function upsertAuthUser(testUser) {
  const existing = await findUserByEmail(testUser.email)
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: testUser,
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: testUser.email,
    password,
    email_confirm: true,
    user_metadata: testUser,
  })
  if (error) throw error
  return data.user
}

async function seedProfile(user, testUser) {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: testUser.email,
    name: testUser.name,
    phone: testUser.phone,
    role: testUser.role,
    delivery_categories: testUser.delivery_categories,
    trust_score: 85,
    risk_level: 'normal',
    blocked: false,
    verification_status: testUser.role === 'seller' ? 'verified' : 'unverified',
    admin_notes: 'Seeded test account.',
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function seedSellerShop(sellerUser) {
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .upsert(
      {
        owner_id: sellerUser.id,
        name: 'Garuga Test Electronics',
        phone: '+256700000202',
        email: 'garuga.seller.test@example.com',
        location: 'Kampala Test Road',
        business_category: 'electronics',
        business_category_label: 'Electronics',
        business_features: ['phones', 'accessories'],
        setup_complete: true,
        verification_status: 'verified',
        is_suspended: false,
        admin_notes: 'Seeded test shop.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    )
    .select('*')
    .single()

  if (shopError) throw shopError

  const products = [
    {
      shop_id: shop.id,
      seller_id: sellerUser.id,
      name: 'Test Phone Charger',
      price: 15000,
      description: 'Seed product for testing cart and orders.',
      available: true,
      photo_url: '',
      business_category: 'electronics',
      business_category_label: 'Electronics',
    },
    {
      shop_id: shop.id,
      seller_id: sellerUser.id,
      name: 'Test Earphones',
      price: 25000,
      description: 'Seed product for testing checkout.',
      available: true,
      photo_url: '',
      business_category: 'electronics',
      business_category_label: 'Electronics',
    },
  ]

  for (const product of products) {
    const { data: existingProduct, error: findError } = await supabase
      .from('products')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('name', product.name)
      .maybeSingle()
    if (findError) throw findError

    const query = existingProduct
      ? supabase.from('products').update(product).eq('id', existingProduct.id)
      : supabase.from('products').insert(product)

    const { error } = await query
    if (error) throw error
  }

  return shop
}

const created = []
let sellerAuthUser = null

for (const testUser of testUsers) {
  const authUser = await upsertAuthUser(testUser)
  await seedProfile(authUser, testUser)
  created.push({ ...testUser, id: authUser.id })
  if (testUser.role === 'seller') sellerAuthUser = authUser
}

const sellerShop = sellerAuthUser ? await seedSellerShop(sellerAuthUser) : null

console.log('\nGaruga test accounts are ready.\n')
created.forEach((user) => {
  console.log(`${user.role.padEnd(8)} ${user.email} / ${password}`)
})

if (sellerShop) {
  console.log(`\nTest seller shop: ${sellerShop.shop_code || sellerShop.id} - ${sellerShop.name}`)
}
