import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AdminAddProductPage() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'Bags & Wallets',
    condition: 'New, unused',
    stock: 1,
    price: '',
    status: 'available',
    description: '',
  })

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdProduct, setCreatedProduct] = useState(null)

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

  function inventoryStateIsValid(
    status,
    stock
  ) {
    const numericStock = Number(stock)

    if (status === 'available') {
      return numericStock > 0
    }

    if (
      status === 'reserved' ||
      status === 'sold'
    ) {
      return numericStock === 0
    }

    return false
  }

  function handleFieldChange(event) {
    const {
      name,
      value,
    } = event.target

    // Choosing Reserved or Sold means
    // there are no units available.
    if (name === 'status') {
      setFormData((current) => {
        if (
          value === 'reserved' ||
          value === 'sold'
        ) {
          return {
            ...current,
            status: value,
            stock: 0,
          }
        }

        // Do not automatically invent stock
        // when choosing Available.
        return {
          ...current,
          status: value,
        }
      })

      return
    }

    // Adding real stock to a Reserved/Sold
    // draft makes it Available.
    if (name === 'stock') {
      setFormData((current) => {
        const nextForm = {
          ...current,
          stock: value,
        }

        const numericStock = Number(value)

        if (
          value !== '' &&
          Number.isInteger(numericStock) &&
          numericStock > 0 &&
          (
            current.status === 'reserved' ||
            current.status === 'sold'
          )
        ) {
          nextForm.status = 'available'
        }

        return nextForm
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
      category: 'Bags & Wallets',
      condition: 'New, unused',
      stock: 1,
      price: '',
      status: 'available',
      description: '',
    })

    setCreatedProduct(null)
    setErrorMessage('')
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
      formData.status === 'available' &&
      stock === 0
    ) {
      setErrorMessage(
        'An Available product must have at least 1 unit in stock. Add stock or choose Reserved/Sold.'
      )
      return
    }

    if (
      (
        formData.status === 'reserved' ||
        formData.status === 'sold'
      ) &&
      stock !== 0
    ) {
      setErrorMessage(
        'Reserved and Sold products must have 0 available stock.'
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

          category:
            formData.category,

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
            The product was added successfully
            and is currently unpublished.
          </p>

          <div className="admin-add-success-url">
            /products/{createdProduct.slug}
          </div>

          <div className="admin-add-success-actions">
            <Link
              to={`/admin/products/${createdProduct.id}/edit`}
              className="admin-add-product-button"
            >
              Edit product
            </Link>

            <button
              type="button"
              onClick={resetForm}
              className="admin-edit-button"
            >
              Add another
            </button>

            <Link
              to="/admin"
              className="admin-edit-button"
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
            Create a new inventory item.
            New products start unpublished.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="admin-edit-error">
          {errorMessage}
        </div>
      )}

      <form
        className="admin-add-form"
        onSubmit={handleSubmit}
      >
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
              name="category"
              value={formData.category}
              onChange={handleFieldChange}
            >
              <option value="Bags & Wallets">
                Bags & Wallets
              </option>

              <option value="Clothing">
                Clothing
              </option>

              <option value="Kitchen & Home">
                Kitchen & Home
              </option>
            </select>
          </label>

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

              <option value="sold">
                Sold
              </option>
            </select>
          </label>

          <label className="admin-add-field admin-add-field-wide">
            Description

            <textarea
              name="description"
              rows="6"
              value={formData.description}
              onChange={handleFieldChange}
              placeholder="Description can be added later."
            />
          </label>
        </div>

        {!inventoryValid && (
          <div className="admin-edit-error">
            {formData.status ===
            'available'
              ? 'Available products need at least 1 unit in stock.'
              : 'Reserved and Sold products must have 0 available stock.'}
          </div>
        )}

        <div className="admin-add-note">
          <strong>
            Starts unpublished
          </strong>

          <span>
            You can add photos and review the
            product before making it public.
          </span>
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
