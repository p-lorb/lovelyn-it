import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  getAvailableQuantity,
  getReservedQuantity,
  getVariantConversionState,
  getVariantStockTotal,
} from '../lib/inventory'

function VariantManager({ product, onProductChange }) {
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newStock, setNewStock] = useState('0')
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')
  const conversionState = getVariantConversionState(product.stock)

  async function loadVariants() {
    if (!product.has_variants) {
      setVariants([])
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      console.error('Variants load error:', error)
      setMessage('Could not load variants.')
    } else {
      setVariants(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    const requestTimer = window.setTimeout(() => {
      loadVariants()
    }, 0)

    return () => window.clearTimeout(requestTimer)
    // The product identity intentionally controls the reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.has_variants, product.id])

  async function refreshProduct() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', product.id)
      .single()

    if (error) {
      console.error('Variant product refresh error:', error)
      setMessage('Inventory changed, but the product could not refresh.')
      return
    }

    onProductChange(data)
  }

  async function enableVariants() {
    if (!conversionState.canEnable) {
      setMessage(conversionState.message)
      return
    }

    setSavingId('mode')
    setMessage('')

    const { data, error } = await supabase
      .from('products')
      .update({ has_variants: true, stock: 0 })
      .eq('id', product.id)
      .select('*')
      .single()

    if (error) {
      console.error('Enable variants error:', error)
      setMessage('Could not enable variant inventory.')
    } else {
      onProductChange(data)
      setMessage('Variant inventory is enabled. Add your exact labels below.')
    }

    setSavingId(null)
  }

  async function addVariant(event) {
    event.preventDefault()
    const label = newLabel.trim()
    const stock = Number(newStock)

    if (!label) {
      setMessage('Enter the label you want to use.')
      return
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setMessage('Variant stock must be a whole number of 0 or higher.')
      return
    }

    setSavingId('new')
    setMessage('')

    const { error } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        label,
        stock,
        sort_order: variants.length,
        is_active: true,
      })

    if (error) {
      console.error('Create variant error:', error)
      setMessage(error.message || 'Could not add this variant.')
    } else {
      setNewLabel('')
      setNewStock('0')
      await loadVariants()
      await refreshProduct()
    }

    setSavingId(null)
  }

  async function updateVariant(variant, changes) {
    setSavingId(variant.id)
    setMessage('')

    const { error } = await supabase
      .from('product_variants')
      .update(changes)
      .eq('id', variant.id)
      .eq('product_id', product.id)

    if (error) {
      console.error('Update variant error:', error)
      setMessage(error.message || 'Could not save this variant.')
    } else {
      await loadVariants()
      await refreshProduct()
    }

    setSavingId(null)
  }

  async function saveVariant(variant) {
    const label = variant.label.trim()
    const stock = Number(variant.stock)

    if (!label) {
      setMessage('A variant label cannot be empty.')
      return
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setMessage('Variant stock must be a whole number of 0 or higher.')
      return
    }

    if (stock < getReservedQuantity(variant)) {
      setMessage(
        `Stock cannot be lower than ${getReservedQuantity(variant)} reserved unit(s). Release the reservation first.`
      )
      return
    }

    await updateVariant(variant, { label, stock })
  }

  async function moveVariant(variant, direction) {
    const index = variants.findIndex((item) => item.id === variant.id)
    const other = variants[index + direction]

    if (!other) {
      return
    }

    setSavingId(variant.id)
    setMessage('')

    const { error: firstError } = await supabase
      .from('product_variants')
      .update({ sort_order: other.sort_order })
      .eq('id', variant.id)

    const { error: secondError } = firstError
      ? { error: null }
      : await supabase
          .from('product_variants')
          .update({ sort_order: variant.sort_order })
          .eq('id', other.id)

    if (firstError || secondError) {
      console.error('Variant order error:', firstError || secondError)
      setMessage('Could not change variant order. Please try again.')
    } else {
      await loadVariants()
    }

    setSavingId(null)
  }

  async function retireVariant(variant) {
    if (getReservedQuantity(variant) > 0) {
      setMessage('Release or complete the reservation before retiring this size.')
      return
    }

    if (Number(variant.stock) > 0) {
      setMessage(
        'Set this variant stock to 0 before retiring it, so stock is never hidden accidentally.'
      )
      return
    }

    await updateVariant(variant, {
      is_active: !variant.is_active,
    })
  }

  async function removeVariant(variant) {
    if (getReservedQuantity(variant) > 0) {
      setMessage('Release or complete the reservation before removing this size.')
      return
    }

    if (Number(variant.stock) > 0) {
      setMessage('Set stock to 0 before removing a variant.')
      return
    }

    if (!window.confirm(`Remove ${variant.label}?`)) {
      return
    }

    setSavingId(variant.id)
    setMessage('')

    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variant.id)
      .eq('product_id', product.id)

    if (error) {
      console.error('Remove variant error:', error)
      setMessage(
        'This variant could not be removed. If it has sales history, retire it instead.'
      )
    } else {
      await loadVariants()
      await refreshProduct()
    }

    setSavingId(null)
  }

  return (
    <section className="admin-variant-manager">
      <div className="admin-variant-manager-heading">
        <div>
          <h2>Sizes & variants</h2>
          <p>
            Add the exact labels you use. The storefront shows active labels
            only when they have stock.
          </p>
        </div>

        <strong>
          {getAvailableQuantity(product)} available
          {' · '}
          {product.reserved_quantity ?? 0} reserved
        </strong>
      </div>

      {!product.has_variants ? (
        <div className="admin-variant-empty">
          <p>
            This product currently uses one shared stock quantity.
          </p>

          <p
            className="admin-variant-conversion-note"
            id="variant-conversion-note"
          >
            {conversionState.message}
          </p>

          <button
            type="button"
            onClick={enableVariants}
            disabled={
              savingId === 'mode' || !conversionState.canEnable
            }
            aria-describedby="variant-conversion-note"
          >
            {savingId === 'mode'
              ? 'Enabling...'
              : 'Use size or variant stock'}
          </button>
        </div>
      ) : (
        <>
          {loading ? (
            <p>Loading variants...</p>
          ) : (
            <div className="admin-variant-list">
              {variants.map((variant, index) => (
                <div className="admin-variant-row" key={variant.id}>
                  <input
                    value={variant.label}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((item) =>
                          item.id === variant.id
                            ? { ...item, label: event.target.value }
                            : item
                        )
                      )
                    }
                    disabled={savingId === variant.id}
                    aria-label={`${variant.label} label`}
                  />

                  <input
                    type="number"
                    min={variant.reserved_quantity ?? 0}
                    step="1"
                    value={variant.stock}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((item) =>
                          item.id === variant.id
                            ? { ...item, stock: event.target.value }
                            : item
                        )
                      )
                    }
                    disabled={savingId === variant.id}
                    aria-label={`${variant.label} stock`}
                  />

                  <span>
                    {variant.is_active ? 'Active' : 'Retired'}
                    {` · ${getAvailableQuantity(variant)} available`}
                    {getReservedQuantity(variant) > 0 &&
                      ` · ${getReservedQuantity(variant)} reserved`}
                  </span>

                  <div className="admin-variant-actions">
                    <button
                      type="button"
                      onClick={() => saveVariant(variant)}
                      disabled={savingId === variant.id}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => moveVariant(variant, -1)}
                      disabled={index === 0 || savingId === variant.id}
                      aria-label={`Move ${variant.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveVariant(variant, 1)}
                      disabled={
                        index === variants.length - 1 ||
                        savingId === variant.id
                      }
                      aria-label={`Move ${variant.label} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => retireVariant(variant)}
                      disabled={savingId === variant.id}
                    >
                      {variant.is_active ? 'Retire' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeVariant(variant)}
                      disabled={savingId === variant.id}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="admin-variant-add" onSubmit={addVariant}>
            <label>
              New label
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Enter your exact label"
                disabled={savingId === 'new'}
              />
            </label>

            <label>
              Stock
              <input
                type="number"
                min="0"
                step="1"
                value={newStock}
                onChange={(event) => setNewStock(event.target.value)}
                disabled={savingId === 'new'}
              />
            </label>

            <button type="submit" disabled={savingId === 'new'}>
              {savingId === 'new' ? 'Adding...' : 'Add variant'}
            </button>
          </form>
        </>
      )}

      {product.has_variants && variants.length > 0 && (
        <p className="admin-variant-total-note">
          Active variant total: {getVariantStockTotal(variants)}
        </p>
      )}

      {message && <p className="admin-variant-message">{message}</p>}
    </section>
  )
}

export default VariantManager
