import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  sortCategories,
  withCategoryNames,
} from '../lib/categories'
import {
  getEffectiveInventoryStatus,
  inventoryCanBePublished,
} from '../lib/inventory'
import { getProductImageUrl } from '../lib/productImages'
import CategoryManager from '../components/CategoryManager'
import RecordSaleDialog from '../components/RecordSaleDialog'

function AdminPage() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [categories, setCategories] = useState([])
  const [saleProduct, setSaleProduct] = useState(null)

  const [updatingProductId, setUpdatingProductId] = useState(null)
  const [stockDrafts, setStockDrafts] = useState({})
  const [priceDrafts, setPriceDrafts] = useState({})
  const [adminMessage, setAdminMessage] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      setSession(data.session)
      setCheckingSession(false)
    }

    checkSession()

    const { data } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        setCheckingSession(false)

        if (!newSession) {
          setProducts([])
          setCategories([])
          setStockDrafts({})
          setPriceDrafts({})
        }
      }
    )

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError(false)

    const { data, error } = await supabase
      .from('products')
      .select('*, categories(id, name, sort_order, is_active)')
      .order('id', { ascending: true })

    if (error) {
      console.error('Admin products error:', error)
      setProductsError(true)
      setProductsLoading(false)
      return
    }

    const loadedProducts = withCategoryNames(data)
    const initialStockDrafts = {}
    const initialPriceDrafts = {}

    loadedProducts.forEach((product) => {
      initialStockDrafts[product.id] = product.stock
      initialPriceDrafts[product.id] = product.price ?? ''
    })

    setProducts(loadedProducts)
    setStockDrafts(initialStockDrafts)
    setPriceDrafts(initialPriceDrafts)
    setProductsLoading(false)
  }, [])

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, sort_order, is_active')

    if (error) {
      console.error('Admin categories error:', error)
      return
    }

    setCategories(sortCategories(data))
  }, [])

  useEffect(() => {
    if (!session) {
      return undefined
    }

    const requestTimer = window.setTimeout(() => {
      loadProducts()
      loadCategories()
    }, 0)

    return () => {
      window.clearTimeout(requestTimer)
    }
  }, [loadCategories, loadProducts, session])

  async function handleLogin(event) {
    event.preventDefault()

    setLoginLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMessage(error.message)
    }

    setLoginLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut({
      scope: 'local',
    })
  }

  async function handlePublishedToggle(product) {
    const newPublishedValue = !product.published

    setAdminMessage('')

    if (newPublishedValue && !inventoryCanBePublished(product)) {
      setAdminMessage(
        `Cannot publish ${product.name}: add stock or variant stock first.`
      )
      return
    }

    setUpdatingProductId(product.id)

    const { error } = await supabase
      .from('products')
      .update({
        published: newPublishedValue,
      })
      .eq('id', product.id)

    if (error) {
      console.error('Publish update error:', error)

      setAdminMessage(
        'Something went wrong. Please try again.'
      )

      setUpdatingProductId(null)
      return
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? {
              ...currentProduct,
              published: newPublishedValue,
            }
          : currentProduct
      )
    )

    setAdminMessage(
      newPublishedValue
        ? `${product.name} is now published.`
        : `${product.name} is now unpublished.`
    )

    setUpdatingProductId(null)
  }

  async function handleStatusChange(product, newStatus) {
    setAdminMessage('')

    setUpdatingProductId(product.id)

    const { error } = await supabase
      .from('products')
      .update({
        status: newStatus,
      })
      .eq('id', product.id)

    if (error) {
      console.error('Status update error:', error)

      setAdminMessage(
        'Something went wrong. Please try again.'
      )

      setUpdatingProductId(null)
      return
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? {
              ...currentProduct,
              status: newStatus,
            }
          : currentProduct
      )
    )

    if (newStatus === 'reserved') {
      setAdminMessage(
        `${product.name} is now Reserved. Its stock is unchanged.`
      )
    } else {
      setAdminMessage(
        `${product.name} is now Available.`
      )
    }

    setUpdatingProductId(null)
  }

  function handleStockDraftChange(productId, value) {
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [productId]: value,
    }))
  }

  function handleStockDecrease(product) {
    const currentValue = Number(
      stockDrafts[product.id] ?? product.stock ?? 0
    )

    if (currentValue <= 0) {
      return
    }

    handleStockDraftChange(
      product.id,
      currentValue - 1
    )
  }

  function handleStockIncrease(product) {
    const currentValue = Number(
      stockDrafts[product.id] ?? product.stock ?? 0
    )

    handleStockDraftChange(
      product.id,
      currentValue + 1
    )
  }

  async function handleStockSave(product) {
    const rawStock = stockDrafts[product.id]

    setAdminMessage('')

    if (
      rawStock === '' ||
      rawStock === null ||
      rawStock === undefined
    ) {
      setAdminMessage(
        'Please enter a stock amount before saving.'
      )
      return
    }

    const parsedStock = Number(rawStock)

    if (
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      setAdminMessage(
        'Stock must be a whole number of 0 or higher.'
      )
      return
    }

    let newStatus = product.status

    if (
      parsedStock > 0 &&
      product.status === 'sold'
    ) {
      newStatus = 'available'
    }

    setUpdatingProductId(product.id)

    const { error } = await supabase
      .from('products')
      .update({
        stock: parsedStock,
        status: newStatus,
      })
      .eq('id', product.id)

    if (error) {
      console.error('Stock update error:', error)

      setAdminMessage(
        'Something went wrong. Please try again.'
      )

      setUpdatingProductId(null)
      return
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? {
              ...currentProduct,
              stock: parsedStock,
              status: newStatus,
            }
          : currentProduct
      )
    )

    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [product.id]: parsedStock,
    }))

    if (newStatus !== product.status) {
      setAdminMessage(
        `${product.name} now has ${parsedStock} available ${
          parsedStock === 1 ? 'unit' : 'units'
        }, so its status was changed back to Available.`
      )
    } else {
      setAdminMessage(
        `${product.name} stock updated to ${parsedStock}.`
      )
    }

    setUpdatingProductId(null)
  }

  function handlePriceDraftChange(productId, value) {
    setPriceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [productId]: value,
    }))
  }

  async function handlePriceSave(product) {
    const rawPrice = priceDrafts[product.id]

    let newPrice = null

    if (
      rawPrice !== '' &&
      rawPrice !== null &&
      rawPrice !== undefined
    ) {
      const parsedPrice = Number(rawPrice)

      if (
        !Number.isFinite(parsedPrice) ||
        parsedPrice < 0
      ) {
        setAdminMessage(
          'Price must be 0 or higher, or leave it blank for "Price coming soon".'
        )
        return
      }

      newPrice = parsedPrice
    }

    setUpdatingProductId(product.id)
    setAdminMessage('')

    const { error } = await supabase
      .from('products')
      .update({
        price: newPrice,
      })
      .eq('id', product.id)

    if (error) {
      console.error('Price update error:', error)

      setAdminMessage(
        'Something went wrong. Please try again.'
      )

      setUpdatingProductId(null)
      return
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.id === product.id
          ? {
              ...currentProduct,
              price: newPrice,
            }
          : currentProduct
      )
    )

    setPriceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [product.id]: newPrice ?? '',
    }))

    if (newPrice === null) {
      setAdminMessage(
        `${product.name} price was cleared.`
      )
    } else {
      setAdminMessage(
        `${product.name} price updated to ₱${newPrice}.`
      )
    }

    setUpdatingProductId(null)
  }

  function hasStockChanged(product) {
    const draft = stockDrafts[product.id]

    if (
      draft === '' ||
      draft === null ||
      draft === undefined
    ) {
      return true
    }

    return Number(draft) !== Number(product.stock)
  }

  function hasPriceChanged(product) {
    const draft = priceDrafts[product.id]

    if (
      draft === '' ||
      draft === null ||
      draft === undefined
    ) {
      return product.price !== null
    }

    return Number(draft) !== Number(product.price)
  }

  function handleClearFilters() {
    setSearchQuery('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setVisibilityFilter('all')
  }

  const filteredProducts = products.filter((product) => {
    const query = searchQuery
      .trim()
      .toLowerCase()

    const matchesSearch =
      !query ||
      product.name
        ?.toLowerCase()
        .includes(query) ||
      product.brand
        ?.toLowerCase()
        .includes(query) ||
      product.category
        ?.toLowerCase()
        .includes(query)

    const matchesCategory =
      categoryFilter === 'all' ||
      product.category_id === categoryFilter

    const matchesStatus =
      statusFilter === 'all' ||
      getEffectiveInventoryStatus(product) === statusFilter

    const matchesVisibility =
      visibilityFilter === 'all' ||
      (
        visibilityFilter === 'published' &&
        product.published
      ) ||
      (
        visibilityFilter === 'unpublished' &&
        !product.published
      )

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus &&
      matchesVisibility
    )
  })

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    visibilityFilter !== 'all'

  if (checkingSession) {
    return (
      <main className="admin-login-page">
        <p>
          Checking session...
        </p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="admin-login-page">
        <div className="admin-login-card">
          <p className="admin-eyebrow">
            Lovelyn It!
          </p>

          <h1>
            Store Admin
          </h1>

          <p className="admin-login-text">
            Sign in to manage products,
            inventory, and listings.
          </p>

          <form
            onSubmit={handleLogin}
            className="admin-login-form"
          >
            <label>
              Email

              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />
            </label>

            {errorMessage && (
              <p className="admin-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading
                ? 'Signing in...'
                : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  const publishedCount = products.filter(
    (product) => product.published
  ).length

  const availableCount = products.filter(
    (product) =>
      getEffectiveInventoryStatus(product) === 'available'
  ).length

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">
            Lovelyn It!
          </p>

          <h1>
            Store Admin
          </h1>

          <p className="admin-account">
            {session.user.email}
          </p>
        </div>

        <div className="admin-header-actions">
          <Link to="/admin/sales" className="admin-edit-button">
            Sales
          </Link>

          <Link
            to="/admin/products/new"
            className="admin-add-product-button"
          >
            + Add product
          </Link>

          <button
            type="button"
            className="admin-signout"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="admin-stats">
        <div className="admin-stat">
          <span>
            Total products
          </span>

          <strong>
            {productsLoading
              ? '—'
              : products.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>
            Published
          </span>

          <strong>
            {productsLoading
              ? '—'
              : publishedCount}
          </strong>
        </div>

        <div className="admin-stat">
          <span>
            Available
          </span>

          <strong>
            {productsLoading
              ? '—'
              : availableCount}
          </strong>
        </div>
      </section>

      {adminMessage && (
        <p className="admin-message" role="status">
          {adminMessage}
        </p>
      )}

      <section className="admin-filter-panel">
        <div className="admin-filter-heading">
          <div>
            <h2>
              Find a product
            </h2>

            <p>
              Search your inventory or narrow it
              down using the filters.
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="admin-clear-filters"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="admin-filter-grid">
          <label className="admin-filter-field admin-filter-search">
            Search

            <input
              type="search"
              placeholder="Search by product, brand, or category..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />
          </label>

          <label className="admin-filter-field">
            Category

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
            >
              <option value="all">
                All categories
              </option>

              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-filter-field">
            Status

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="available">
                Available
              </option>

              <option value="reserved">
                Reserved
              </option>

              <option value="sold_out">
                Sold out
              </option>
            </select>
          </label>

          <label className="admin-filter-field">
            Visibility

            <select
              value={visibilityFilter}
              onChange={(event) =>
                setVisibilityFilter(event.target.value)
              }
            >
              <option value="all">
                All products
              </option>

              <option value="published">
                Published
              </option>

              <option value="unpublished">
                Unpublished
              </option>
            </select>
          </label>
        </div>
      </section>

      <CategoryManager
        categories={categories}
        onCategoriesChanged={(nextCategories) =>
          setCategories(sortCategories(nextCategories))
        }
      />

      <section className="admin-products">
        <div className="admin-section-header">
          <h2>
            Products
          </h2>

          <span>
            {productsLoading
              ? 'Loading...'
              : hasActiveFilters
                ? `${filteredProducts.length} of ${products.length} products`
                : `${products.length} products`}
          </span>
        </div>

        {productsError && (
          <div className="admin-empty-results" role="alert">
            <strong>
              We couldn’t load the inventory just now.
            </strong>

            <span>
              Please check your connection and try again.
            </span>

            <button
              type="button"
              onClick={loadProducts}
            >
              Try again
            </button>
          </div>
        )}

        {!productsLoading &&
          !productsError &&
          filteredProducts.length === 0 && (
            <div className="admin-empty-results">
              <strong>
                No products found.
              </strong>

              <span>
                Try changing your search or filters.
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

        {!productsLoading &&
          !productsError &&
          filteredProducts.length > 0 && (
            <div className="admin-product-list">
              {filteredProducts.map((product) => {
                const imageUrl = getProductImageUrl(
                  product.image_path
                )

                const effectiveStatus = getEffectiveInventoryStatus(product)

                return (
                  <div
                    className="admin-product-row"
                    key={product.id}
                  >
                    <div className="admin-product-summary">
                      <Link
                        to={`/admin/products/${product.id}/edit`}
                        className="admin-product-thumbnail-link"
                      >
                        <div className="admin-product-thumbnail">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.name}
                            />
                          ) : (
                            <span>
                              NO PHOTO
                            </span>
                          )}
                        </div>
                      </Link>

                      <div className="admin-product-main">
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          {product.category}
                          {' · '}
                          {product.stock} in stock
                          {' · '}
                          {product.price !== null
                            ? `₱${product.price}`
                            : 'No price yet'}
                        </span>

                        {product.has_variants && (
                          <span className="admin-inventory-warning">
                            Stock is managed by variants
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="admin-product-controls">
                      <div className="admin-price-control">
                        <span className="admin-price-symbol">
                          ₱
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={
                            priceDrafts[product.id] ?? ''
                          }
                          disabled={
                            updatingProductId === product.id
                          }
                          onChange={(event) =>
                            handlePriceDraftChange(
                              product.id,
                              event.target.value
                            )
                          }
                        />

                        <button
                          type="button"
                          className="admin-price-save"
                          disabled={
                            updatingProductId === product.id ||
                            !hasPriceChanged(product)
                          }
                          onClick={() =>
                            handlePriceSave(product)
                          }
                        >
                          Save price
                        </button>
                      </div>

                      <div className="admin-stock-control">
                        <button
                          type="button"
                          className="admin-stock-step"
                          disabled={
                            product.has_variants ||
                            updatingProductId === product.id ||
                            Number(
                              stockDrafts[product.id] ?? 0
                            ) <= 0
                          }
                          onClick={() =>
                            handleStockDecrease(product)
                          }
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            stockDrafts[product.id] ?? ''
                          }
                          disabled={
                            product.has_variants ||
                            updatingProductId === product.id
                          }
                          onChange={(event) =>
                            handleStockDraftChange(
                              product.id,
                              event.target.value
                            )
                          }
                        />

                        <button
                          type="button"
                          className="admin-stock-step"
                          disabled={
                            product.has_variants ||
                            updatingProductId === product.id
                          }
                          onClick={() =>
                            handleStockIncrease(product)
                          }
                        >
                          +
                        </button>

                        <button
                          type="button"
                          className="admin-stock-save"
                          disabled={
                            product.has_variants ||
                            updatingProductId === product.id ||
                            !hasStockChanged(product)
                          }
                          onClick={() =>
                            handleStockSave(product)
                          }
                        >
                          Save stock
                        </button>
                      </div>

                      <select
                        className={`admin-status-select ${effectiveStatus}`}
                        value={
                          effectiveStatus === 'sold_out'
                            ? 'sold_out'
                            : product.status
                        }
                        disabled={
                          updatingProductId === product.id
                        }
                        onChange={(event) =>
                          handleStatusChange(
                            product,
                            event.target.value
                          )
                        }
                      >
                        <option value="available">
                          Available
                        </option>

                        <option value="reserved">
                          Reserved
                        </option>

                        <option value="sold_out" disabled>
                          Sold out (0 stock)
                        </option>
                      </select>

                      <span
                        className={
                          product.published
                            ? 'admin-published'
                            : 'admin-unpublished'
                        }
                      >
                        {product.published
                          ? 'Published'
                          : 'Unpublished'}
                      </span>

                      <Link
                        to={`/admin/products/${product.id}/edit`}
                        className="admin-edit-button"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        className="admin-price-save"
                        disabled={
                          updatingProductId === product.id ||
                          effectiveStatus === 'sold_out'
                        }
                        onClick={() => setSaleProduct(product)}
                      >
                        Record sale
                      </button>

                      <button
                        type="button"
                        className={
                          product.published
                            ? 'admin-publish-button unpublish'
                            : 'admin-publish-button'
                        }
                        disabled={
                          updatingProductId === product.id
                        }
                        onClick={() =>
                          handlePublishedToggle(product)
                        }
                      >
                        {updatingProductId === product.id
                          ? 'Saving...'
                          : product.published
                            ? 'Unpublish'
                            : 'Publish'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </section>

      {saleProduct && (
        <RecordSaleDialog
          product={saleProduct}
          onClose={() => setSaleProduct(null)}
          onRecorded={() => {
            setSaleProduct(null)
            setAdminMessage('Sale recorded and stock updated.')
            loadProducts()
          }}
        />
      )}
    </main>
  )
}

export default AdminPage
