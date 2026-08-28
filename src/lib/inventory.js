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

  if (numericStock === null) {
    return false
  }

  if (status === 'sold') {
    return numericStock === 0
  }

  return ['available', 'reserved'].includes(status)
}

export function inventoryCanBePublished(product) {
  return getEffectiveInventoryStatus(product) !== INVENTORY_STATUSES.SOLD_OUT
}

export function getEffectiveInventoryStatus(product) {
  const stock = toStockNumber(product?.stock) ?? 0

  // Existing Reserved listings created under the old inventory model can
  // legitimately have zero stock. Reservation is an explicit manual hold.
  if (product?.status === INVENTORY_STATUSES.RESERVED) {
    return INVENTORY_STATUSES.RESERVED
  }

  if (stock === 0) {
    return INVENTORY_STATUSES.SOLD_OUT
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

export function getVariantConversionState(sharedStock) {
  const stock = toStockNumber(sharedStock)

  if (stock === 0) {
    return {
      canEnable: true,
      message:
        'Shared stock is 0. You can safely switch to size or variant stock.',
    }
  }

  if (stock !== null) {
    return {
      canEnable: false,
      message: `Shared stock is currently ${stock}. To switch to size or variant stock, shared stock must be 0 first. This prevents existing units from being assigned to sizes automatically.`,
    }
  }

  return {
    canEnable: false,
    message:
      'Shared stock must be a valid whole number before switching to size or variant stock.',
  }
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
