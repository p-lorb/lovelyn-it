-- Fix record_sale identifier ambiguity after the initial sales/variants migration.
-- Migration 001 is already applied where this is needed, so this only replaces
-- the existing RPC and reasserts its intended Data API privilege.

begin;

create or replace function public.record_sale(
  p_product_id bigint,
  p_quantity integer,
  p_unit_price numeric,
  p_variant_id uuid default null,
  p_note text default null
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

    if locked_variant.stock < p_quantity then
      raise exception 'Not enough stock is available for the selected variant';
    end if;

    update public.product_variants as variant
    set stock = variant.stock - p_quantity
    where variant.id = locked_variant.id;
  else
    if p_variant_id is not null then
      raise exception 'This product does not use variants';
    end if;

    if locked_product.stock < p_quantity then
      raise exception 'Not enough product stock is available';
    end if;

    update public.products as product
    set stock = product.stock - p_quantity,
        status = case
          when product.status = 'sold' then 'available'
          else product.status
        end
    where product.id = locked_product.id;
  end if;

  select product.stock
  into current_product_stock
  from public.products as product
  where product.id = locked_product.id;

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
        select variant.stock
        from public.product_variants as variant
        where variant.id = p_variant_id
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

revoke all on function public.record_sale(bigint, integer, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.record_sale(bigint, integer, numeric, uuid, text) to authenticated;

commit;
