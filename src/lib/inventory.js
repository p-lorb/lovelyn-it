export const INVENTORY_STATUSES = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD_OUT: 'sold_out',
}

export function toStockNumber(stock) {
  const numericStock = Number(stock)

  return Number.isInteger(numericStock) && numericStock >= 0
    ? numericStock
    : null
}

export function inventoryStateIsValid(status, stock) {
  const numericStock = toStockNumber(stock)

  return (
    numericStock !== null &&
    ['available', 'reserved', 'sold'].includes(status)
  )
}

export function inventoryCanBePublished(product) {
  return getEffectiveInventoryStatus(product) !== INVENTORY_STATUSES.SOLD_OUT
}

export function getEffectiveInventoryStatus(product) {
  const stock = toStockNumber(product?.stock) ?? 0

  if (stock === 0) {
    return INVENTORY_STATUSES.SOLD_OUT
  }

  if (product?.status === INVENTORY_STATUSES.RESERVED) {
    return INVENTORY_STATUSES.RESERVED
  }

  return INVENTORY_STATUSES.AVAILABLE
}

export function isProductAvailable(product) {
  return (
    getEffectiveInventoryStatus(product) ===
    INVENTORY_STATUSES.AVAILABLE
  )
}

export function getVariantStockTotal(variants) {
  return (variants ?? []).reduce((total, variant) => {
    if (!variant?.is_active) {
      return total
    }

    return total + (toStockNumber(variant.stock) ?? 0)
  }, 0)
}

export function getAvailableVariants(variants) {
  return (variants ?? [])
    .filter(
      (variant) =>
        variant?.is_active &&
        (toStockNumber(variant.stock) ?? 0) > 0
    )
    .sort((first, second) => {
      const orderDifference =
        Number(first.sort_order ?? 0) -
        Number(second.sort_order ?? 0)

      if (orderDifference !== 0) {
        return orderDifference
      }

      return String(first.id).localeCompare(String(second.id))
    })
}
