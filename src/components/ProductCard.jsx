import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductImageUrl } from '../lib/productImages'

export function ProductCardSkeleton() {
  return (
    <article
      className="product-card product-card-skeleton"
      aria-hidden="true"
    >
      <div className="product-photo product-skeleton-photo" />

      <div className="product-info product-skeleton-info">
        <span className="product-skeleton-line product-skeleton-brand" />
        <span className="product-skeleton-line product-skeleton-title" />
        <span className="product-skeleton-line product-skeleton-meta" />
        <span className="product-skeleton-pill" />

        <div className="product-skeleton-footer">
          <span className="product-skeleton-price" />
          <span className="product-skeleton-action" />
        </div>
      </div>
    </article>
  )
}

function ProductCard({ product, onOpenProduct }) {
  const isAvailable = product.status === 'available'
  const isReserved = product.status === 'reserved'
  const isSold = product.status === 'sold'
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageUnavailable, setImageUnavailable] = useState(false)

  const imageUrl = getProductImageUrl(product.image_path)

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
          {imageUrl && !imageUnavailable ? (
            <img
              src={imageUrl}
              alt={product.name}
              className={`product-card-image ${
                imageLoaded ? 'is-loaded' : ''
              }`}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width="600"
              height="600"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageUnavailable(true)}
            />
          ) : (
            <span className="product-image-fallback">
              Photo unavailable
            </span>
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
