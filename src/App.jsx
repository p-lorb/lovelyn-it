import { useEffect, useState } from 'react'
import { Link, Routes, Route } from 'react-router-dom'
import './App.css'
import './components/StoreInfoSections.css'

import ProductCard from './components/ProductCard'
import StoreInfoSections from './components/StoreInfoSections'
import ProductPage from './pages/ProductPage'
import AdminPage from './pages/AdminPage'
import AdminEditProductPage from './pages/AdminEditProductPage'
import AdminAddProductPage from './pages/AdminAddProductPage'
import { supabase } from './lib/supabase'

function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = [
    'All',
    'Bags & Wallets',
    'Clothing',
    'Kitchen & Home',
  ]

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('published', true)
        .order('id', { ascending: true })

      if (error) {
        console.error('Products error:', error)
        setLoading(false)
        return
      }

      setProducts(data)
      setLoading(false)
    }

    loadProducts()
  }, [])

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase().trim()

    const matchesSearch =
      !query ||
      product.name?.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)

    const matchesCategory =
      selectedCategory === 'All' ||
      product.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const featuredProducts = []
  const featuredProductIds = new Set()

  const productsWithPhotos = products.filter(
    (product) =>
      product.image_path &&
      product.status !== 'sold'
  )

  categories.slice(1).forEach((category) => {
    const featuredProduct = productsWithPhotos.find(
      (product) =>
        product.category === category &&
        !featuredProductIds.has(product.id)
    )

    if (featuredProduct) {
      featuredProducts.push(featuredProduct)
      featuredProductIds.add(featuredProduct.id)
    }
  })

  productsWithPhotos.forEach((product) => {
    if (
      featuredProducts.length < 4 &&
      !featuredProductIds.has(product.id)
    ) {
      featuredProducts.push(product)
      featuredProductIds.add(product.id)
    }
  })

  function getProductImageUrl(imagePath) {
    const { data } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(imagePath)

    return data.publicUrl
  }

  const homePage = (
    <>
      <a className="skip-link" href="#shop">
        Skip to products
      </a>

      <header className="site-header">
        <div className="brand">
          Lovelyn It!
        </div>

        <nav className="nav">
          <a href="#shop">
            Shop
          </a>

          <a href="#how-it-works">
            How it works
          </a>

          <a href="#contact">
            Message
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              A collection lovingly kept
            </p>

            <h1>
              Good finds, honest prices, real photos.
            </h1>

            <p className="hero-text">
              Bags, wallets, kitchenware, appliances,
              and more — new, unused items from Lovelyn’s
              collection, ready for new homes.
            </p>

            <a
              href="#shop"
              className="hero-button"
            >
              Browse items →
            </a>
          </div>

          <div
            className="hero-showcase"
            aria-label="A selection of real products from the shop"
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="hero-product hero-product-skeleton"
                  key={index}
                  aria-hidden="true"
                />
              ))
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product, index) => (
                <Link
                  to={`/products/${product.slug}`}
                  className="hero-product"
                  key={product.id}
                  aria-label={`View ${product.name}`}
                >
                  <img
                    src={getProductImageUrl(product.image_path)}
                    alt={product.name}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />

                  <span>
                    {product.category}
                  </span>
                </Link>
              ))
            ) : (
              <div className="hero-empty">
                Real product photos coming soon.
              </div>
            )}

            <p className="hero-authenticity-note">
              Real photos · Actual items
            </p>
          </div>
        </section>

        <section
          className="shelf"
          id="shop"
          tabIndex="-1"
        >
          <div className="shelf-header">
            <h2>
              On the shelf
            </h2>

            <span>
              {loading
                ? 'Loading...'
                : `${filteredProducts.length} items`}
            </span>
          </div>

          <div className="shop-controls">
            <div className="shop-search">
              <label htmlFor="product-search">
                Search products
              </label>

              <input
                id="product-search"
                type="search"
                placeholder="Try “bag” or “kitchen”"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
              />
            </div>

            <div
              className="category-filters"
              role="group"
              aria-label="Filter products by category"
            >
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`category-button ${
                    selectedCategory === category
                      ? 'active'
                      : ''
                  }`}
                  aria-pressed={selectedCategory === category}
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="no-results">
              Loading products...
            </p>
          ) : filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          ) : (
            <p className="no-results">
              No products found.
            </p>
          )}
        </section>

        <StoreInfoSections />
      </main>
    </>
  )

  return (
    <Routes>
      <Route
        path="/"
        element={homePage}
      />

      <Route
        path="/products/:slug"
        element={<ProductPage />}
      />

      <Route
        path="/admin"
        element={<AdminPage />}
      />

      <Route
        path="/admin/products/new"
        element={<AdminAddProductPage />}
      />

      <Route
        path="/admin/products/:id/edit"
        element={<AdminEditProductPage />}
      />
    </Routes>
  )
}

export default App
