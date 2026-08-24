import { useCallback, useEffect, useState } from 'react'
import {
  Link,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import './App.css'
import './components/StoreInfoSections.css'

import ProductCard, {
  ProductCardSkeleton,
} from './components/ProductCard'
import StoreInfoSections from './components/StoreInfoSections'
import ProductPage from './pages/ProductPage'
import AdminPage from './pages/AdminPage'
import AdminEditProductPage from './pages/AdminEditProductPage'
import AdminAddProductPage from './pages/AdminAddProductPage'
import NotFoundPage from './pages/NotFoundPage'
import { supabase } from './lib/supabase'

const CATALOG_SCROLL_POSITION_KEY =
  'lovelyn-it:catalog-scroll-position'
const CATALOG_SCROLL_RESTORE_KEY =
  'lovelyn-it:restore-catalog-scroll'

function App() {
  const location = useLocation()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = [
    'All',
    'Bags & Wallets',
    'Clothing',
    'Accessories',
    'Intimates',
    'Kitchen & Home',
  ]

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setCatalogError(false)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('published', true)
      .order('id', { ascending: true })

    if (error) {
      console.error('Products error:', error)
      setCatalogError(true)
      setLoading(false)
      return
    }

    setProducts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const requestTimer = window.setTimeout(() => {
      loadProducts()
    }, 0)

    return () => {
      window.clearTimeout(requestTimer)
    }
  }, [loadProducts])

  useEffect(() => {
    function updateBackToTopVisibility() {
      setShowBackToTop(window.scrollY > 600)
    }

    updateBackToTopVisibility()
    window.addEventListener('scroll', updateBackToTopVisibility, {
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', updateBackToTopVisibility)
    }
  }, [])

  function scrollBackToTop() {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  function handleBrandClick(event) {
    event.preventDefault()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`
    )
    scrollBackToTop()
  }

  function rememberCatalogPosition() {
    window.sessionStorage.setItem(
      CATALOG_SCROLL_POSITION_KEY,
      String(window.scrollY)
    )
  }

  useEffect(() => {
    if (location.pathname !== '/' || loading) {
      return undefined
    }

    const shouldRestore =
      window.sessionStorage.getItem(
        CATALOG_SCROLL_RESTORE_KEY
      ) === 'true'

    if (!shouldRestore) {
      return undefined
    }

    const savedPosition = Number(
      window.sessionStorage.getItem(
        CATALOG_SCROLL_POSITION_KEY
      )
    )

    if (!Number.isFinite(savedPosition)) {
      window.sessionStorage.removeItem(
        CATALOG_SCROLL_RESTORE_KEY
      )
      return undefined
    }

    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: savedPosition,
        behavior: 'auto',
      })
      window.sessionStorage.removeItem(
        CATALOG_SCROLL_RESTORE_KEY
      )
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [loading, location.key, location.pathname])

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
        <a
          className="brand brand-link"
          href="/"
          aria-label="Lovelyn It! — back to top"
          onClick={handleBrandClick}
        >
          Lovelyn It!
        </a>

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
              and more—new, unused items from Lovelyn’s
              collection, available while stocks last.
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
            ) : catalogError ? (
              <div className="hero-empty">
                The collection needs a moment to load.
              </div>
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product, index) => (
                <Link
                  to={`/products/${product.slug}`}
                  className="hero-product"
                  key={product.id}
                  aria-label={`View ${product.name}`}
                  onClick={rememberCatalogPosition}
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
          className="store-highlights"
          aria-label="Why shop Lovelyn It"
        >
          <article className="store-highlight">
            <span className="store-highlight-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>

            <div>
              <strong>Actual item photos</strong>
              <span>See the real products currently available.</span>
            </div>
          </article>

          <article className="store-highlight">
            <span className="store-highlight-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z" />
                <path d="m5 7.5 7 3.5 7-3.5M12 11v9" />
              </svg>
            </span>

            <div>
              <strong>Limited available stock</strong>
              <span>Quantities are shown clearly on every listing.</span>
            </div>
          </article>

          <article className="store-highlight">
            <span className="store-highlight-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11Z" />
                <circle cx="12" cy="10" r="2" />
              </svg>
            </span>

            <div>
              <strong>Cavite-based</strong>
              <span>Meetup nearby or arrange Lalamove privately.</span>
            </div>
          </article>
        </section>

        <section
          className="shelf"
          id="shop"
          tabIndex="-1"
        >
          <div className="shelf-header">
            <div>
              <p className="shelf-kicker">
                Browse the collection
              </p>

              <h2>
                On the shelf
              </h2>

              <p className="shelf-intro">
                Every card shows the current price and available quantity.
              </p>
            </div>

            <span className="shelf-count">
              {loading
                ? 'Loading...'
                : catalogError
                  ? 'Unavailable'
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
                disabled={loading}
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
                  disabled={loading}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div
              className="product-grid product-grid-loading"
              role="status"
              aria-label="Loading products"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : catalogError ? (
            <div className="catalog-error" role="alert">
              <div>
                <h3>
                  We couldn’t load the collection just now.
                </h3>

                <p>
                  Please check your connection and try again.
                </p>
              </div>

              <button
                type="button"
                onClick={loadProducts}
                className="catalog-retry-button"
              >
                Try again
              </button>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpenProduct={rememberCatalogPosition}
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

      {showBackToTop && (
        <button
          type="button"
          className="back-to-top"
          aria-label="Back to top"
          onClick={scrollBackToTop}
        >
          <span className="back-to-top-arrow" aria-hidden="true">
            ↑
          </span>
          <span>Back to top</span>
        </button>
      )}
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

      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  )
}

export default App
