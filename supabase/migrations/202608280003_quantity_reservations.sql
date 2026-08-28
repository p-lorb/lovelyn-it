-- Add quantity-based reservations without changing the existing whole-listing
-- Reserved status. Migration 001 and 002 must already be applied first.

begin;

alter table public.products
  add column if not exists reserved_quantity integer not null default 0;

alter table public.product_variants
  add column if not exists reserved_quantity integer not null default 0;

alter table public.sales
  add column if not exists used_reserved_stock boolean not null default false;

alter table public.products
  drop constraint if exists products_reserved_quantity_nonnegative_check;

alter table public.products
  add constraint products_reserved_quantity_nonnegative_check
  check (reserved_quantity >= 0);

alter table public.products
  drop constraint if exists products_reserved_quantity_within_stock_check;

alter table public.products
  add constraint products_reserved_quantity_within_stock_check
  check (reserved_quantity <= stock);

alter table public.product_variants
  drop constraint if exists product_variants_reserved_quantity_nonnegative_check;

alter table public.product_variants
  add constraint product_variants_reserved_quantity_nonnegative_check
  check (reserved_quantity >= 0);

alter table public.product_variants
  drop constraint if exists product_variants_reserved_quantity_within_stock_check;

alter table public.product_variants
  add constraint product_variants_reserved_quantity_within_stock_check
  check (reserved_quantity <= stock);

alter table public.product_variants
  drop constraint if exists product_variants_inactive_reserved_quantity_check;

alter table public.product_variants
  add constraint product_variants_inactive_reserved_quantity_check
  check (is_active or reserved_quantity = 0);

-- For variant products, product totals are derived from active variant rows.
-- They are never edited independently in the admin UI.
create or replace function public.refresh_variant_product_stock(
  p_product_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_stock integer;
  total_reserved integer;
begin
  select
    coalesce(sum(variant.stock), 0),
    coalesce(sum(variant.reserved_quantity), 0)
  into total_stock, total_reserved
  from public.product_variants as variant
  where variant.product_id = p_product_id
    and variant.is_active = true;

  update public.products as product
  set stock = total_stock,
      reserved_quantity = total_reserved,
      status = case
        when product.status = 'sold' and total_stock > 0 then 'available'
        else product.status
      end
  where product.id = p_product_id
    and product.has_variants = true;
end;
$$;

revoke all on function public.refresh_variant_product_stock(bigint) from public, anon, authenticated;

-- The sale RPC gains one explicit switch for consuming a previous quantity
-- reservation. Replace the prior signature rather than overloading it.
drop function if exists public.record_sale(bigint, integer, numeric, uuid, text);

create function public.record_sale(
  p_product_id bigint,
  p_quantity integer,
  p_unit_price numeric,
  p_variant_id uuid default null,
  p_note text default null,
  p_use_reserved_stock boolean default false
)
returns table (
  sale_id uuid,
  product_id bigint,
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
  current_product_reserved integer;
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

  select product.*
  into locked_product
  from public.products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if locked_product.has_variants then
    if p_variant_id is null then
      raise exception 'Choose an in-stock variant before recording this sale';
    end if;

    select variant.*
    into locked_variant
    from public.product_variants as variant
    where variant.id = p_variant_id
      and variant.product_id = locked_product.id
      and variant.is_active = true
    for update;

    if not found then
      raise exception 'The selected variant is unavailable';
    end if;

    if p_use_reserved_stock then
      if locked_variant.reserved_quantity < p_quantity then
        raise exception 'Not enough reserved stock is available for the selected variant';
      end if;
    elsif locked_variant.stock - locked_variant.reserved_quantity < p_quantity then
      raise exception 'Not enough unreserved stock is available for the selected variant';
    end if;

    update public.product_variants as variant
    set stock = variant.stock - p_quantity,
        reserved_quantity = variant.reserved_quantity - case
          when p_use_reserved_stock then p_quantity
          else 0
        end
    where variant.id = locked_variant.id;
  else
    if p_variant_id is not null then
      raise exception 'This product does not use variants';
    end if;

    if p_use_reserved_stock then
      if locked_product.reserved_quantity < p_quantity then
        raise exception 'Not enough reserved stock is available for this product';
      end if;
    elsif locked_product.stock - locked_product.reserved_quantity < p_quantity then
      raise exception 'Not enough unreserved stock is available for this product';
    end if;

    update public.products as product
    set stock = product.stock - p_quantity,
        reserved_quantity = product.reserved_quantity - case
          when p_use_reserved_stock then p_quantity
          else 0
        end,
        status = case
          when product.status = 'sold' then 'available'
          else product.status
        end
    where product.id = locked_product.id;
  end if;

  select product.stock, product.reserved_quantity
  into current_product_stock, current_product_reserved
  from public.products as product
  where product.id = locked_product.id;

  insert into public.sales (
    product_id,
    variant_id,
    product_name,
    variant_label,
    quantity,
    unit_price,
    note,
    used_reserved_stock
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
    nullif(btrim(coalesce(p_note, '')), ''),
    p_use_reserved_stock
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
        select variant.stock
        from public.product_variants as variant
        where variant.id = p_variant_id
      )
      else null
    end,
    case
      when locked_product.status = 'reserved' then 'reserved'
      when current_product_stock = 0 then 'sold_out'
      when current_product_stock - current_product_reserved = 0 then 'reserved'
      else 'available'
    end;
end;
$$;

revoke all on function public.record_sale(bigint, integer, numeric, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_sale(bigint, integer, numeric, uuid, text, boolean) to authenticated;

create function public.reserve_stock(
  p_product_id bigint,
  p_quantity integer,
  p_variant_id uuid default null
)
returns table (
  product_id bigint,
  variant_id uuid,
  remaining_product_available integer,
  remaining_variant_available integer,
  effective_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_product public.products%rowtype;
  locked_variant public.product_variants%rowtype;
  current_product_stock integer;
  current_product_reserved integer;
begin
  if not public.is_lovelyn_admin() then
    raise exception 'Unauthorized reservation request'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Reservation quantity must be at least 1';
  end if;

  select product.*
  into locked_product
  from public.products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if locked_product.has_variants then
    if p_variant_id is null then
      raise exception 'Choose a variant before reserving stock';
    end if;

    select variant.*
    into locked_variant
    from public.product_variants as variant
    where variant.id = p_variant_id
      and variant.product_id = locked_product.id
      and variant.is_active = true
    for update;

    if not found then
      raise exception 'The selected variant is unavailable';
    end if;

    if locked_variant.stock - locked_variant.reserved_quantity < p_quantity then
      raise exception 'Not enough unreserved stock is available for the selected variant';
    end if;

    update public.product_variants as variant
    set reserved_quantity = variant.reserved_quantity + p_quantity
    where variant.id = locked_variant.id;
  else
    if p_variant_id is not null then
      raise exception 'This product does not use variants';
    end if;

    if locked_product.stock - locked_product.reserved_quantity < p_quantity then
      raise exception 'Not enough unreserved stock is available for this product';
    end if;

    update public.products as product
    set reserved_quantity = product.reserved_quantity + p_quantity
    where product.id = locked_product.id;
  end if;

  select product.stock, product.reserved_quantity
  into current_product_stock, current_product_reserved
  from public.products as product
  where product.id = locked_product.id;

  return query
  select
    locked_product.id,
    p_variant_id,
    current_product_stock - current_product_reserved,
    case
      when locked_product.has_variants then (
        select variant.stock - variant.reserved_quantity
        from public.product_variants as variant
        where variant.id = p_variant_id
      )
      else null
    end,
    case
      when locked_product.status = 'reserved' then 'reserved'
      when current_product_stock = 0 then 'sold_out'
      when current_product_stock - current_product_reserved = 0 then 'reserved'
      else 'available'
    end;
end;
$$;

revoke all on function public.reserve_stock(bigint, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_stock(bigint, integer, uuid) to authenticated;

create function public.release_reservation(
  p_product_id bigint,
  p_quantity integer,
  p_variant_id uuid default null
)
returns table (
  product_id bigint,
  variant_id uuid,
  remaining_product_available integer,
  remaining_variant_available integer,
  effective_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_product public.products%rowtype;
  locked_variant public.product_variants%rowtype;
  current_product_stock integer;
  current_product_reserved integer;
begin
  if not public.is_lovelyn_admin() then
    raise exception 'Unauthorized reservation request'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Release quantity must be at least 1';
  end if;

  select product.*
  into locked_product
  from public.products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if locked_product.has_variants then
    if p_variant_id is null then
      raise exception 'Choose a variant before releasing stock';
    end if;

    select variant.*
    into locked_variant
    from public.product_variants as variant
    where variant.id = p_variant_id
      and variant.product_id = locked_product.id
      and variant.is_active = true
    for update;

    if not found then
      raise exception 'The selected variant is unavailable';
    end if;

    if locked_variant.reserved_quantity < p_quantity then
      raise exception 'Cannot release more than the selected variant has reserved';
    end if;

    update public.product_variants as variant
    set reserved_quantity = variant.reserved_quantity - p_quantity
    where variant.id = locked_variant.id;
  else
    if p_variant_id is not null then
      raise exception 'This product does not use variants';
    end if;

    if locked_product.reserved_quantity < p_quantity then
      raise exception 'Cannot release more than this product has reserved';
    end if;

    update public.products as product
    set reserved_quantity = product.reserved_quantity - p_quantity
    where product.id = locked_product.id;
  end if;

  select product.stock, product.reserved_quantity
  into current_product_stock, current_product_reserved
  from public.products as product
  where product.id = locked_product.id;

  return query
  select
    locked_product.id,
    p_variant_id,
    current_product_stock - current_product_reserved,
    case
      when locked_product.has_variants then (
        select variant.stock - variant.reserved_quantity
        from public.product_variants as variant
        where variant.id = p_variant_id
      )
      else null
    end,
    case
      when locked_product.status = 'reserved' then 'reserved'
      when current_product_stock = 0 then 'sold_out'
      when current_product_stock - current_product_reserved = 0 then 'reserved'
      else 'available'
    end;
end;
$$;

revoke all on function public.release_reservation(bigint, integer, uuid) from public, anon, authenticated;
grant execute on function public.release_reservation(bigint, integer, uuid) to authenticated;

-- Public size choices include active physical stock. A fully quantity-reserved
-- size is returned as unavailable so the storefront can label it Reserved.
drop function if exists public.get_public_product_variants(bigint);

create function public.get_public_product_variants(
  p_product_id bigint
)
returns table (
  id uuid,
  label text,
  sort_order integer,
  is_available boolean,
  is_reserved boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    variant.id,
    variant.label,
    variant.sort_order,
    variant.stock - variant.reserved_quantity > 0 as is_available,
    variant.stock - variant.reserved_quantity = 0 as is_reserved
  from public.product_variants as variant
  join public.products as product
    on product.id = variant.product_id
  where product.id = p_product_id
    and product.published = true
    and product.has_variants = true
    and variant.is_active = true
    and variant.stock > 0
  order by variant.sort_order asc, variant.id asc;
$$;

revoke all on function public.get_public_product_variants(bigint) from public, anon, authenticated;
grant execute on function public.get_public_product_variants(bigint) to anon, authenticated;

commit;
