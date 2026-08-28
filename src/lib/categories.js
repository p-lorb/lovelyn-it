export function sortCategories(categories) {
  return [...(categories ?? [])].sort((first, second) => {
    const orderDifference =
      Number(first.sort_order ?? 0) -
      Number(second.sort_order ?? 0)

    if (orderDifference !== 0) {
      return orderDifference
    }

    return String(first.name).localeCompare(String(second.name))
  })
}

export function getCategoryRecord(product) {
  if (Array.isArray(product?.categories)) {
    return product.categories[0] ?? null
  }

  return product?.categories ?? null
}

export function withCategoryName(product) {
  const category = getCategoryRecord(product)

  return {
    ...product,
    category_id: product?.category_id ?? category?.id ?? null,
    category: category?.name ?? product?.category ?? 'Uncategorized',
    category_record: category,
  }
}

export function withCategoryNames(products) {
  return (products ?? []).map(withCategoryName)
}
