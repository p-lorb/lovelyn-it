import assert from 'node:assert/strict'
import test from 'node:test'
import { getCategoryDeletionState } from './categories.js'

test('an unused category can be deleted', () => {
  assert.deepEqual(getCategoryDeletionState(0), {
    canDelete: true,
    productCount: 0,
  })
})

test('a category used by products cannot be deleted', () => {
  assert.deepEqual(getCategoryDeletionState(2), {
    canDelete: false,
    productCount: 2,
  })
})
