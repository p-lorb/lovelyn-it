import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function ProductCard({ product }) {
  const isAvailable = product.status === 'available'
  const isReserved = product.status === 'reserved'
  const isSold = product.status === 'sold'

  const messengerUsername =
    import.meta.env.VITE_MESSENGER_USERNAME

  const messengerUrl = messengerUsername
    ? `https://m.me/${messengerUsername}`
    : null

  const canMessage =
    isAvailable && Boolean(messengerUrl)

  let imageUrl = null

  if (product.image_path) {
    const { data } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(product.image_path)

    imageUrl = data.publicUrl
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
    <div
      className={`product-card ${
        isSold ? 'product-card-sold' : ''
      }`}
    >
      <Link
        to={`/products/${product.slug}`}
        className="product-card-link"
      >
        <div className="product-photo">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="product-card-image"
            />
          ) : (
            <span>PHOTO</span>
          )}

          {!isAvailable && (
            <span
              className={`status-badge ${
                isReserved ? 'reserved' : 'sold'
              }`}
            >
              {isReserved ? 'Reserved' : 'Sold'}
            </span>
          )}
        </div>
      </Link>

      <div className="product-info">
        {product.brand && (
          <p className="product-brand">
            {product.brand}
          </p>
        )}

        <h3>
          <Link
            to={`/products/${product.slug}`}
            className="product-name-link"
          >
            {product.name}
          </Link>
        </h3>

        <p className="product-meta">
          {product.category}
          {' · '}
          {product.condition}

          {isAvailable &&
            ` · ${product.stock} available`}

          {isReserved &&
            ' · Currently reserved'}

          {isSold &&
            ' · Sold'}
        </p>

        <div>
          <strong>
            {product.price !== null
              ? `₱${product.price}`
              : 'Price coming soon'}
          </strong>

          <button
            type="button"
            disabled={!canMessage}
            onClick={handleMessageSeller}
          >
            {isAvailable && 'Message'}
            {isReserved && 'Reserved'}
            {isSold && 'Sold'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductCard