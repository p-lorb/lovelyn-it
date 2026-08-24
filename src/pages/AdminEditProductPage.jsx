import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_PRODUCT_CATEGORY,
  PRODUCT_CATEGORIES,
} from '../lib/productCategories'
import { inventoryStateIsValid } from '../lib/inventory'
import {
  getProductImageUrl,
  getUniqueImageFiles,
} from '../lib/productImages'
import './AdminEditProductPage.css'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

function AdminEditProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [product, setProduct] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: DEFAULT_PRODUCT_CATEGORY,
    condition: 'New, unused',
    stock: 0,
    price: '',
    status: 'available',
    description: '',
    published: false,
  })

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Cover image
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageSaving, setImageSaving] = useState(false)
  const [imageInputKey, setImageInputKey] = useState(0)
  const [isCoverDragging, setIsCoverDragging] = useState(false)

  // Gallery
  const [galleryImages, setGalleryImages] = useState([])
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([])
  const [gallerySaving, setGallerySaving] = useState(false)
  const [galleryInputKey, setGalleryInputKey] = useState(0)
  const [removingGalleryId, setRemovingGalleryId] = useState(null)
  const [isGalleryDragging, setIsGalleryDragging] = useState(false)

  useEffect(() => {
    async function loadPage() {
      setLoading(true)
      setErrorMessage('')

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)

      if (!currentSession) {
        setLoading(false)
        return
      }

      const productResponse = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (productResponse.error) {
        console.error(
          'Product load error:',
          productResponse.error
        )

        setErrorMessage(
          'Could not load this product.'
        )

        setLoading(false)
        return
      }

      if (!productResponse.data) {
        setProduct(null)
        setLoading(false)
        return
      }

      const loadedProduct = productResponse.data

      setProduct(loadedProduct)

      setFormData({
        name: loadedProduct.name ?? '',
        brand: loadedProduct.brand ?? '',
        category:
          loadedProduct.category ?? DEFAULT_PRODUCT_CATEGORY,
        condition:
          loadedProduct.condition ?? 'New, unused',
        stock: loadedProduct.stock ?? 0,
        price: loadedProduct.price ?? '',
        status:
          loadedProduct.status ?? 'available',
        description:
          loadedProduct.description ?? '',
        published:
          Boolean(loadedProduct.published),
      })

      const galleryResponse = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', loadedProduct.id)
        .order('sort_order', {
          ascending: true,
        })
        .order('id', {
          ascending: true,
        })

      if (galleryResponse.error) {
        console.error(
          'Gallery load error:',
          galleryResponse.error
        )

        setErrorMessage(
          'The product loaded, but its gallery could not be loaded.'
        )
      } else {
        setGalleryImages(
          galleryResponse.data ?? []
        )
      }

      setLoading(false)
    }

    loadPage()
  }, [id])

  function getFileExtension(file) {
    if (file.type === 'image/jpeg') {
      return 'jpg'
    }

    if (file.type === 'image/png') {
      return 'png'
    }

    if (file.type === 'image/webp') {
      return 'webp'
    }

    return 'jpg'
  }

  function validateImage(file) {
    if (!file) {
      return 'Please choose an image.'
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Images must be JPEG, PNG, or WebP.'
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return 'Each image must be 10 MB or smaller.'
    }

    return null
  }

  function handleFieldChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    // STATUS RULES
    if (name === 'status') {
      setFormData((current) => {
        // Reserved/Sold means there are
        // no units currently available.
        if (
          value === 'reserved' ||
          value === 'sold'
        ) {
          return {
            ...current,
            status: value,
            stock: 0,
          }
        }

        // Do NOT invent stock when choosing Available.
        // The user must enter the real quantity.
        return {
          ...current,
          status: value,
        }
      })

      return
    }

    // STOCK RULES
    if (name === 'stock') {
      setFormData((current) => {
        const nextForm = {
          ...current,
          stock: value,
        }

        const numericStock = Number(value)

        // Restocking a Reserved/Sold product
        // brings it back to Available.
        if (
          value !== '' &&
          Number.isInteger(numericStock) &&
          numericStock > 0 &&
          (
            current.status === 'reserved' ||
            current.status === 'sold'
          )
        ) {
          nextForm.status = 'available'
        }

        return nextForm
      })

      return
    }

    setFormData((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setMessage('')
    setErrorMessage('')

    if (!formData.name.trim()) {
      setErrorMessage(
        'Product name is required.'
      )
      return
    }

    if (
      formData.stock === '' ||
      formData.stock === null
    ) {
      setErrorMessage(
        'Please enter the stock amount.'
      )
      return
    }

    const stock = Number(formData.stock)

    if (
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setErrorMessage(
        'Stock must be a whole number of 0 or higher.'
      )
      return
    }

    // Available requires actual stock.
    if (
      formData.status === 'available' &&
      stock === 0
    ) {
      setErrorMessage(
        'An Available product must have at least 1 unit in stock. Add stock or choose Reserved/Sold.'
      )
      return
    }

    // Reserved and Sold represent no
    // currently available units.
    if (
      (
        formData.status === 'reserved' ||
        formData.status === 'sold'
      ) &&
      stock !== 0
    ) {
      setErrorMessage(
        'Reserved and Sold products must have 0 available stock.'
      )
      return
    }

    if (
      !inventoryStateIsValid(
        formData.status,
        stock
      )
    ) {
      setErrorMessage(
        'The stock and status combination is not valid.'
      )
      return
    }

    let price = null

    if (
      formData.price !== '' &&
      formData.price !== null
    ) {
      price = Number(formData.price)

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        setErrorMessage(
          'Price must be 0 or higher, or leave it blank.'
        )
        return
      }
    }

    // Extra protection when publishing.
    if (
      formData.published &&
      !inventoryStateIsValid(
        formData.status,
        stock
      )
    ) {
      setErrorMessage(
        'This product cannot be published until its stock and status are valid.'
      )
      return
    }

    setSaving(true)

    const { data, error } = await supabase
      .from('products')
      .update({
        name: formData.name.trim(),
        brand:
          formData.brand.trim() || null,
        category: formData.category,
        condition:
          formData.condition.trim() ||
          'New, unused',
        stock,
        price,
        status: formData.status,
        description:
          formData.description.trim() ||
          null,
        published: formData.published,
      })
      .eq('id', product.id)
      .select('*')
      .single()

    if (error) {
      console.error(
        'Product update error:',
        error
      )

      setErrorMessage(
        'Could not save the product.'
      )

      setSaving(false)
      return
    }

    setProduct(data)

    setFormData((current) => ({
      ...current,
      stock: data.stock,
      price: data.price ?? '',
      status: data.status,
      published: data.published,
    }))

    setMessage(
      'Product changes saved.'
    )

    setSaving(false)
  }

  async function handleMainImageUpload() {
    setMessage('')
    setErrorMessage('')

    const validationError =
      validateImage(selectedImage)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setImageSaving(true)

    const extension =
      getFileExtension(selectedImage)

    const newImagePath =
      `products/${product.id}/cover/` +
      `${Date.now()}.${extension}`

    const { error: uploadError } =
      await supabase
        .storage
        .from('product-images')
        .upload(
          newImagePath,
          selectedImage,
          {
            cacheControl: '3600',
            contentType:
              selectedImage.type,
            upsert: false,
          }
        )

    if (uploadError) {
      console.error(
        'Main image upload error:',
        uploadError
      )

      setErrorMessage(
        'Could not upload the cover photo.'
      )

      setImageSaving(false)
      return
    }

    const previousImagePath =
      product.image_path

    const {
      data: updatedProduct,
      error: updateError,
    } = await supabase
      .from('products')
      .update({
        image_path: newImagePath,
      })
      .eq('id', product.id)
      .select('*')
      .single()

    if (updateError) {
      console.error(
        'Attach main image error:',
        updateError
      )

      await supabase
        .storage
        .from('product-images')
        .remove([newImagePath])

      setErrorMessage(
        'The image uploaded, but it could not be attached to the product.'
      )

      setImageSaving(false)
      return
    }

    if (
      previousImagePath &&
      previousImagePath !==
        newImagePath
    ) {
      const { error: removeOldError } =
        await supabase
          .storage
          .from('product-images')
          .remove([
            previousImagePath,
          ])

      if (removeOldError) {
        console.error(
          'Old cover cleanup error:',
          removeOldError
        )
      }
    }

    setProduct(updatedProduct)
    setSelectedImage(null)

    setImageInputKey(
      (current) => current + 1
    )

    setMessage(
      previousImagePath
        ? 'Cover photo replaced.'
        : 'Cover photo uploaded.'
    )

    setImageSaving(false)
  }

  async function handleRemoveMainImage() {
    if (!product.image_path) {
      return
    }

    const confirmed = window.confirm(
      'Remove the current cover photo?'
    )

    if (!confirmed) {
      return
    }

    setMessage('')
    setErrorMessage('')
    setImageSaving(true)

    const oldImagePath =
      product.image_path

    const {
      data: updatedProduct,
      error: updateError,
    } = await supabase
      .from('products')
      .update({
        image_path: null,
      })
      .eq('id', product.id)
      .select('*')
      .single()

    if (updateError) {
      console.error(
        'Remove cover DB error:',
        updateError
      )

      setErrorMessage(
        'Could not remove the cover photo.'
      )

      setImageSaving(false)
      return
    }

    const { error: storageError } =
      await supabase
        .storage
        .from('product-images')
        .remove([oldImagePath])

    setProduct(updatedProduct)

    if (storageError) {
      console.error(
        'Remove cover storage error:',
        storageError
      )

      setMessage(
        'Cover photo removed from the product, but its old storage file could not be cleaned up.'
      )
    } else {
      setMessage(
        'Cover photo removed.'
      )
    }

    setImageSaving(false)
  }

  function selectCoverImage(file) {
    setMessage('')
    setErrorMessage('')

    if (!file) {
      setSelectedImage(null)
      return
    }

    const validationError = validateImage(file)

    if (validationError) {
      setSelectedImage(null)
      setErrorMessage(
        `${file.name}: ${validationError}`
      )
      return
    }

    setSelectedImage(file)
  }

  function handleCoverSelection(event) {
    selectCoverImage(
      event.target.files?.[0] ?? null
    )
  }

  function handleCoverDragOver(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!imageSaving) {
      setIsCoverDragging(true)
    }
  }

  function handleCoverDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsCoverDragging(false)
  }

  function handleCoverDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsCoverDragging(false)

    if (imageSaving) {
      return
    }

    selectCoverImage(
      event.dataTransfer.files?.[0] ?? null
    )
  }

  function selectGalleryFiles(files) {
    setMessage('')
    setErrorMessage('')

    const selectedFiles = Array.from(files ?? [])
    const nextFiles = getUniqueImageFiles(selectedFiles)

    if (nextFiles.length < selectedFiles.length) {
      setMessage('Duplicate files were removed from the selection.')
    }

    if (nextFiles.length === 0) {
      setSelectedGalleryFiles([])
      return
    }

    for (const file of nextFiles) {
      const validationError = validateImage(file)

      if (validationError) {
        setSelectedGalleryFiles([])
        setErrorMessage(
          `${file.name}: ${validationError}`
        )
        return
      }
    }

    setSelectedGalleryFiles(nextFiles)
  }

  function handleGallerySelection(event) {
    selectGalleryFiles(event.target.files)
  }

  function handleGalleryDragOver(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!gallerySaving) {
      setIsGalleryDragging(true)
    }
  }

  function handleGalleryDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsGalleryDragging(false)
  }

  function handleGalleryDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsGalleryDragging(false)

    if (gallerySaving) {
      return
    }

    selectGalleryFiles(event.dataTransfer.files)
  }

  async function handleGalleryUpload() {
    setMessage('')
    setErrorMessage('')

    if (
      selectedGalleryFiles.length === 0
    ) {
      setErrorMessage(
        'Choose at least one gallery photo.'
      )
      return
    }

    for (
      const file of selectedGalleryFiles
    ) {
      const validationError =
        validateImage(file)

      if (validationError) {
        setErrorMessage(
          `${file.name}: ${validationError}`
        )
        return
      }
    }

    setGallerySaving(true)

    const currentHighestOrder =
      galleryImages.reduce(
        (highest, image) =>
          Math.max(
            highest,
            Number(
              image.sort_order ?? 0
            )
          ),
        -1
      )

    const newlyCreatedImages = []

    for (
      let index = 0;
      index <
      selectedGalleryFiles.length;
      index += 1
    ) {
      const file =
        selectedGalleryFiles[index]

      const extension =
        getFileExtension(file)

      const uniquePart =
        `${Date.now()}-${index}-` +
        Math.random()
          .toString(36)
          .slice(2, 8)

      const imagePath =
        `products/${product.id}/gallery/` +
        `${uniquePart}.${extension}`

      const { error: uploadError } =
        await supabase
          .storage
          .from('product-images')
          .upload(
            imagePath,
            file,
            {
              cacheControl: '3600',
              contentType:
                file.type,
              upsert: false,
            }
          )

      if (uploadError) {
        console.error(
          'Gallery upload error:',
          uploadError
        )

        setErrorMessage(
          `Could not upload ${file.name}. Any photos uploaded before it were kept.`
        )

        break
      }

      const {
        data: createdImage,
        error: insertError,
      } = await supabase
        .from('product_images')
        .insert({
          product_id: product.id,
          image_path: imagePath,
          sort_order:
            currentHighestOrder +
            index +
            1,
        })
        .select('*')
        .single()

      if (insertError) {
        console.error(
          'Gallery database error:',
          insertError
        )

        await supabase
          .storage
          .from('product-images')
          .remove([imagePath])

        setErrorMessage(
          `Could not attach ${file.name} to the product.`
        )

        break
      }

      newlyCreatedImages.push(
        createdImage
      )
    }

    if (
      newlyCreatedImages.length > 0
    ) {
      setGalleryImages(
        (current) => [
          ...current,
          ...newlyCreatedImages,
        ].sort((a, b) => {
          const orderDifference =
            Number(a.sort_order) -
            Number(b.sort_order)

          if (orderDifference !== 0) {
            return orderDifference
          }

          return (
            Number(a.id) -
            Number(b.id)
          )
        })
      )

      setMessage(
        newlyCreatedImages.length === 1
          ? '1 gallery photo uploaded.'
          : `${newlyCreatedImages.length} gallery photos uploaded.`
      )
    }

    setSelectedGalleryFiles([])
    setGalleryInputKey(
      (current) => current + 1
    )

    setGallerySaving(false)
  }

  async function handleRemoveGalleryImage(
    galleryImage
  ) {
    const confirmed = window.confirm(
      'Remove this gallery photo?'
    )

    if (!confirmed) {
      return
    }

    setMessage('')
    setErrorMessage('')

    setRemovingGalleryId(
      galleryImage.id
    )

    const { error: deleteError } =
      await supabase
        .from('product_images')
        .delete()
        .eq('id', galleryImage.id)
        .eq(
          'product_id',
          product.id
        )

    if (deleteError) {
      console.error(
        'Gallery row delete error:',
        deleteError
      )

      setErrorMessage(
        'Could not remove the gallery photo.'
      )

      setRemovingGalleryId(null)
      return
    }

    setGalleryImages(
      (current) =>
        current.filter(
          (image) =>
            image.id !==
            galleryImage.id
        )
    )

    const { error: storageError } =
      await supabase
        .storage
        .from('product-images')
        .remove([
          galleryImage.image_path,
        ])

    if (storageError) {
      console.error(
        'Gallery storage cleanup error:',
        storageError
      )

      setMessage(
        'The gallery photo was removed from the product, but its storage file could not be cleaned up.'
      )
    } else {
      setMessage(
        'Gallery photo removed.'
      )
    }

    setRemovingGalleryId(null)
  }

  async function handleDeleteProduct() {
    const confirmed = window.confirm(
      `Delete "${product.name}" permanently?\n\nThis cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    setDeleting(true)
    setMessage('')
    setErrorMessage('')

    const pathsToRemove = [
      product.image_path,
      ...galleryImages.map(
        (image) =>
          image.image_path
      ),
    ].filter(Boolean)

    const {
      data: deletedRows,
      error: deleteError,
    } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id)
      .select('id')

    if (deleteError) {
      console.error(
        'Product delete error:',
        deleteError
      )

      setErrorMessage(
        'Could not delete the product.'
      )

      setDeleting(false)
      return
    }

    if (
      !deletedRows ||
      deletedRows.length === 0
    ) {
      setErrorMessage(
        'The product could not be deleted.'
      )

      setDeleting(false)
      return
    }

    if (pathsToRemove.length > 0) {
      const { error: storageError } =
        await supabase
          .storage
          .from('product-images')
          .remove(pathsToRemove)

      if (storageError) {
        console.error(
          'Product image cleanup error:',
          storageError
        )
      }
    }

    navigate('/admin')
  }

  if (loading) {
    return (
      <main className="admin-edit-product-page">
        <div className="admin-edit-state">
          Loading product...
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="admin-edit-product-page">
        <div className="admin-edit-state">
          <h1>
            Admin sign-in required
          </h1>

          <Link to="/admin">
            Go to admin login
          </Link>
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="admin-edit-product-page">
        <div className="admin-edit-state">
          <h1>
            Product not found
          </h1>

          <Link to="/admin">
            ← Back to admin
          </Link>
        </div>
      </main>
    )
  }

  const mainImageUrl =
    getProductImageUrl(
      product.image_path
    )

  const currentInventoryValid =
    inventoryStateIsValid(
      formData.status,
      formData.stock
    )

  return (
    <main className="admin-edit-product-page">
      <div className="admin-edit-product-header">
        <div>
          <Link
            to="/admin"
            className="admin-edit-back"
          >
            ← Back to products
          </Link>

          <p className="admin-edit-eyebrow">
            Lovelyn It! Admin
          </p>

          <h1>
            Edit product
          </h1>

          <p className="admin-edit-product-name">
            {product.name}
          </p>
        </div>

        <span
          className={
            formData.published
              ? 'admin-edit-visibility published'
              : 'admin-edit-visibility unpublished'
          }
        >
          {formData.published
            ? 'Published'
            : 'Unpublished'}
        </span>
      </div>

      {message && (
        <div className="admin-edit-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="admin-edit-error">
          {errorMessage}
        </div>
      )}

      <section className="admin-edit-photo-section">
        <div className="admin-edit-section-heading">
          <div>
            <h2>
              Cover photo
            </h2>

            <p>
              This is the main image shown on
              product cards and the storefront.
            </p>
          </div>

          <span className="admin-photo-label">
            MAIN
          </span>
        </div>

        <div className="admin-cover-manager">
          <div className="admin-cover-preview">
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={product.name}
              />
            ) : (
              <span>
                NO PHOTO YET
              </span>
            )}
          </div>

          <div className="admin-photo-actions">
            <label
              className={`admin-drop-zone${
                isCoverDragging
                  ? ' is-dragging'
                  : ''
              }${
                imageSaving
                  ? ' is-disabled'
                  : ''
              }`}
              onDragEnter={handleCoverDragOver}
              onDragOver={handleCoverDragOver}
              onDragLeave={handleCoverDragLeave}
              onDrop={handleCoverDrop}
            >
              <span
                className="admin-drop-zone-icon"
                aria-hidden="true"
              >
                ↓
              </span>

              <strong>
                {product.image_path
                  ? 'Drop a new cover photo here'
                  : 'Drop cover photo here'}
              </strong>

              <span>
                or click to browse
              </span>

              <input
                key={imageInputKey}
                className="admin-drop-zone-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverSelection}
                disabled={imageSaving}
              />
            </label>

            {selectedImage && (
              <p className="admin-selected-file">
                Selected: {selectedImage.name}
              </p>
            )}

            <div className="admin-photo-button-row">
              <button
                type="button"
                className="admin-upload-photo-button"
                onClick={
                  handleMainImageUpload
                }
                disabled={
                  !selectedImage ||
                  imageSaving
                }
              >
                {imageSaving
                  ? 'Saving...'
                  : product.image_path
                    ? 'Replace cover photo'
                    : 'Upload cover photo'}
              </button>

              {product.image_path && (
                <button
                  type="button"
                  className="admin-remove-photo-button"
                  onClick={
                    handleRemoveMainImage
                  }
                  disabled={imageSaving}
                >
                  Remove cover
                </button>
              )}
            </div>

            <p className="admin-photo-help">
              JPEG, PNG, or WebP. Maximum
              10 MB.
            </p>
          </div>
        </div>
      </section>

      <section className="admin-edit-photo-section">
        <div className="admin-edit-section-heading">
          <div>
            <h2>
              Gallery photos
            </h2>

            <p>
              Add extra angles, close-ups,
              labels, packaging, or original
              photos of the item.
            </p>
          </div>

          <span className="admin-gallery-count">
            {galleryImages.length}
            {' '}
            {galleryImages.length === 1
              ? 'photo'
              : 'photos'}
          </span>
        </div>

        {galleryImages.length > 0 ? (
          <div className="admin-gallery-grid">
            {galleryImages.map(
              (galleryImage, index) => {
                const galleryUrl =
                  getProductImageUrl(
                    galleryImage.image_path
                  )

                return (
                  <article
                    className="admin-gallery-card"
                    key={galleryImage.id}
                  >
                    <div className="admin-gallery-image">
                      <img
                        src={galleryUrl}
                        alt={`${product.name} gallery ${index + 1}`}
                      />

                      <span className="admin-gallery-number">
                        {index + 1}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="admin-gallery-remove"
                      onClick={() =>
                        handleRemoveGalleryImage(
                          galleryImage
                        )
                      }
                      disabled={
                        removingGalleryId ===
                        galleryImage.id
                      }
                    >
                      {removingGalleryId ===
                      galleryImage.id
                        ? 'Removing...'
                        : 'Remove'}
                    </button>
                  </article>
                )
              }
            )}
          </div>
        ) : (
          <div className="admin-gallery-empty">
            <strong>
              No extra photos yet
            </strong>

            <span>
              The cover photo will continue
              working normally.
            </span>
          </div>
        )}

        <div className="admin-gallery-upload">
          <label
            className={`admin-drop-zone${
              isGalleryDragging
                ? ' is-dragging'
                : ''
            }${
              gallerySaving
                ? ' is-disabled'
                : ''
            }`}
            onDragEnter={handleGalleryDragOver}
            onDragOver={handleGalleryDragOver}
            onDragLeave={handleGalleryDragLeave}
            onDrop={handleGalleryDrop}
          >
            <span
              className="admin-drop-zone-icon"
              aria-hidden="true"
            >
              ↓
            </span>

            <strong>
              Drop gallery photos here
            </strong>

            <span>
              or click to browse — multiple files supported
            </span>

            <input
              key={galleryInputKey}
              className="admin-drop-zone-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleGallerySelection}
              disabled={gallerySaving}
            />
          </label>

          {selectedGalleryFiles.length >
            0 && (
            <div className="admin-gallery-selected">
              <strong>
                {selectedGalleryFiles.length}
                {' '}
                {selectedGalleryFiles.length ===
                1
                  ? 'file selected'
                  : 'files selected'}
              </strong>

              <div>
                {selectedGalleryFiles.map(
                  (file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                    >
                      {file.name}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            className="admin-upload-photo-button"
            onClick={handleGalleryUpload}
            disabled={
              gallerySaving ||
              selectedGalleryFiles.length ===
                0
            }
          >
            {gallerySaving
              ? 'Uploading...'
              : selectedGalleryFiles.length >
                  1
                ? `Upload ${selectedGalleryFiles.length} photos`
                : 'Upload gallery photo'}
          </button>

          <p className="admin-photo-help">
            You can select several images at
            once. JPEG, PNG, or WebP; maximum
            10 MB each.
          </p>
        </div>
      </section>

      <form
        className="admin-edit-form"
        onSubmit={handleSubmit}
      >
        <section className="admin-edit-form-section">
          <div className="admin-edit-section-heading">
            <div>
              <h2>
                Product information
              </h2>

              <p>
                Update the details customers
                will eventually see.
              </p>
            </div>
          </div>

          <div className="admin-edit-form-grid">
            <label className="admin-edit-field admin-edit-field-wide">
              Product name

              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={
                  handleFieldChange
                }
                required
              />
            </label>

            <label className="admin-edit-field">
              Brand

              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={
                  handleFieldChange
                }
                placeholder="Optional"
              />
            </label>

            <label className="admin-edit-field">
              Category

              <select
                name="category"
                value={formData.category}
                onChange={
                  handleFieldChange
                }
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-edit-field">
              Condition

              <input
                type="text"
                name="condition"
                value={
                  formData.condition
                }
                onChange={
                  handleFieldChange
                }
              />
            </label>

            <label className="admin-edit-field">
              Stock

              <input
                type="number"
                name="stock"
                min="0"
                step="1"
                value={formData.stock}
                onChange={
                  handleFieldChange
                }
              />
            </label>

            <label className="admin-edit-field">
              Price

              <div className="admin-edit-price-input">
                <span>
                  ₱
                </span>

                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={
                    handleFieldChange
                  }
                  placeholder="Leave blank for now"
                />
              </div>
            </label>

            <label className="admin-edit-field">
              Status

              <select
                name="status"
                value={formData.status}
                onChange={
                  handleFieldChange
                }
              >
                <option value="available">
                  Available
                </option>

                <option value="reserved">
                  Reserved
                </option>

                <option value="sold">
                  Sold
                </option>
              </select>
            </label>

            <label className="admin-edit-field admin-edit-field-wide">
              Description

              <textarea
                name="description"
                rows="6"
                value={
                  formData.description
                }
                onChange={
                  handleFieldChange
                }
                placeholder="Description can be added later."
              />
            </label>
          </div>

          {!currentInventoryValid && (
            <div className="admin-edit-error">
              {formData.status === 'available'
                ? 'Available products need at least 1 unit in stock.'
                : 'Reserved and Sold products must have 0 available stock.'}
            </div>
          )}

          <label className="admin-edit-published-toggle">
            <input
              type="checkbox"
              name="published"
              checked={
                formData.published
              }
              onChange={
                handleFieldChange
              }
            />

            <span>
              <strong>
                Published
              </strong>

              <small>
                Show this product on the
                public storefront.
              </small>
            </span>
          </label>
        </section>

        <div className="admin-edit-footer-actions">
          <button
            type="submit"
            className="admin-edit-save"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save changes'}
          </button>

          <button
            type="button"
            className="admin-edit-delete"
            onClick={
              handleDeleteProduct
            }
            disabled={deleting}
          >
            {deleting
              ? 'Deleting...'
              : 'Delete product'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default AdminEditProductPage
