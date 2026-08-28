import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function RecordSaleDialog({ product, onClose, onRecorded }) {
  const [variants, setVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(
    Boolean(product.has_variants)
  )
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState(
    product.price ?? ''
  )
  const [variantId, setVariantId] = useState('')
  const [note, setNote] = useState('')
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
        console.error('Sale variants error:', error)
        setErrorMessage('Could not load the available variants.')
      } else {
        setVariants(data ?? [])
      }

      setVariantsLoading(false)
    }

    loadVariants()
  }, [product.has_variants, product.id])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const parsedQuantity = Number(quantity)
    const parsedPrice = Number(unitPrice)

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('Quantity must be at least 1.')
      return
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage('Enter a valid final price per unit.')
      return
    }

    if (product.has_variants && !variantId) {
      setErrorMessage('Choose the size or variant that was sold.')
      return
    }

    setSaving(true)

    const { data, error } = await supabase.rpc('record_sale', {
      p_product_id: product.id,
      p_quantity: parsedQuantity,
      p_unit_price: parsedPrice,
      p_variant_id: product.has_variants ? variantId : null,
      p_note: note,
    })

    if (error) {
      console.error('Record sale error:', error)
      setErrorMessage(error.message || 'Could not record this sale.')
      setSaving(false)
      return
    }

    onRecorded(data?.[0] ?? null)
  }

  return (
    <div className="admin-dialog-backdrop">
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-sale-title"
      >
        <div className="admin-dialog-heading">
          <div>
            <p className="admin-eyebrow">Lovelyn It!</p>
            <h2 id="record-sale-title">Record sale</h2>
            <p>{product.name}</p>
          </div>

          <button
            type="button"
            className="admin-dialog-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close record sale"
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
                  {variantsLoading
                    ? 'Loading variants...'
                    : 'Choose a size'}
                </option>

                {variants.map((variant) => (
                  <option value={variant.id} key={variant.id}>
                    {variant.label} ({variant.stock} available)
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="admin-dialog-grid">
            <label>
              Quantity sold
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={saving}
              />
            </label>

            <label>
              Final price per unit
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                disabled={saving}
                placeholder="0"
              />
            </label>
          </div>

          <label>
            Note <span>(optional)</span>
            <textarea
              rows="3"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
              placeholder="Optional private note"
            />
          </label>

          {errorMessage && (
            <p className="admin-dialog-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="admin-dialog-actions">
            <button
              type="button"
              className="admin-dialog-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" disabled={saving || variantsLoading}>
              {saving ? 'Recording...' : 'Record sale'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default RecordSaleDialog
