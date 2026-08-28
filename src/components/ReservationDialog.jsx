import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  canReleaseReservation,
  canReserveQuantity,
  getAvailableQuantity,
  getReservedQuantity,
} from '../lib/inventory'

function ReservationDialog({ product, mode, onClose, onCompleted }) {
  const isReserve = mode === 'reserve'
  const [variants, setVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(
    Boolean(product.has_variants)
  )
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadVariants() {
      if (!product.has_variants) {
        return
      }

      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .gt('stock', 0)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })

      if (error) {
        console.error('Reservation variants error:', error)
        setErrorMessage('Could not load the product variants.')
      } else {
        setVariants(data ?? [])
      }

      setVariantsLoading(false)
    }

    loadVariants()
  }, [product.has_variants, product.id])

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === variantId),
    [variantId, variants]
  )
  const selectedInventory = product.has_variants ? selectedVariant : product
  const eligibleVariants = variants.filter((variant) =>
    isReserve
      ? getAvailableQuantity(variant) > 0
      : getReservedQuantity(variant) > 0
  )
  const availableQuantity = getAvailableQuantity(selectedInventory)
  const reservedQuantity = getReservedQuantity(selectedInventory)
  const title = isReserve ? 'Reserve stock' : 'Release reservation'

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const parsedQuantity = Number(quantity)
    const isValidQuantity = isReserve
      ? canReserveQuantity(selectedInventory, parsedQuantity)
      : canReleaseReservation(selectedInventory, parsedQuantity)

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('Quantity must be at least 1.')
      return
    }

    if (product.has_variants && !variantId) {
      setErrorMessage('Choose the size or variant to update.')
      return
    }

    if (!isValidQuantity) {
      setErrorMessage(
        isReserve
          ? 'That quantity is no longer available to reserve.'
          : 'That quantity is no longer reserved.'
      )
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc(
      isReserve ? 'reserve_stock' : 'release_reservation',
      {
        p_product_id: product.id,
        p_quantity: parsedQuantity,
        p_variant_id: product.has_variants ? variantId : null,
      }
    )

    if (error) {
      console.error(`${title} error:`, error)
      setErrorMessage(error.message || `Could not ${title.toLowerCase()}.`)
      setSaving(false)
      return
    }

    onCompleted(data?.[0] ?? null)
  }

  return (
    <div className="admin-dialog-backdrop">
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-dialog-title"
      >
        <div className="admin-dialog-heading">
          <div>
            <p className="admin-eyebrow">Lovelyn It!</p>
            <h2 id="reservation-dialog-title">{title}</h2>
            <p>{product.name}</p>
          </div>

          <button
            type="button"
            className="admin-dialog-close"
            onClick={onClose}
            disabled={saving}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-dialog-form">
          {product.has_variants && (
            <label>
              Size or variant
              <select
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                disabled={variantsLoading || saving}
              >
                <option value="">
                  {variantsLoading ? 'Loading variants...' : 'Choose a size'}
                </option>

                {eligibleVariants.map((variant) => (
                  <option value={variant.id} key={variant.id}>
                    {variant.label} ({getAvailableQuantity(variant)} available, {getReservedQuantity(variant)} reserved)
                  </option>
                ))}
              </select>
            </label>
          )}

          {!product.has_variants && (
            <p className="admin-dialog-stock-note">
              {availableQuantity} available · {reservedQuantity} reserved
            </p>
          )}

          <label>
            {isReserve ? 'Quantity to reserve' : 'Quantity to release'}
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={saving || variantsLoading}
            />
          </label>

          {selectedInventory && (
            <p className="admin-dialog-stock-note">
              {isReserve
                ? `${availableQuantity} currently available to reserve.`
                : `${reservedQuantity} currently reserved.`}
            </p>
          )}

          {errorMessage && (
            <p className="admin-dialog-error" role="alert">{errorMessage}</p>
          )}

          <div className="admin-dialog-actions">
            <button type="button" className="admin-dialog-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving || variantsLoading}>
              {saving ? 'Saving...' : title}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ReservationDialog
