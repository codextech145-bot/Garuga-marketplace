-- Run this if you already ran schema.sql before the Supabase cutover updates.
-- It adds auth profile creation, one shop per seller, and realtime for live order updates.

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

create unique index if not exists shops_owner_id_unique_idx on public.shops(owner_id);

alter table public.shops
  add column if not exists shop_code text;

alter table public.shops
  add column if not exists location text not null default '';

create unique index if not exists shops_shop_code_unique_idx on public.shops(shop_code);

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

do $$
declare
  shop_record record;
  prefix text;
  next_number integer;
begin
  for shop_record in
    select id, business_category, business_category_label, name
    from public.shops
    where shop_code is null or shop_code = ''
    order by created_at asc
  loop
    prefix := public.get_shop_code_prefix(shop_record.business_category, shop_record.business_category_label, shop_record.name);

    select coalesce(max((regexp_match(shop_code, ('^' || prefix || '-([0-9]+)$')))[1]::integer), 0) + 1
      into next_number
      from public.shops
      where shop_code ~ ('^' || prefix || '-[0-9]+$');

    update public.shops
      set shop_code = prefix || '-' || lpad(next_number::text, 2, '0')
      where id = shop_record.id;
  end loop;
end $$;

update public.shops set shop_code = null;

do $$
declare
  shop_record record;
  prefix text;
  next_number integer;
begin
  for shop_record in
    select id, business_category, business_category_label, name
    from public.shops
    order by created_at asc
  loop
    prefix := public.get_shop_code_prefix(shop_record.business_category, shop_record.business_category_label, shop_record.name);

    select coalesce(max((regexp_match(shop_code, ('^' || prefix || '-([0-9]+)$')))[1]::integer), 0) + 1
      into next_number
      from public.shops
      where shop_code ~ ('^' || prefix || '-[0-9]+$');

    update public.shops
      set shop_code = prefix || '-' || lpad(next_number::text, 2, '0')
      where id = shop_record.id;
  end loop;
end $$;

alter table public.profiles
  add column if not exists delivery_categories text[] not null default '{}';

alter table public.orders
  add column if not exists fulfillment_type text not null default 'delivery';

alter table public.orders
  add column if not exists delivery_category text not null default 'boda';

alter table public.orders
  add column if not exists delivery_confirmation_code text;

alter table public.orders
  add column if not exists delivery_confirmed_at timestamptz;

alter table public.orders
  add column if not exists delivery_fee numeric(12, 2) not null default 0;

alter table public.orders
  add column if not exists delivery_fee_status text not null default 'not_started';

alter table public.orders
  add column if not exists delivery_fee_offer jsonb not null default '{}';

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

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions(role);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions owner read" on public.push_subscriptions;
create policy "push subscriptions owner read" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push subscriptions owner insert" on public.push_subscriptions;
create policy "push subscriptions owner insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner update" on public.push_subscriptions;
create policy "push subscriptions owner update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push subscriptions owner delete" on public.push_subscriptions;
create policy "push subscriptions owner delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default '',
  sender_role text not null check (sender_role in ('buyer', 'seller', 'delivery')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_id_created_at_idx on public.order_messages(order_id, created_at asc);
create index if not exists order_messages_sender_id_idx on public.order_messages(sender_id);

alter table public.order_messages enable row level security;

drop policy if exists "order messages participant read" on public.order_messages;
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

drop policy if exists "order messages participant insert" on public.order_messages;
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

-- TEMPORARY: lets the admin page work while ADMIN_AUTH_BYPASS is enabled in the app.
-- Remove these policies when admin key protection is turned back on.
drop policy if exists "temporary admin bypass profiles read" on public.profiles;
create policy "temporary admin bypass profiles read" on public.profiles
  for select using (true);

drop policy if exists "temporary admin bypass site content write" on public.site_content;
create policy "temporary admin bypass site content write" on public.site_content
  for all using (true) with check (true);

drop policy if exists "temporary admin bypass items write" on public.items;
create policy "temporary admin bypass items write" on public.items
  for all using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_fee_status_check'
  ) then
    alter table public.orders
      add constraint orders_delivery_fee_status_check
      check (delivery_fee_status in ('not_started', 'pending_buyer', 'buyer_countered', 'accepted', 'rejected', 'waiting_new_delivery'));
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_fulfillment_type_check'
  ) then
    alter table public.orders
      add constraint orders_fulfillment_type_check
      check (fulfillment_type in ('delivery', 'pickup'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_category_check'
  ) then
    alter table public.orders
      add constraint orders_delivery_category_check
      check (delivery_category in ('boda', 'car', 'truck'));
  end if;
end $$;

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
end $$;

alter table public.profiles
  add column if not exists trust_score integer not null default 70;

alter table public.profiles
  add column if not exists risk_level text not null default 'normal';

alter table public.profiles
  add column if not exists blocked boolean not null default false;

alter table public.profiles
  add column if not exists verification_status text not null default 'unverified';

alter table public.profiles
  add column if not exists admin_notes text not null default '';

alter table public.shops
  add column if not exists verification_status text not null default 'unverified';

alter table public.shops
  add column if not exists is_suspended boolean not null default false;

alter table public.shops
  add column if not exists admin_notes text not null default '';

alter table public.orders
  add column if not exists admin_status text not null default 'normal';

alter table public.orders
  add column if not exists risk_flags jsonb not null default '[]';

alter table public.orders
  add column if not exists admin_notes text not null default '';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  category text not null default 'other',
  message text not null default '',
  status text not null default 'open',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_status_created_at_idx on public.reports(status, created_at desc);
create index if not exists reports_order_id_idx on public.reports(order_id);
create index if not exists reports_shop_id_idx on public.reports(shop_id);
create index if not exists reports_reported_user_id_idx on public.reports(reported_user_id);

alter table public.reports enable row level security;

drop policy if exists "reports participant insert" on public.reports;
create policy "reports participant insert" on public.reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports reporter read" on public.reports;
create policy "reports reporter read" on public.reports
  for select using (auth.uid() = reporter_id);

drop policy if exists "temporary admin bypass profiles write" on public.profiles;
create policy "temporary admin bypass profiles write" on public.profiles
  for all using (true) with check (true);

drop policy if exists "temporary admin bypass shops write" on public.shops;
create policy "temporary admin bypass shops write" on public.shops
  for all using (true) with check (true);

drop policy if exists "temporary admin bypass products write" on public.products;
create policy "temporary admin bypass products write" on public.products
  for all using (true) with check (true);

drop policy if exists "temporary admin bypass orders write" on public.orders;
create policy "temporary admin bypass orders write" on public.orders
  for all using (true) with check (true);

drop policy if exists "temporary admin bypass reports write" on public.reports;
create policy "temporary admin bypass reports write" on public.reports
  for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.shops to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.orders to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

create index if not exists items_seller_id_idx on public.items(seller_id);
create index if not exists orders_delivery_id_idx on public.orders(delivery_id);
create index if not exists orders_shop_id_idx on public.orders(shop_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists site_content_updated_by_idx on public.site_content(updated_by);

alter table public.products
  add column if not exists negotiable boolean not null default false;

alter table public.items
  add column if not exists negotiable boolean not null default false;

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

create unique index if not exists marketplace_conversations_product_unique_idx
  on public.marketplace_conversations(buyer_id, seller_id, product_id)
  where product_id is not null;

create unique index if not exists marketplace_conversations_item_unique_idx
  on public.marketplace_conversations(buyer_id, seller_id, item_id)
  where item_id is not null;

create index if not exists marketplace_conversations_buyer_idx on public.marketplace_conversations(buyer_id, last_message_at desc);
create index if not exists marketplace_conversations_seller_idx on public.marketplace_conversations(seller_id, last_message_at desc);

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

create index if not exists marketplace_messages_conversation_created_idx on public.marketplace_messages(conversation_id, created_at asc);
create index if not exists marketplace_messages_sender_idx on public.marketplace_messages(sender_id);

alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;

drop policy if exists "marketplace conversations participant read" on public.marketplace_conversations;
create policy "marketplace conversations participant read" on public.marketplace_conversations
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "marketplace conversations buyer insert" on public.marketplace_conversations;
create policy "marketplace conversations buyer insert" on public.marketplace_conversations
  for insert with check (auth.uid() = buyer_id);

drop policy if exists "marketplace conversations participant update" on public.marketplace_conversations;
create policy "marketplace conversations participant update" on public.marketplace_conversations
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "marketplace messages participant read" on public.marketplace_messages;
create policy "marketplace messages participant read" on public.marketplace_messages
  for select using (
    exists (
      select 1 from public.marketplace_conversations
      where marketplace_conversations.id = marketplace_messages.conversation_id
      and (auth.uid() = marketplace_conversations.buyer_id or auth.uid() = marketplace_conversations.seller_id)
    )
  );

drop policy if exists "marketplace messages participant insert" on public.marketplace_messages;
create policy "marketplace messages participant insert" on public.marketplace_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.marketplace_conversations
      where marketplace_conversations.id = marketplace_messages.conversation_id
      and (auth.uid() = marketplace_conversations.buyer_id or auth.uid() = marketplace_conversations.seller_id)
    )
  );

grant select, insert, update on public.marketplace_conversations to authenticated;
grant select, insert on public.marketplace_messages to authenticated;

do $$
begin
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

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_trust_score_check') then
    alter table public.profiles add constraint profiles_trust_score_check check (trust_score >= 0 and trust_score <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_risk_level_check') then
    alter table public.profiles add constraint profiles_risk_level_check check (risk_level in ('normal', 'watch', 'high', 'blocked'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_verification_status_check') then
    alter table public.profiles add constraint profiles_verification_status_check check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shops_verification_status_check') then
    alter table public.shops add constraint shops_verification_status_check check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_admin_status_check') then
    alter table public.orders add constraint orders_admin_status_check check (admin_status in ('normal', 'review', 'held', 'cleared'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reports_category_check') then
    alter table public.reports add constraint reports_category_check check (category in ('fraud', 'wrong_item', 'no_show', 'abuse', 'payment', 'delivery', 'other'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reports_status_check') then
    alter table public.reports add constraint reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed'));
  end if;
end $$;
