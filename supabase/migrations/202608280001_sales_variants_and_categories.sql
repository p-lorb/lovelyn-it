-- Lovelyn It! sales, variants, and admin-managed categories.
--
-- This migration is intentionally version-controlled only. Review it in the
-- Supabase SQL Editor before applying it to any database. It does not contain
-- a production admin UUID: after applying, add the designated admin account
-- to public.admin_users from the Supabase dashboard.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_lovelyn_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_lovelyn_admin() from public;
grant execute on function public.is_lovelyn_admin() to anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_name_lower_key
  on public.categories (lower(name));

insert into public.categories (name, sort_order, is_active)
values
  ('Bags & Wallets', 0, true),
  ('Clothing', 1, true),
  ('Accessories', 2, true),
  ('Intimates', 3, true),
  ('Kitchen & Home', 4, true)
on conflict (lower(name)) do update
set sort_order = excluded.sort_order;

alter table public.products
  add column if not exists category_id uuid,
  add column if not exists has_variants boolean not null default false;

alter table public.products
  drop constraint if exists products_category_id_fkey;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete restrict;

update public.products as product
set category_id = category.id
from public.categories as category
where product.category_id is null
  and lower(btrim(product.category)) = lower(category.name);

do $$
begin
  if exists (
    select 1
    from public.products
    where category_id is null
  ) then
    raise exception
      'Category migration stopped: one or more products have a category that is not one of the five reviewed categories.';
  end if;
end;
$$;

alter table public.products
  alter column category_id set not null;

-- Keep the legacy text category column during the first migration for rollback
-- and verification. The application should read category_id/categories after
-- this migration, so later category renames do not require rewriting products.

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  label text not null check (btrim(label) <> ''),
  stock integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_inactive_stock_check
    check (is_active or stock = 0)
);

create unique index if not exists product_variants_label_lower_key
  on public.product_variants (product_id, lower(label));

create index if not exists product_variants_product_sort_index
  on public.product_variants (product_id, sort_order, id);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name text not null check (btrim(product_name) <> ''),
  variant_label text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  sold_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sales_sold_at_index
  on public.sales (sold_at desc, id desc);

create index if not exists sales_product_id_index
  on public.sales (product_id);

create or replace function public.set_lovelyn_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_lovelyn_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_lovelyn_updated_at();

create or replace function public.prevent_variant_product_move()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_id is distinct from old.product_id then
    raise exception
      'A variant cannot be moved to another product. Retire or remove it and create a new variant instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists product_variants_prevent_product_move on public.product_variants;
create trigger product_variants_prevent_product_move
before update of product_id on public.product_variants
for each row execute function public.prevent_variant_product_move();

create or replace function public.refresh_variant_product_stock(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_stock integer;
begin
  select coalesce(sum(stock), 0)::integer
  into total_stock
  from public.product_variants
  where product_id = p_product_id
    and is_active = true;

  update public.products
  set stock = total_stock
  where id = p_product_id
    and has_variants = true;
end;
$$;

create or replace function public.sync_variant_product_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_variant_product_stock(
    coalesce(new.product_id, old.product_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists product_variants_sync_product_stock on public.product_variants;
create trigger product_variants_sync_product_stock
after insert or update or delete on public.product_variants
for each row execute function public.sync_variant_product_stock();

-- Current production constraints may have a project-specific name. This block
-- removes exactly one old CHECK that references both status and stock, and
-- stops instead of guessing if the live schema does not match that assumption.
do $$
declare
  status_stock_constraint text;
  matching_constraint_count integer;
begin
  select count(*), min(conname)
  into matching_constraint_count, status_stock_constraint
  from pg_constraint
  where conrelid = 'public.products'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%'
    and pg_get_constraintdef(oid) ilike '%stock%';

  if matching_constraint_count = 1 then
    execute format(
      'alter table public.products drop constraint %I',
      status_stock_constraint
    );
  elsif matching_constraint_count > 1 then
    raise exception
      'Inventory migration stopped: multiple products status/stock constraints need manual review.';
  end if;
end;
$$;

-- `sold` remains accepted only for legacy rows. New application UI uses the
-- derived "Sold out" state whenever stock is zero.
alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('available', 'reserved', 'sold'));

alter table public.products
  drop constraint if exists products_stock_nonnegative_check;

alter table public.products
  add constraint products_stock_nonnegative_check
  check (stock >= 0);

-- `sold` is a legacy stored value; it can only coexist with zero stock.
-- This rejects malformed future data instead of deciding how to reinterpret it.
alter table public.products
  drop constraint if exists products_sold_zero_stock_check;

alter table public.products
  add constraint products_sold_zero_stock_check
  check (status <> 'sold' or stock = 0);

create or replace function public.record_sale(
  p_product_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_variant_id uuid default null,
  p_note text default null
)
returns table (
  sale_id uuid,
  product_id uuid,
  variant_id uuid,
  remaining_product_stock integer,
  remaining_variant_stock integer,
  effective_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_product public.products%rowtype;
  locked_variant public.product_variants%rowtype;
  inserted_sale_id uuid;
  current_product_stock integer;
begin
  if not public.is_lovelyn_admin() then
    raise exception 'Unauthorized sale request'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Sale quantity must be at least 1';
  end if;

  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Sale price must be 0 or higher';
  end if;

  select *
  into locked_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if locked_product.has_variants then
    if p_variant_id is null then
      raise exception 'Choose an in-stock variant before recording this sale';
    end if;

    select *
    into locked_variant
    from public.product_variants
    where id = p_variant_id
      and product_id = locked_product.id
      and is_active = true
    for update;

    if not found then
      raise exception 'The selected variant is unavailable';
    end if;

    if locked_variant.stock < p_quantity then
      raise exception 'Not enough stock is available for the selected variant';
    end if;

    update public.product_variants
    set stock = stock - p_quantity
    where id = locked_variant.id;
  else
    if p_variant_id is not null then
      raise exception 'This product does not use variants';
    end if;

    if locked_product.stock < p_quantity then
      raise exception 'Not enough product stock is available';
    end if;

    update public.products
    set stock = stock - p_quantity,
        status = case
          when status = 'sold' then 'available'
          else status
        end
    where id = locked_product.id;
  end if;

  select stock
  into current_product_stock
  from public.products
  where id = locked_product.id;

  insert into public.sales (
    product_id,
    variant_id,
    product_name,
    variant_label,
    quantity,
    unit_price,
    note
  )
  values (
    locked_product.id,
    p_variant_id,
    locked_product.name,
    case
      when locked_product.has_variants then locked_variant.label
      else null
    end,
    p_quantity,
    p_unit_price,
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into inserted_sale_id;

  return query
  select
    inserted_sale_id,
    locked_product.id,
    p_variant_id,
    current_product_stock,
    case
      when locked_product.has_variants then (
        select stock
        from public.product_variants
        where id = p_variant_id
      )
      else null
    end,
    case
      when locked_product.status = 'reserved' then 'reserved'
      when current_product_stock = 0 then 'sold_out'
      else 'available'
    end;
end;
$$;

revoke all on function public.record_sale(uuid, integer, numeric, uuid, text) from public;
grant execute on function public.record_sale(uuid, integer, numeric, uuid, text) to authenticated;

create or replace function public.get_public_product_variants(
  p_product_id uuid
)
returns table (
  id uuid,
  label text,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select variant.id, variant.label, variant.sort_order
  from public.product_variants as variant
  join public.products as product
    on product.id = variant.product_id
  where product.id = p_product_id
    and product.published = true
    and product.has_variants = true
    and product.stock > 0
    and variant.is_active = true
    and variant.stock > 0
  order by variant.sort_order asc, variant.id asc;
$$;

revoke all on function public.get_public_product_variants(uuid) from public;
grant execute on function public.get_public_product_variants(uuid) to anon, authenticated;

alter table public.categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.sales enable row level security;

drop policy if exists categories_public_read_active on public.categories;
create policy categories_public_read_active
on public.categories
for select
to anon, authenticated
using (is_active or public.is_lovelyn_admin());

drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage
on public.categories
for all
to authenticated
using (public.is_lovelyn_admin())
with check (public.is_lovelyn_admin());

drop policy if exists product_variants_admin_manage on public.product_variants;
create policy product_variants_admin_manage
on public.product_variants
for all
to authenticated
using (public.is_lovelyn_admin())
with check (public.is_lovelyn_admin());

drop policy if exists sales_admin_read on public.sales;
create policy sales_admin_read
on public.sales
for select
to authenticated
using (public.is_lovelyn_admin());

-- No direct sales insert/update/delete policy is created. record_sale is the
-- single write path for sale history and inventory reduction.
--
-- PRE-APPLY CHECKLIST FOR EXISTING TABLES:
-- 1. Verify products RLS permits anonymous SELECT only where published = true.
-- 2. Verify only the designated admin can manage products and product_images.
-- 3. Verify product-images Storage upload/remove stays admin-only.
-- 4. After applying, insert the one intended Auth user into admin_users.
-- 5. Confirm the old products status/stock constraint was the one safely
--    detected above before relying on Reserved products with physical stock.

commit;
