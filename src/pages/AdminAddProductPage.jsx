import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { inventoryStateIsValid } from '../lib/inventory'
import { sortCategories } from '../lib/categories'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

function AdminAddProductPage() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category_id: '',
    condition: 'New, unused',
    stock: 1,
    price: '',
    status: 'available',
    description: '',
  })

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdProduct, setCreatedProduct] = useState(null)
  const [selectedCoverImage, setSelectedCoverImage] = useState(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [coverPreviewUrl])

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)
      setCheckingSession(false)
    }

    checkSession()
  }, [])

  useEffect(() => {
    if (!session) {
      return undefined
    }

    const requestTimer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, sort_order, is_active')
        .eq('is_active', true)

      if (error) {
        console.error('Add product categories error:', error)
        setErrorMessage('Could not load categories. Please try again.')
        return
      }

      setCategories(sortCategories(data))
    }, 0)

    return () => window.clearTimeout(requestTimer)
  }, [session])

  function createSlug(name) {
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return slug || 'product'
  }

  async function generateUniqueSlug(name) {
    const baseSlug = createSlug(name)

    const { data, error } = await supabase
      .from('products')
      .select('slug')
      .like('slug', `${baseSlug}%`)

    if (error) {
      throw error
    }

    const existingSlugs = new Set(
      (data ?? []).map(
        (product) => product.slug
      )
    )

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug
    }

    let number = 2

    while (
      existingSlugs.has(
        `${baseSlug}-${number}`
      )
    ) {
      number += 1
    }

    return `${baseSlug}-${number}`
  }

  function handleFieldChange(event) {
    const {
      name,
      value,
    } = event.target

    if (name === 'status') {
      setFormData((current) => {
        return {
          ...current,
          status: value,
        }
      })

      return
    }

    if (name === 'stock') {
      setFormData((current) => {
        return {
          ...current,
          stock: value,
        }
      })

      return
    }

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function resetForm() {
    setFormData({
      name: '',
      brand: '',
      category_id: '',
      condition: 'New, unused',
      stock: 1,
      price: '',
      status: 'available',
      description: '',
    })

    setCreatedProduct(null)
    setErrorMessage('')
    setSelectedCoverImage(null)

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    setCoverPreviewUrl('')
  }

  function validateImage(file) {
    if (!file) {
      return 'Please choose an image.'
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Images must be JPEG, PNG, or WebP.'
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return 'The cover photo must be 10 MB or smaller.'
    }

    return null
  }

  function getFileExtension(file) {
    if (file.type === 'image/png') {
      return 'png'
    }

    if (file.type === 'image/webp') {
      return 'webp'
    }

    return 'jpg'
  }

  function handleCoverSelection(event) {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      return
    }

    const validationError = validateImage(file)

    if (validationError) {
      setErrorMessage(validationError)
      event.target.value = ''
      return
    }

    setErrorMessage('')
    setSelectedCoverImage(file)

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    setCoverPreviewUrl(URL.createObjectURL(file))
  }

  async function uploadCoverPhoto(productId, file) {
    const imagePath =
      `products/${productId}/cover/` +
      `${Date.now()}.${getFileExtension(file)}`

    const { error: uploadError } = await supabase
      .storage
      .from('product-images')
      .upload(imagePath, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    const { error: attachError } = await supabase
      .from('products')
      .update({ image_path: imagePath })
      .eq('id', productId)

    if (attachError) {
      await supabase
        .storage
        .from('product-images')
        .remove([imagePath])

      throw attachError
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setErrorMessage('')

    if (!formData.name.trim()) {
      setErrorMessage(
        'Product name is required.'
      )
      return
    }

    const selectedCategory = categories.find(
      (category) => category.id === formData.category_id
    )

    if (!selectedCategory) {
      setErrorMessage('Choose a category before creating the product.')
      return
    }

    if (
      formData.stock === '' ||
      formData.stock === null ||
      formData.stock === undefined
    ) {
      setErrorMessage(
        'Please enter the stock amount.'
      )
      return
    }

    const stock = Number(
      formData.stock
    )

    if (
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setErrorMessage(
        'Stock must be a whole number of 0 or higher.'
      )
      return
    }

    if (
      !inventoryStateIsValid(
        formData.status,
        stock
      )
    ) {
      setErrorMessage(
        'The stock and status combination is not valid.'
      )
      return
    }

    let price = null

    if (
      formData.price !== '' &&
      formData.price !== null
    ) {
      price = Number(
        formData.price
      )

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        setErrorMessage(
          'Price must be 0 or higher, or leave it blank.'
        )
        return
      }
    }

    setSaving(true)

    try {
      const slug =
        await generateUniqueSlug(
          formData.name.trim()
        )

      const {
        data,
        error,
      } = await supabase
        .from('products')
        .insert({
          name:
            formData.name.trim(),

          brand:
            formData.brand.trim() ||
            null,

          category_id: selectedCategory.id,
          category: selectedCategory.name,

          condition:
            formData.condition.trim() ||
            'New, unused',

          stock,

          price,

          status:
            formData.status,

          description:
            formData.description.trim() ||
            null,

          published: false,

          slug,
        })
        .select(
          'id, name, slug'
        )
        .single()

      if (error) {
        throw error
      }

      if (selectedCoverImage) {
        try {
          await uploadCoverPhoto(
            data.id,
            selectedCoverImage
          )
        } catch (imageError) {
          console.error(
            'Create product cover image error:',
            imageError
          )

          setCreatedProduct({
            ...data,
            imageUploadFailed: true,
          })
          setSaving(false)
          return
        }
      }

      setCreatedProduct(data)
    } catch (error) {
      console.error(
        'Create product error:',
        error
      )

      setErrorMessage(
        'Could not create the product. Please try again.'
      )
    }

    setSaving(false)
  }

  if (checkingSession) {
    return (
      <main className="admin-add-page">
        <div className="admin-add-state">
          Checking session...
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="admin-add-page">
        <div className="admin-add-state">
          <h1>
            Admin sign-in required
          </h1>

          <Link to="/admin">
            Go to admin login
          </Link>
        </div>
      </main>
    )
  }

  if (createdProduct) {
    return (
      <main className="admin-add-page">
        <div className="admin-add-success">
          <p className="admin-eyebrow">
            Product created
          </p>

          <h1>
            {createdProduct.name}
          </h1>

          <p>
            {createdProduct.imageUploadFailed
              ? 'The product was added, but its cover photo could not upload. Add it from Edit product.'
              : 'The product was added successfully and is currently unpublished.'}
          </p>

          <div className="admin-add-success-url">
            /products/{createdProduct.slug}
          </div>

          <div className="admin-add-success-actions">
            <Link
              to={`/admin/products/${createdProduct.id}/edit`}
              className="admin-action-button admin-action-button-primary"
            >
              Edit product
            </Link>

            <button
              type="button"
              onClick={resetForm}
              className="admin-action-button admin-action-button-secondary"
            >
              Add another
            </button>

            <Link
              to="/admin"
              className="admin-action-button admin-action-button-tertiary"
            >
              Back to products
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const inventoryValid =
    inventoryStateIsValid(
      formData.status,
      formData.stock
    )

  return (
    <main className="admin-add-page">
      <div className="admin-add-header">
        <div>
          <Link
            to="/admin"
            className="admin-edit-back"
          >
            ← Back to products
          </Link>

          <p className="admin-eyebrow">
            Lovelyn It! Admin
          </p>

          <h1>
            Add product
          </h1>

          <p>
            Add the basics now, then add photos and
            publish it when it is ready.
          </p>
        </div>

        <div className="admin-add-draft-badge">
          <span aria-hidden="true">✦</span>
          Starts as a draft
        </div>
      </div>

      {errorMessage && (
        <div className="admin-edit-error" role="alert">
          {errorMessage}
        </div>
      )}

      <form
        className="admin-add-form"
        onSubmit={handleSubmit}
      >
        <section className="admin-add-section">
          <div className="admin-add-section-heading">
            <span className="admin-add-section-number">
              1
            </span>

            <div>
              <h2>
                Product details
              </h2>

              <p>
                A clear name makes the item easier to find.
              </p>
            </div>
          </div>

          <div className="admin-add-form-grid">
            <label className="admin-add-field admin-add-field-wide">
              Product name

            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFieldChange}
              placeholder="Product name"
              required
            />
            </label>

            <label className="admin-add-field">
              Brand

            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleFieldChange}
              placeholder="Optional"
            />
            </label>

            <label className="admin-add-field">
              Category

            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleFieldChange}
              required
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            </label>
          </div>
        </section>

        <section className="admin-add-section">
          <div className="admin-add-section-heading">
            <span className="admin-add-section-number">
              2
            </span>

            <div>
              <h2>
                Selling details
              </h2>

              <p>
                Set the item condition, price, and availability.
              </p>
            </div>
          </div>

          <div className="admin-add-form-grid">
            <label className="admin-add-field">
              Condition

            <input
              type="text"
              name="condition"
              value={formData.condition}
              onChange={handleFieldChange}
            />
            </label>

            <label className="admin-add-field">
              Stock

            <input
              type="number"
              name="stock"
              min="0"
              step="1"
              value={formData.stock}
              onChange={handleFieldChange}
            />
            </label>

            <label className="admin-add-field">
              Price

            <div className="admin-add-price-input">
              <span>
                ₱
              </span>

              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleFieldChange}
                placeholder="Leave blank for now"
              />
            </div>
            </label>

            <label className="admin-add-field">
              Status

            <select
              name="status"
              value={formData.status}
              onChange={handleFieldChange}
            >
              <option value="available">
                Available
              </option>

              <option value="reserved">
                Reserved
              </option>

            </select>
            </label>
          </div>
        </section>

        <section className="admin-add-section">
          <div className="admin-add-section-heading">
            <span className="admin-add-section-number">
              3
            </span>

            <div>
              <h2>
                Cover photo
              </h2>

              <p>
                Add the main image buyers will see first. You can add more photos later.
              </p>
            </div>
          </div>

          <div className="admin-add-cover-picker">
            <div className="admin-add-cover-preview">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt="Selected cover preview"
                />
              ) : (
                <span>No cover photo selected</span>
              )}
            </div>

            <div className="admin-add-cover-content">
              <label className="admin-add-cover-button">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverSelection}
                />
                {selectedCoverImage
                  ? 'Choose a different photo'
                  : 'Choose cover photo'}
              </label>

              <p>
                {selectedCoverImage
                  ? selectedCoverImage.name
                  : 'JPEG, PNG, or WebP up to 10 MB.'}
              </p>
            </div>
          </div>
        </section>

        <section className="admin-add-section">
          <div className="admin-add-section-heading">
            <span className="admin-add-section-number">
              4
            </span>

            <div>
              <h2>
                Description
              </h2>

              <p>
                Keep it short and helpful. You can always refine it later.
              </p>
            </div>
          </div>

          <label className="admin-add-field">
            Description

            <textarea
              name="description"
              rows="6"
              value={formData.description}
              onChange={handleFieldChange}
              placeholder="Description can be added later."
            />
          </label>
        </section>

        {!inventoryValid && (
          <div className="admin-edit-error">
            Enter a whole-number stock amount and a valid status.
          </div>
        )}

        <div className="admin-add-note">
          <span className="admin-add-note-icon" aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>
              You are creating a private draft
            </strong>

            <span>
              Add photos, sizes if needed, and review the product before making it public.
            </span>
          </div>
        </div>

        <div className="admin-add-actions">
          <button
            type="submit"
            className="admin-add-submit"
            disabled={saving}
          >
            {saving
              ? 'Creating...'
              : 'Create product'}
          </button>

          <Link
            to="/admin"
            className="admin-add-cancel"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}

export default AdminAddProductPage
