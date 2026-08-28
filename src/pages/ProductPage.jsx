import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getProductDescription } from '../lib/productDescriptions'
import {
  getProductImageUrl,
  removeDuplicateImagePaths,
} from '../lib/productImages'
import { withCategoryName } from '../lib/categories'
import {
  getAvailableQuantity,
  getEffectiveInventoryStatus,
} from '../lib/inventory'
import './ProductPage.css'

const CATALOG_SCROLL_RESTORE_KEY =
  'lovelyn-it:restore-catalog-scroll'

function ProductPage() {
  const { slug } = useParams()

  const [product, setProduct] = useState(null)
  const [galleryImages, setGalleryImages] = useState([])
  const [variants, setVariants] = useState([])
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [variantsError, setVariantsError] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [copyStatus, setCopyStatus] = useState('idle')
  const [shareStatus, setShareStatus] = useState('idle')

  const [loading, setLoading] = useState(true)
  const [productError, setProductError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const messengerUsername =
    import.meta.env.VITE_MESSENGER_USERNAME

  const messengerUrl = messengerUsername
    ? `https://m.me/${messengerUsername}`
    : null

  useEffect(() => {
    async function loadProduct() {
      setLoading(true)
      setProductError(false)
      setGalleryImages([])
      setVariants([])
      setSelectedVariantId('')
      setVariantsError(false)
      setSelectedImageIndex(0)
      setCopyStatus('idle')
      setShareStatus('idle')

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from('products')
        .select(
          '*, categories(id, name, sort_order, is_active)'
        )
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()

      if (productError) {
        console.error(
          'Product error:',
          productError
        )

        setProduct(null)
        setProductError(true)
        setLoading(false)
        return
      }

      if (!productData) {
        setProduct(null)
        setLoading(false)
        return
      }

      setProduct(withCategoryName(productData))
      setLoading(false)

      if (productData.has_variants) {
        const {
          data: variantData,
          error: variantError,
        } = await supabase.rpc(
          'get_public_product_variants',
          {
            p_product_id: productData.id,
          }
        )

        if (variantError) {
          console.error(
            'Public variants error:',
            variantError
          )
          setVariantsError(true)
        } else {
          setVariants(variantData ?? [])
        }
      }

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
          removeDuplicateImagePaths(
            productData.image_path,
            galleryData ?? []
          )
        )
      }
    }

    loadProduct()
  }, [reloadKey, slug])

  useEffect(() => {
    function requestRestoreOnBrowserBack() {
      window.sessionStorage.setItem(
        CATALOG_SCROLL_RESTORE_KEY,
        'true'
      )
    }

    window.addEventListener(
      'popstate',
      requestRestoreOnBrowserBack
    )

    return () => {
      window.removeEventListener(
        'popstate',
        requestRestoreOnBrowserBack
      )
    }
  }, [])

  function requestCatalogRestore() {
    window.sessionStorage.setItem(
      CATALOG_SCROLL_RESTORE_KEY,
      'true'
    )
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

  if (!product && productError) {
    return (
      <main className="product-page-state product-page-error" role="alert">
        <h1>
          We couldn’t load this product just now.
        </h1>

        <p>
          Please check your connection and try again.
        </p>

        <div className="product-page-state-actions">
          <button
            type="button"
            className="product-page-retry"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Try again
          </button>

          <Link
            to="/"
            className="back-link"
            onClick={requestCatalogRestore}
          >
            ← Back to shop
          </Link>
        </div>
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
          onClick={requestCatalogRestore}
        >
          ← Back to shop
        </Link>
      </main>
    )
  }

  const effectiveStatus = getEffectiveInventoryStatus(product)
  const isAvailable = effectiveStatus === 'available'
  const isReserved = effectiveStatus === 'reserved'
  const isSoldOut = effectiveStatus === 'sold_out'
  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId
  )
  const needsVariantSelection = Boolean(product.has_variants)
  const availableQuantity = getAvailableQuantity(product)

  const canMessage =
    isAvailable &&
    Boolean(messengerUrl) &&
    (!needsVariantSelection || Boolean(selectedVariant?.is_available))

  const priceLabel =
    product.price !== null
      ? `₱${Number(product.price).toLocaleString('en-PH')}`
      : 'the listed price'

  const inquiryText =
    `Hi! I'm interested in ${product.name} (${priceLabel}) ` +
    `from Lovelyn It!. Is it still available?\n\n` +
    (selectedVariant
      ? `Size: ${selectedVariant.label}\n`
      : '') +
    'Quantity: 1\n' +
    'General location: __________'

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
      ? getProductImageUrl(
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

  async function handleCopyInquiry() {
    if (!canMessage) {
      return
    }

    try {
      await navigator.clipboard.writeText(inquiryText)
      setCopyStatus('copied')
    } catch (error) {
      console.error('Copy inquiry error:', error)
      setCopyStatus('failed')
    }
  }

  async function handleShareProduct() {
    const productUrl =
      `${window.location.origin}/products/${product.slug}`

    const shareData = {
      title: `${product.name} | Lovelyn It!`,
      text: `${product.name} — ${priceLabel}. View the actual item photos on Lovelyn It!`,
      url: productUrl,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setShareStatus('shared')
        return
      }

      await navigator.clipboard.writeText(productUrl)
      setShareStatus('copied')
    } catch (error) {
      if (error?.name === 'AbortError') {
        setShareStatus('idle')
        return
      }

      console.error('Share product error:', error)
      setShareStatus('failed')
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to product details
      </a>

      <header className="site-header">
        <Link
          to="/"
          className="brand brand-link"
        >
          Lovelyn It!
        </Link>

        <nav className="nav">
          <Link to="/#shop">
            Shop
          </Link>

          <Link to="/#how-it-works">
            How it works
          </Link>

          <Link to="/#contact">
            Message
          </Link>
        </nav>
      </header>

      <main className="product-page" id="main-content" tabIndex="-1">
        <Link
          to="/"
          className="back-link"
          onClick={requestCatalogRestore}
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
                  decoding="async"
                  fetchPriority="high"
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
                    : 'Sold out'}
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
                role="group"
              >
                {productImages.map(
                  (image, index) => {
                    const imageUrl =
                      getProductImageUrl(
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
                          loading="lazy"
                          decoding="async"
                          width="76"
                          height="76"
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

            <p className="product-photo-note">
              Photos show the actual item you’ll receive. Some
              items were photographed in their protective plastic
              packaging.
            </p>
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
                  {availableQuantity} available
                </span>
              )}

              {isReserved && (
                <span className="reserved-text">
                  Currently reserved
                </span>
              )}

              {isSoldOut && (
                <span className="sold-text">
                  Sold out
                </span>
              )}
            </div>

            <div className="product-detail-price">
              {product.price !== null
                ? `₱${product.price}`
                : 'Price coming soon'}
            </div>

            {product.has_variants && (
              <section
                className="product-variant-picker"
                aria-labelledby="product-variant-title"
              >
                <h2 id="product-variant-title">
                  Sizes
                </h2>

                {variantsError ? (
                  <p className="product-variant-error">
                    Sizes could not load just now. Please try again shortly.
                  </p>
                ) : variants.length > 0 ? (
                  <div
                    className="product-variant-options"
                    role="radiogroup"
                    aria-label="Choose a size"
                  >
                    {variants.map((variant) => (
                      <button
                        type="button"
                        key={variant.id}
                        className={`product-variant-option ${
                          selectedVariantId === variant.id
                            ? 'active'
                            : ''
                        } ${isAvailable && variant.is_available ? '' : 'reserved'}`}
                        role="radio"
                        aria-checked={
                          selectedVariantId === variant.id
                        }
                        disabled={!isAvailable || !variant.is_available}
                        onClick={() =>
                          setSelectedVariantId(variant.id)
                        }
                      >
                        <span>{variant.label}</span>
                        {(!isAvailable || !variant.is_available) && (
                          <small>Reserved</small>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="product-variant-empty">
                    No size is currently in stock.
                  </p>
                )}
              </section>
            )}

            <section className="product-description">
              <h2>
                Product details
              </h2>

              <p>
                {getProductDescription(product)}
              </p>
            </section>

            <section
              className="product-inquiry"
              aria-labelledby="product-inquiry-title"
            >
              <div className="product-inquiry-heading">
                <h2 id="product-inquiry-title">
                  {isAvailable && 'Ready when you are'}
                  {isReserved && 'This item is currently reserved'}
                  {isSoldOut && 'This item is sold out'}
                </h2>

                {isAvailable && (
                  <p>
                    Send a message in your own words through Messenger.
                    Quantity, payment, and delivery details will be
                    confirmed privately.
                  </p>
                )}

                {isReserved && (
                  <p>
                    Someone is currently arranging this purchase.
                    It may become available again if the 24-hour
                    hold is released.
                  </p>
                )}

                {isSoldOut && (
                  <p>
                    This product is no longer available to order.
                  </p>
                )}
              </div>

              <div className="product-share product-inquiry-share">
                <button
                  type="button"
                  className="product-share-button"
                  onClick={handleShareProduct}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="18" cy="5" r="2.5" />
                    <circle cx="6" cy="12" r="2.5" />
                    <circle cx="18" cy="19" r="2.5" />
                    <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
                  </svg>
                  <span>
                    {shareStatus === 'copied'
                      ? 'Product link copied ✓'
                      : shareStatus === 'shared'
                        ? 'Shared ✓'
                        : 'Share this item'}
                  </span>
                </button>

                <p
                  className={`product-share-status ${
                    shareStatus === 'failed' ? 'error' : ''
                  }`}
                  aria-live="polite"
                >
                  {shareStatus === 'copied' &&
                    'The link is ready to paste into Facebook, Messenger, or a group post.'}
                  {shareStatus === 'shared' &&
                    'The product was shared successfully.'}
                  {shareStatus === 'failed' &&
                    'The link couldn’t be shared. You can copy it from the address bar instead.'}
                </p>
              </div>

              {isAvailable && (
                <>
                  {needsVariantSelection && !selectedVariant && (
                    <p className="product-variant-selection-note">
                      Choose an available size before messaging.
                    </p>
                  )}

                  <button
                    type="button"
                    className="product-message-button"
                    disabled={!canMessage}
                    onClick={handleMessageSeller}
                  >
                    Message about this item
                  </button>

                  <details className="product-inquiry-helper">
                    <summary>
                      Need help? Copy a starter message
                    </summary>

                    <p>
                      This is optional—you can edit it or write your
                      own message instead.
                    </p>

                    <div className="product-inquiry-preview">
                      {inquiryText.split('\n').map((line, index) => (
                        <span key={`${line}-${index}`}>
                          {line || <br />}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="product-copy-button"
                      disabled={!canMessage}
                      onClick={handleCopyInquiry}
                    >
                      {copyStatus === 'copied'
                        ? 'Starter message copied ✓'
                        : 'Copy starter message'}
                    </button>

                    {copyStatus === 'failed' && (
                      <p className="product-copy-status error" role="alert">
                        The message couldn’t be copied. You can
                        select it above and copy it manually.
                      </p>
                    )}

                    {copyStatus === 'copied' && (
                      <p className="product-copy-status" aria-live="polite">
                        Copied—paste it in Messenger whenever you’re
                        ready.
                      </p>
                    )}
                  </details>
                </>
              )}

              {isAvailable && (
                <p className="product-reservation-note">
                  Once confirmed in Messenger, requested quantities
                  are held for 24 hours while payment or meetup
                  arrangements are finalized.
                </p>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

export default ProductPage
