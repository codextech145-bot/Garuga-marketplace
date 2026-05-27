-- Garuga Marketplace Supabase schema
-- Run this in the Supabase SQL editor for a fresh project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'delivery')),
  delivery_categories text[] not null default '{}',
  trust_score integer not null default 70 check (trust_score >= 0 and trust_score <= 100),
  risk_level text not null default 'normal' check (risk_level in ('normal', 'watch', 'high', 'blocked')),
  blocked boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, role, delivery_categories)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    case
      when coalesce(new.raw_user_meta_data->>'role', 'buyer') = 'delivery' then
        coalesce(
          (select array_agg(value) from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'delivery_categories', '["all"]'::jsonb)) as value),
          '{"all"}'::text[]
        )
      else '{}'::text[]
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    delivery_categories = excluded.delivery_categories,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  shop_code text unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Garuga Shop',
  phone text not null default '',
  email text not null default '',
  location text not null default '',
  business_category text,
  business_category_label text,
  business_features text[] not null default '{}',
  settings jsonb not null default '{}',
  setup_complete boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  is_suspended boolean not null default false,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.get_shop_code_prefix(category text, label text, shop_name text)
returns text
language plpgsql
set search_path = public
as $$
declare
  source_text text;
begin
  source_text := regexp_replace(upper(coalesce(category, label, shop_name, 'shop')), '[^A-Z0-9]', '', 'g');
  return 'G' || left(coalesce(nullif(source_text, ''), 'SHOP'), 1);
end;
$$;

create or replace function public.assign_shop_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prefix text;
  next_number integer;
begin
  if new.shop_code is not null and new.shop_code <> '' then
    new.shop_code := upper(new.shop_code);
    return new;
  end if;

  prefix := public.get_shop_code_prefix(new.business_category, new.business_category_label, new.name);

  select coalesce(max((regexp_match(shop_code, ('^' || prefix || '-([0-9]+)$')))[1]::integer), 0) + 1
    into next_number
    from public.shops
    where shop_code ~ ('^' || prefix || '-[0-9]+$');

  new.shop_code := prefix || '-' || lpad(next_number::text, 2, '0');
  return new;
end;
$$;

drop trigger if exists assign_shop_code_before_save on public.shops;
create trigger assign_shop_code_before_save
  before insert or update of business_category, business_category_label, name, shop_code on public.shops
  for each row
  when (new.shop_code is null or new.shop_code = '')
  execute function public.assign_shop_code();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null default 0,
  description text not null default '',
  available boolean not null default true,
  photo_url text not null default '',
  negotiable boolean not null default false,
  details jsonb not null default '{}',
  business_category text,
  business_category_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  delivery_id uuid references public.profiles(id) on delete set null,
  delivery_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'out_for_delivery', 'delivered')),
  fulfillment_type text not null default 'delivery' check (fulfillment_type in ('delivery', 'pickup')),
  delivery_category text not null default 'boda' check (delivery_category in ('boda', 'car', 'truck')),
  delivery_confirmation_code text,
  delivery_confirmed_at timestamptz,
  delivery_fee numeric(12, 2) not null default 0,
  delivery_fee_status text not null default 'not_started' check (delivery_fee_status in ('not_started', 'pending_buyer', 'buyer_countered', 'accepted', 'rejected', 'waiting_new_delivery')),
  delivery_fee_offer jsonb not null default '{}',
  buyer_name text not null,
  buyer_phone text not null,
  buyer_address text not null,
  delivery_location jsonb,
  items jsonb not null default '[]',
  total numeric(12, 2) not null default 0,
  admin_status text not null default 'normal' check (admin_status in ('normal', 'review', 'held', 'cleared')),
  risk_flags jsonb not null default '[]',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete set null,
  product_name text not null,
  category text not null default 'Other',
  condition text not null default 'Used - Good',
  price numeric(12, 2) not null default 0,
  description text not null default '',
  location text not null default '',
  phone text not null default '',
  seller_name text not null default '',
  photo_urls text[] not null default '{}',
  negotiable boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id text primary key default 'main',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text check (role in ('buyer', 'seller', 'delivery')),
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  sender_role text not null check (sender_role in ('buyer', 'seller', 'delivery')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  item_id uuid references public.items(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'booked', 'closed', 'reported')),
  context_type text not null default 'product' check (context_type in ('product', 'shop', 'general')),
  product_snapshot jsonb not null default '{}',
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_conversations_has_context check (product_id is not null or item_id is not null or shop_id is not null),
  constraint marketplace_conversations_not_self check (buyer_id <> seller_id)
);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  sender_role text not null check (sender_role in ('buyer', 'seller', 'delivery')),
  message text not null,
  message_type text not null default 'text' check (message_type in ('text', 'system', 'offer', 'booking')),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  category text not null default 'other' check (category in ('fraud', 'wrong_item', 'no_show', 'abuse', 'payment', 'delivery', 'other')),
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_owner_id_idx on public.shops(owner_id);
create unique index if not exists shops_owner_id_unique_idx on public.shops(owner_id);
create index if not exists products_shop_id_created_at_idx on public.products(shop_id, created_at desc);
create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists orders_buyer_id_created_at_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_seller_id_created_at_idx on public.orders(seller_id, created_at desc);
create index if not exists orders_delivery_id_idx on public.orders(delivery_id);
create index if not exists orders_shop_id_idx on public.orders(shop_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists items_created_at_idx on public.items(created_at desc);
create index if not exists items_seller_id_idx on public.items(seller_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions(role);
create index if not exists order_messages_order_id_created_at_idx on public.order_messages(order_id, created_at asc);
create index if not exists order_messages_sender_id_idx on public.order_messages(sender_id);
create unique index if not exists marketplace_conversations_product_unique_idx
  on public.marketplace_conversations(buyer_id, seller_id, product_id)
  where product_id is not null;
create unique index if not exists marketplace_conversations_item_unique_idx
  on public.marketplace_conversations(buyer_id, seller_id, item_id)
  where item_id is not null;
create unique index if not exists marketplace_conversations_shop_unique_idx
  on public.marketplace_conversations(buyer_id, seller_id, shop_id)
  where shop_id is not null and product_id is null and item_id is null;
create index if not exists marketplace_conversations_buyer_idx on public.marketplace_conversations(buyer_id, last_message_at desc);
create index if not exists marketplace_conversations_seller_idx on public.marketplace_conversations(seller_id, last_message_at desc);
create index if not exists marketplace_messages_conversation_created_idx on public.marketplace_messages(conversation_id, created_at asc);
create index if not exists marketplace_messages_sender_idx on public.marketplace_messages(sender_id);
create index if not exists reports_status_created_at_idx on public.reports(status, created_at desc);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists reports_order_id_idx on public.reports(order_id);
create index if not exists reports_shop_id_idx on public.reports(shop_id);
create index if not exists reports_reported_user_id_idx on public.reports(reported_user_id);
create index if not exists site_content_updated_by_idx on public.site_content(updated_by);

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.items enable row level security;
alter table public.site_content enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.order_messages enable row level security;
alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;
alter table public.reports enable row level security;

create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "shops public read" on public.shops
  for select using (true);

create policy "shops owner insert" on public.shops
  for insert with check (auth.uid() = owner_id);

create policy "shops owner update" on public.shops
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "shops owner delete" on public.shops
  for delete using (auth.uid() = owner_id);

create policy "products public read" on public.products
  for select using (true);

create policy "products seller insert" on public.products
  for insert with check (auth.uid() = seller_id);

create policy "products seller update" on public.products
  for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

create policy "products seller delete" on public.products
  for delete using (auth.uid() = seller_id);

create policy "orders participant read" on public.orders
  for select using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or auth.uid() = delivery_id
    or (
      status in ('accepted', 'out_for_delivery')
      and exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'delivery'
      )
    )
  );

create policy "orders buyer insert" on public.orders
  for insert with check (auth.uid() = buyer_id);

create policy "orders participant update" on public.orders
  for update using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or auth.uid() = delivery_id
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'delivery'
    )
  );

create policy "items public read" on public.items
  for select using (true);

create policy "items authenticated write" on public.items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "site content public read" on public.site_content
  for select using (true);

create policy "site content owner write" on public.site_content
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'seller'
    )
  );

create policy "push subscriptions owner read" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push subscriptions owner insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push subscriptions owner update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push subscriptions owner delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create policy "order messages participant read" on public.order_messages
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_messages.order_id
      and (
        auth.uid() = orders.buyer_id
        or auth.uid() = orders.seller_id
        or auth.uid() = orders.delivery_id
      )
    )
  );

create policy "order messages participant insert" on public.order_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.orders
      where orders.id = order_messages.order_id
      and (
        auth.uid() = orders.buyer_id
        or auth.uid() = orders.seller_id
        or auth.uid() = orders.delivery_id
      )
    )
  );

create policy "marketplace conversations participant read" on public.marketplace_conversations
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "marketplace conversations buyer insert" on public.marketplace_conversations
  for insert with check (auth.uid() = buyer_id);

create policy "marketplace conversations participant update" on public.marketplace_conversations
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "marketplace messages participant read" on public.marketplace_messages
  for select using (
    exists (
      select 1 from public.marketplace_conversations
      where marketplace_conversations.id = marketplace_messages.conversation_id
      and (auth.uid() = marketplace_conversations.buyer_id or auth.uid() = marketplace_conversations.seller_id)
    )
  );

create policy "marketplace messages participant insert" on public.marketplace_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.marketplace_conversations
      where marketplace_conversations.id = marketplace_messages.conversation_id
      and (auth.uid() = marketplace_conversations.buyer_id or auth.uid() = marketplace_conversations.seller_id)
    )
  );

create policy "reports participant insert" on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy "reports reporter read" on public.reports
  for select using (auth.uid() = reporter_id);

-- TEMPORARY: lets the admin page work while ADMIN_AUTH_BYPASS is enabled in the app.
-- Remove these policies when admin key protection is turned back on.
create policy "temporary admin bypass profiles read" on public.profiles
  for select using (true);

create policy "temporary admin bypass profiles write" on public.profiles
  for all using (true) with check (true);

create policy "temporary admin bypass shops write" on public.shops
  for all using (true) with check (true);

create policy "temporary admin bypass products write" on public.products
  for all using (true) with check (true);

create policy "temporary admin bypass orders write" on public.orders
  for all using (true) with check (true);

create policy "temporary admin bypass site content write" on public.site_content
  for all using (true) with check (true);

create policy "temporary admin bypass items write" on public.items
  for all using (true) with check (true);

create policy "temporary admin bypass reports write" on public.reports
  for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.shops to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update on public.marketplace_conversations to authenticated;
grant select, insert on public.marketplace_messages to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'marketplace_conversations'
  ) then
    alter publication supabase_realtime add table public.marketplace_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'marketplace_messages'
  ) then
    alter publication supabase_realtime add table public.marketplace_messages;
  end if;
end $$;
