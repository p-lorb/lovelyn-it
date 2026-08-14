import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getProductDescription } from '../lib/productDescriptions'
import './ProductPage.css'

const CATALOG_SCROLL_RESTORE_KEY =
  'lovelyn-it:restore-catalog-scroll'

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

async function getImageBytes(imagePath) {
  const response = await fetch(getPublicImageUrl(imagePath))

  if (!response.ok) {
    throw new Error(`Could not compare image: ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

function imageBytesMatch(firstImage, secondImage) {
  if (firstImage.length !== secondImage.length) {
    return false
  }

  return firstImage.every(
    (value, index) => value === secondImage[index]
  )
}

async function removeExactGalleryDuplicates(
  coverImagePath,
  galleryItems
) {
  if (!coverImagePath || galleryItems.length === 0) {
    return galleryItems
  }

  const coverBytes = await getImageBytes(coverImagePath)
  const uniqueGalleryItems = []
  const uniqueGalleryBytes = []

  for (const galleryItem of galleryItems) {
    const galleryBytes = await getImageBytes(
      galleryItem.image_path
    )

    const matchesCover = imageBytesMatch(
      coverBytes,
      galleryBytes
    )

    const matchesAnotherGalleryImage =
      uniqueGalleryBytes.some((existingBytes) =>
        imageBytesMatch(existingBytes, galleryBytes)
      )

    if (!matchesCover && !matchesAnotherGalleryImage) {
      uniqueGalleryItems.push(galleryItem)
      uniqueGalleryBytes.push(galleryBytes)
    }
  }

  return uniqueGalleryItems
}

function ProductPage() {
  const { slug } = useParams()

  const [product, setProduct] = useState(null)
  const [galleryImages, setGalleryImages] = useState([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [copyStatus, setCopyStatus] = useState('idle')
  const [shareStatus, setShareStatus] = useState('idle')

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
      setCopyStatus('idle')
      setShareStatus('idle')

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
      setLoading(false)

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
        try {
          const uniqueGalleryImages =
            await removeExactGalleryDuplicates(
              productData.image_path,
              galleryData ?? []
            )

          setGalleryImages(uniqueGalleryImages)
        } catch (duplicateCheckError) {
          console.error(
            'Gallery duplicate check error:',
            duplicateCheckError
          )

          setGalleryImages(galleryData ?? [])
        }
      }
    }

    loadProduct()
  }, [slug])

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

  const isAvailable =
    product.status === 'available'

  const isReserved =
    product.status === 'reserved'

  const isSold =
    product.status === 'sold'

  const canMessage =
    isAvailable && Boolean(messengerUrl)

  const priceLabel =
    product.price !== null
      ? `₱${Number(product.price).toLocaleString('en-PH')}`
      : 'the listed price'

  const inquiryText =
    `Hi! I'm interested in ${product.name} (${priceLabel}) ` +
    `from Lovelyn It!. Is it still available?\n\n` +
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

            <div className="product-share">
              <button
                type="button"
                className="product-share-button"
                onClick={handleShareProduct}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
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
                  {isSold && 'This item has been sold'}
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

                {isSold && (
                  <p>
                    This product is no longer available to order.
                  </p>
                )}
              </div>

              {isAvailable && (
                <>
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
