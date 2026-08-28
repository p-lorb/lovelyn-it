import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAvailableVariants,
  getEffectiveInventoryStatus,
  getVariantStockTotal,
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

test('Reserved keeps physical stock but is not available to buyers', () => {
  const product = {
    status: 'reserved',
    stock: 3,
  }

  assert.equal(
    getEffectiveInventoryStatus(product),
    INVENTORY_STATUSES.RESERVED
  )
  assert.equal(isProductAvailable(product), false)
})

test('zero stock is sold out and restocking returns availability', () => {
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

test('all zero-stock variants produce a zero total', () => {
  const variants = [
    { id: 's', stock: 0, is_active: true, sort_order: 0 },
    { id: 'm', stock: 0, is_active: true, sort_order: 1 },
  ]

  assert.equal(getVariantStockTotal(variants), 0)
})
