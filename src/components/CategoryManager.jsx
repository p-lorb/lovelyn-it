import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  getCategoryDeletionState,
  sortCategories,
} from '../lib/categories'

function CategoryManager({ categories, onCategoriesChanged }) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')

  const sortedCategories = sortCategories(categories)

  async function createCategory(event) {
    event.preventDefault()
    const name = newCategoryName.trim()

    if (!name) {
      setMessage('Enter a category name first.')
      return
    }

    setSavingId('new')
    setMessage('')

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        sort_order: sortedCategories.length,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Create category error:', error)
      setMessage(error.message || 'Could not create the category.')
    } else {
      setNewCategoryName('')
      onCategoriesChanged([...categories, data])
      setMessage(`${data.name} was added.`)
    }

    setSavingId(null)
  }

  async function saveCategoryName(category) {
    const name = editingName.trim()

    if (!name) {
      setMessage('A category name cannot be empty.')
      return
    }

    setSavingId(category.id)
    setMessage('')

    const { data, error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', category.id)
      .select('*')
      .single()

    if (error) {
      console.error('Rename category error:', error)
      setMessage(error.message || 'Could not rename the category.')
    } else {
      onCategoriesChanged(
        categories.map((item) =>
          item.id === category.id ? data : item
        )
      )
      setEditingId(null)
      setMessage('Category renamed.')
    }

    setSavingId(null)
  }

  async function toggleActive(category) {
    setSavingId(category.id)
    setMessage('')

    const { data, error } = await supabase
      .from('categories')
      .update({ is_active: !category.is_active })
      .eq('id', category.id)
      .select('*')
      .single()

    if (error) {
      console.error('Category activation error:', error)
      setMessage(error.message || 'Could not update this category.')
    } else {
      onCategoriesChanged(
        categories.map((item) =>
          item.id === category.id ? data : item
        )
      )
      setMessage(
        data.is_active
          ? `${data.name} is active.`
          : `${data.name} is inactive.`
      )
    }

    setSavingId(null)
  }

  async function moveCategory(category, direction) {
    const currentIndex = sortedCategories.findIndex(
      (item) => item.id === category.id
    )
    const nextIndex = currentIndex + direction

    if (nextIndex < 0 || nextIndex >= sortedCategories.length) {
      return
    }

    const otherCategory = sortedCategories[nextIndex]
    setSavingId(category.id)
    setMessage('')

    const { error: firstError } = await supabase
      .from('categories')
      .update({ sort_order: otherCategory.sort_order })
      .eq('id', category.id)

    const { error: secondError } = firstError
      ? { error: null }
      : await supabase
          .from('categories')
          .update({ sort_order: category.sort_order })
          .eq('id', otherCategory.id)

    if (firstError || secondError) {
      console.error(
        'Category order error:',
        firstError || secondError
      )
      setMessage('Could not change category order. Please try again.')
    } else {
      onCategoriesChanged(
        categories.map((item) => {
          if (item.id === category.id) {
            return {
              ...item,
              sort_order: otherCategory.sort_order,
            }
          }

          if (item.id === otherCategory.id) {
            return {
              ...item,
              sort_order: category.sort_order,
            }
          }

          return item
        })
      )
    }

    setSavingId(null)
  }

  async function deleteCategory(category) {
    setSavingId(category.id)
    setMessage('')

    const { count, error: usageError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category.id)

    if (usageError) {
      console.error('Category usage check error:', usageError)
      setMessage('Could not verify whether this category is in use.')
      setSavingId(null)
      return
    }

    const deletionState = getCategoryDeletionState(count)

    if (!deletionState.canDelete) {
      if (deletionState.productCount === null) {
        setMessage('Could not verify whether this category is in use.')
      } else {
        setMessage(
          `${category.name} is used by ${deletionState.productCount} product${
            deletionState.productCount === 1 ? '' : 's'
          }. It cannot be deleted; deactivate it instead.`
        )
      }
      setSavingId(null)
      return
    }

    if (!window.confirm(`Permanently delete ${category.name}?`)) {
      setSavingId(null)
      return
    }

    const { data: deletedCategory, error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id)
      .select('id')
      .maybeSingle()

    if (deleteError || !deletedCategory) {
      console.error('Delete category error:', deleteError)
      setMessage(
        deleteError?.code === '23503'
          ? `${category.name} is now in use and cannot be deleted. Deactivate it instead.`
          : deleteError?.message || 'Could not delete this category.'
      )
    } else {
      onCategoriesChanged(
        categories.filter((item) => item.id !== category.id)
      )
      setMessage(`${category.name} was deleted.`)
    }

    setSavingId(null)
  }

  return (
    <section className="admin-category-manager">
      <div className="admin-category-manager-heading">
        <div>
          <h2>Categories</h2>
          <p>Create, rename, order, deactivate, or delete unused categories.</p>
        </div>
      </div>

      <form className="admin-category-create" onSubmit={createCategory}>
        <label>
          New category
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Category name"
            disabled={savingId === 'new'}
          />
        </label>

        <button type="submit" disabled={savingId === 'new'}>
          {savingId === 'new' ? 'Adding...' : 'Add category'}
        </button>
      </form>

      {message && <p className="admin-category-message">{message}</p>}

      <div className="admin-category-list">
        {sortedCategories.map((category, index) => (
          <div className="admin-category-row" key={category.id}>
            {editingId === category.id ? (
              <input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                disabled={savingId === category.id}
              />
            ) : (
              <strong>{category.name}</strong>
            )}

            <span>
              {category.is_active ? 'Active' : 'Inactive'}
            </span>

            <div className="admin-category-actions">
              <button
                type="button"
                onClick={() => moveCategory(category, -1)}
                disabled={index === 0 || savingId === category.id}
                aria-label={`Move ${category.name} up`}
              >
                ↑
              </button>

              <button
                type="button"
                onClick={() => moveCategory(category, 1)}
                disabled={
                  index === sortedCategories.length - 1 ||
                  savingId === category.id
                }
                aria-label={`Move ${category.name} down`}
              >
                ↓
              </button>

              {editingId === category.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveCategoryName(category)}
                    disabled={savingId === category.id}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={savingId === category.id}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(category.id)
                    setEditingName(category.name)
                  }}
                  disabled={savingId === category.id}
                >
                  Rename
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleActive(category)}
                disabled={savingId === category.id}
              >
                {category.is_active ? 'Deactivate' : 'Activate'}
              </button>

              <button
                type="button"
                className="admin-category-delete"
                onClick={() => deleteCategory(category)}
                disabled={savingId === category.id}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default CategoryManager
