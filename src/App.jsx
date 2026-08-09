import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
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

  const homePage = (
    <>
      <header className="site-header">
        <div className="brand">
          Corner Store
        </div>

        <nav className="nav">
          <a href="#shop">
            Shop
          </a>

          <a href="#how-it-works">
            How it works
          </a>

          <a href="#contact">
            Message us
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              A real shop, continued
            </p>

            <h1>
              Good finds, honest prices, real photos.
            </h1>

            <p className="hero-text">
              Bags, wallets, kitchenware, appliances,
              and more — unused items now finding new homes.
            </p>

            <a
              href="#shop"
              className="hero-button"
            >
              Browse items →
            </a>
          </div>

          <div className="hero-photo">
            PHOTO
          </div>
        </section>

        <section
          className="shelf"
          id="shop"
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
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />

            <div className="category-filters">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`category-button ${
                    selectedCategory === category
                      ? 'active'
                      : ''
                  }`}
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