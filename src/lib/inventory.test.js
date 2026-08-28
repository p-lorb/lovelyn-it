import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRecordSaleQuantity,
  canReleaseReservation,
  canReserveQuantity,
  getAvailableQuantity,
  getAvailableVariants,
  getEffectiveInventoryStatus,
  getVariantConversionState,
  getVariantStockTotal,
  inventoryStateIsValid,
  INVENTORY_STATUSES,
  isProductAvailable,
} from './inventory.js'

test('a single-stock product is available when stock exists', () => {
  const product = {
    status: 'available',
    stock: 3,
  }

  assert.equal(
    getEffectiveInventoryStatus(product),
    INVENTORY_STATUSES.AVAILABLE
  )
  assert.equal(isProductAvailable(product), true)
})

test('Reserved takes priority over stock and is not available to buyers', () => {
  const legacyReservedProduct = {
    status: 'reserved',
    stock: 0,
  }

  const product = {
    status: 'reserved',
    stock: 3,
  }

  assert.equal(
    getEffectiveInventoryStatus(legacyReservedProduct),
    INVENTORY_STATUSES.RESERVED
  )
  assert.equal(
    getEffectiveInventoryStatus(product),
    INVENTORY_STATUSES.RESERVED
  )
  assert.equal(isProductAvailable(product), false)
})

test('available stock determines available versus sold out', () => {
  const soldOutProduct = {
    status: 'available',
    stock: 0,
  }

  const restockedProduct = {
    status: 'available',
    stock: 1,
  }

  assert.equal(
    getEffectiveInventoryStatus(soldOutProduct),
    INVENTORY_STATUSES.SOLD_OUT
  )
  assert.equal(
    getEffectiveInventoryStatus(restockedProduct),
    INVENTORY_STATUSES.AVAILABLE
  )
})

test('quantity reservations reduce available stock without changing physical stock', () => {
  const product = {
    status: 'available',
    stock: 5,
    reserved_quantity: 2,
  }

  assert.equal(getAvailableQuantity(product), 3)
  assert.equal(getEffectiveInventoryStatus(product), INVENTORY_STATUSES.AVAILABLE)
  assert.equal(canReserveQuantity(product, 3), true)
  assert.equal(canReserveQuantity(product, 4), false)
  assert.equal(canReleaseReservation(product, 2), true)
  assert.equal(canReleaseReservation(product, 3), false)
  assert.equal(canRecordSaleQuantity(product, 3), true)
  assert.equal(canRecordSaleQuantity(product, 4), false)
  assert.equal(canRecordSaleQuantity(product, 2, true), true)
  assert.equal(canRecordSaleQuantity(product, 3, true), false)
})

test('a fully quantity-reserved product is reserved instead of sold out', () => {
  const product = {
    status: 'available',
    stock: 4,
    reserved_quantity: 4,
  }

  assert.equal(getAvailableQuantity(product), 0)
  assert.equal(getEffectiveInventoryStatus(product), INVENTORY_STATUSES.RESERVED)
  assert.equal(isProductAvailable(product), false)
})

test('a Reserved variant product remains Reserved even when totals are zero', () => {
  const product = {
    status: 'reserved',
    stock: getVariantStockTotal([
      { id: 's', stock: 0, is_active: true, sort_order: 0 },
      { id: 'm', stock: 0, is_active: true, sort_order: 1 },
    ]),
    has_variants: true,
  }

  assert.equal(
    getEffectiveInventoryStatus(product),
    INVENTORY_STATUSES.RESERVED
  )
})

test('a non-Reserved variant product with no stock is sold out', () => {
  const product = {
    status: 'available',
    stock: getVariantStockTotal([
      { id: 's', stock: 0, is_active: true, sort_order: 0 },
      { id: 'm', stock: 0, is_active: true, sort_order: 1 },
    ]),
    has_variants: true,
  }

  assert.equal(
    getEffectiveInventoryStatus(product),
    INVENTORY_STATUSES.SOLD_OUT
  )
})

test('legacy Sold status is valid only with zero stock', () => {
  assert.equal(inventoryStateIsValid('sold', 0), true)
  assert.equal(inventoryStateIsValid('sold', 1), false)
})

test('variant totals use active variants only', () => {
  const variants = [
    { id: 's', stock: 2, is_active: true, sort_order: 0 },
    { id: 'm', stock: 1, is_active: true, sort_order: 1 },
    { id: 'retired', stock: 0, is_active: false, sort_order: 2 },
  ]

  assert.equal(getVariantStockTotal(variants), 3)
})

test('zero-stock variants are not shown to customers', () => {
  const variants = [
    { id: 'xl', label: 'XL', stock: 1, is_active: true, sort_order: 2 },
    { id: 'l', label: 'L', stock: 0, is_active: true, sort_order: 1 },
    { id: 's', label: 'S', stock: 2, is_active: true, sort_order: 0 },
  ]

  assert.deepEqual(
    getAvailableVariants(variants).map((variant) => variant.label),
    ['S', 'XL']
  )
})

test('fully reserved variants are not customer-selectable', () => {
  const variants = [
    { id: 's', label: 'S', stock: 2, reserved_quantity: 2, is_active: true, sort_order: 0 },
    { id: 'm', label: 'M', stock: 2, reserved_quantity: 1, is_active: true, sort_order: 1 },
  ]

  assert.deepEqual(
    getAvailableVariants(variants).map((variant) => variant.label),
    ['M']
  )
})

test('all zero-stock variants produce a zero total', () => {
  const variants = [
    { id: 's', stock: 0, is_active: true, sort_order: 0 },
    { id: 'm', stock: 0, is_active: true, sort_order: 1 },
  ]

  assert.equal(getVariantStockTotal(variants), 0)
})

test('shared stock must be zero before variant inventory can be enabled', () => {
  const conversion = getVariantConversionState(3)

  assert.equal(conversion.canEnable, false)
  assert.match(conversion.message, /currently 3/)
  assert.match(conversion.message, /must be 0 first/)
})

test('zero shared stock allows safe variant inventory conversion', () => {
  const conversion = getVariantConversionState(0)

  assert.equal(conversion.canEnable, true)
  assert.match(conversion.message, /Shared stock is 0/)
})
