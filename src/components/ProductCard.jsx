import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function ProductCard({ product, onOpenProduct }) {
  const isAvailable = product.status === 'available'
  const isReserved = product.status === 'reserved'
  const isSold = product.status === 'sold'

  let imageUrl = null

  if (product.image_path) {
    const { data } = supabase
      .storage
      .from('product-images')
      .getPublicUrl(product.image_path)

    imageUrl = data.publicUrl
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
        onClick={onOpenProduct}
      >
        <div className="product-photo">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="product-card-image"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width="600"
              height="600"
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

          <span
            className="product-card-view"
            aria-hidden="true"
          >
            View item →
          </span>
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
            onClick={onOpenProduct}
          >
            {product.name}
          </Link>
        </h3>

        <p className="product-meta">
          {product.category}
          {' · '}
          {product.condition}
        </p>

        <p
          className={`product-availability ${
            isAvailable
              ? 'available'
              : isReserved
                ? 'reserved'
                : 'sold'
          }`}
        >
          {isAvailable && `${product.stock} available`}
          {isReserved && 'Currently reserved'}
          {isSold && 'Sold'}
        </p>

        <div>
          <strong>
            {product.price !== null
              ? `₱${product.price}`
              : 'Price coming soon'}
          </strong>

          <Link
            to={`/products/${product.slug}`}
            className="product-card-action"
            onClick={onOpenProduct}
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
