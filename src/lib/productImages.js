import { supabase } from './supabase'

export function getProductImageUrl(imagePath) {
  if (!imagePath) {
    return null
  }

  const { data } = supabase
    .storage
    .from('product-images')
    .getPublicUrl(imagePath)

  return data.publicUrl
}

export function removeDuplicateImagePaths(
  coverImagePath,
  galleryItems
) {
  const seenPaths = new Set()

  if (coverImagePath) {
    seenPaths.add(coverImagePath)
  }

  return galleryItems.filter((galleryItem) => {
    const imagePath = galleryItem.image_path

    if (!imagePath || seenPaths.has(imagePath)) {
      return false
    }

    seenPaths.add(imagePath)
    return true
  })
}

export function getUniqueImageFiles(files) {
  const seenFiles = new Set()

  return Array.from(files ?? []).filter((file) => {
    const signature = [
      file.name,
      file.size,
      file.lastModified,
      file.type,
    ].join(':')

    if (seenFiles.has(signature)) {
      return false
    }

    seenFiles.add(signature)
    return true
  })
}
