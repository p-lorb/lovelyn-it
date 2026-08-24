export function inventoryStateIsValid(status, stock) {
  const numericStock = Number(stock)

  if (status === 'available') {
    return numericStock > 0
  }

  if (status === 'reserved' || status === 'sold') {
    return numericStock === 0
  }

  return false
}
