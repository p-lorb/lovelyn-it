import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './ProductPage.css'

function ProductPage() {
  const { slug } = useParams()

  const [product, setProduct] = useState(null)
  const [galleryImages, setGalleryImages] = useState([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const [loading, setLoading] = useState(true)

  const messengerUsername =
    import.meta.env.VITE_MESSENGER_USERNAME

  const messengerUrl = messengerUsername
    ? `https://m.me/${messengerUsername}`
    : null

  useEffect(() => {
    async function loadProduct() {
      setLoading(true)
      setGalleryImages([])
      setSelectedImageIndex(0)

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()

      if (productError) {
        console.error(
          'Product error:',
          productError
        )

        setProduct(null)
        setLoading(false)
        return
      }

      if (!productData) {
        setProduct(null)
        setLoading(false)
        return
      }

      setProduct(productData)

      const {
        data: galleryData,
        error: galleryError,
      } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productData.id)
        .order('sort_order', {
          ascending: true,
        })
        .order('id', {
          ascending: true,
        })

      if (galleryError) {
        console.error(
          'Gallery error:',
          galleryError
        )
      } else {
        setGalleryImages(
          galleryData ?? []
        )
      }

      setLoading(false)
    }

    loadProduct()
  }, [slug])

  function getPublicImageUrl(imagePath) {
    if (!imagePath) {
      return null
    }

    const { data } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(imagePath)

    return data.publicUrl
  }

  if (loading) {
    return (
      <main className="product-page-state">
        <p>
          Loading product...
        </p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="product-page-state">
        <h1>
          Product not found
        </h1>

        <Link
          to="/"
          className="back-link"
        >
          ← Back to shop
        </Link>
      </main>
    )
  }

  const isAvailable =
    product.status === 'available'

  const isReserved =
    product.status === 'reserved'

  const isSold =
    product.status === 'sold'

  const canMessage =
    isAvailable && Boolean(messengerUrl)

  const productImages = []

  if (product.image_path) {
    productImages.push({
      id: 'cover',
      image_path: product.image_path,
      label: 'Cover photo',
    })
  }

  galleryImages.forEach(
    (galleryImage, index) => {
      productImages.push({
        ...galleryImage,
        label: `Photo ${index + 2}`,
      })
    }
  )

  const selectedImage =
    productImages[
      Math.min(
        selectedImageIndex,
        Math.max(
          productImages.length - 1,
          0
        )
      )
    ]

  const selectedImageUrl =
    selectedImage
      ? getPublicImageUrl(
          selectedImage.image_path
        )
      : null

  function handlePreviousImage() {
    setSelectedImageIndex(
      (currentIndex) => {
        if (
          productImages.length <= 1
        ) {
          return 0
        }

        return currentIndex === 0
          ? productImages.length - 1
          : currentIndex - 1
      }
    )
  }

  function handleNextImage() {
    setSelectedImageIndex(
      (currentIndex) => {
        if (
          productImages.length <= 1
        ) {
          return 0
        }

        return currentIndex ===
          productImages.length - 1
          ? 0
          : currentIndex + 1
      }
    )
  }

  function handleMessageSeller() {
    if (!canMessage) {
      return
    }

    window.open(
      messengerUrl,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <>
      <header className="site-header">
        <Link
          to="/"
          className="brand brand-link"
        >
          Corner Store
        </Link>

        <nav className="nav">
          <Link to="/#shop">
            Shop
          </Link>

          <Link to="/#how-it-works">
            How it works
          </Link>

          <Link to="/#contact">
            Message us
          </Link>
        </nav>
      </header>

      <main className="product-page">
        <Link
          to="/#shop"
          className="back-link"
        >
          ← Back to shop
        </Link>

        <div className="product-detail">
          <div className="product-gallery">
            <div className="product-detail-image product-gallery-main">
              {selectedImageUrl ? (
                <img
                  src={selectedImageUrl}
                  alt={`${product.name} - ${
                    selectedImageIndex + 1
                  }`}
                  className="product-detail-photo"
                />
              ) : (
                <span>
                  PHOTO
                </span>
              )}

              {!isAvailable && (
                <span
                  className={`status-badge detail-status-badge ${
                    isReserved
                      ? 'reserved'
                      : 'sold'
                  }`}
                >
                  {isReserved
                    ? 'Reserved'
                    : 'Sold'}
                </span>
              )}

              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="product-gallery-arrow product-gallery-arrow-left"
                    onClick={
                      handlePreviousImage
                    }
                    aria-label="Previous product photo"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    className="product-gallery-arrow product-gallery-arrow-right"
                    onClick={
                      handleNextImage
                    }
                    aria-label="Next product photo"
                  >
                    ›
                  </button>

                  <span className="product-gallery-counter">
                    {selectedImageIndex + 1}
                    {' / '}
                    {productImages.length}
                  </span>
                </>
              )}
            </div>

            {productImages.length > 1 && (
              <div
                className="product-gallery-thumbnails"
                aria-label="Product photos"
              >
                {productImages.map(
                  (image, index) => {
                    const imageUrl =
                      getPublicImageUrl(
                        image.image_path
                      )

                    return (
                      <button
                        type="button"
                        key={image.id}
                        className={`product-gallery-thumbnail ${
                          selectedImageIndex ===
                          index
                            ? 'active'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedImageIndex(
                            index
                          )
                        }
                        aria-label={`View ${image.label}`}
                        aria-pressed={
                          selectedImageIndex ===
                          index
                        }
                      >
                        <img
                          src={imageUrl}
                          alt=""
                        />

                        {index === 0 &&
                          product.image_path && (
                            <span className="product-gallery-cover-label">
                              Cover
                            </span>
                          )}
                      </button>
                    )
                  }
                )}
              </div>
            )}
          </div>

          <div className="product-detail-info">
            {product.brand && (
              <p className="product-detail-brand">
                {product.brand}
              </p>
            )}

            <h1>
              {product.name}
            </h1>

            <p className="product-detail-category">
              {product.category}
            </p>

            <div className="product-detail-badges">
              <span>
                {product.condition}
              </span>

              {isAvailable && (
                <span>
                  {product.stock} available
                </span>
              )}

              {isReserved && (
                <span className="reserved-text">
                  Currently reserved
                </span>
              )}

              {isSold && (
                <span className="sold-text">
                  Sold
                </span>
              )}
            </div>

            <div className="product-detail-price">
              {product.price !== null
                ? `₱${product.price}`
                : 'Price coming soon'}
            </div>

            <button
              type="button"
              className="product-message-button"
              disabled={!canMessage}
              onClick={handleMessageSeller}
            >
              {isAvailable &&
                'Message Seller'}

              {isReserved &&
                'Currently Reserved'}

              {isSold &&
                'Sold'}
            </button>

            <section className="product-description">
              <h2>
                Product details
              </h2>

              <p>
                {product.description ||
                  'More information about this product will be added soon.'}
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

export default ProductPage