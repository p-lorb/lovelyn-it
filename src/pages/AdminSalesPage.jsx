import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function formatPeso(value) {
  return `₱${Number(value ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function AdminSalesPage() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadSales() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)

      if (!currentSession) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sold_at', { ascending: false })
        .order('id', { ascending: false })

      if (error) {
        console.error('Sales history error:', error)
        setErrorMessage('Could not load sales history.')
      } else {
        setSales(data ?? [])
      }

      setLoading(false)
    }

    loadSales()
  }, [])

  if (loading) {
    return <main className="admin-sales-page">Loading sales...</main>
  }

  if (!session) {
    return (
      <main className="admin-sales-page">
        <h1>Admin sign-in required</h1>
        <Link to="/admin">Go to admin login</Link>
      </main>
    )
  }

  const totalUnits = sales.reduce(
    (total, sale) => total + Number(sale.quantity ?? 0),
    0
  )
  const totalValue = sales.reduce(
    (total, sale) =>
      total + Number(sale.quantity ?? 0) * Number(sale.unit_price ?? 0),
    0
  )

  return (
    <main className="admin-sales-page">
      <header className="admin-edit-product-header">
        <div>
          <Link to="/admin" className="admin-edit-back">
            ← Back to products
          </Link>
          <p className="admin-edit-eyebrow">Lovelyn It! Admin</p>
          <h1>Sales history</h1>
          <p className="admin-edit-product-name">
            A simple record of each completed sale.
          </p>
        </div>
      </header>

      {errorMessage ? (
        <p className="admin-edit-error" role="alert">{errorMessage}</p>
      ) : (
        <>
          <section className="admin-stats">
            <div className="admin-stat"><span>Recorded sales</span><strong>{sales.length}</strong></div>
            <div className="admin-stat"><span>Units sold</span><strong>{totalUnits}</strong></div>
            <div className="admin-stat"><span>Recorded value</span><strong>{formatPeso(totalValue)}</strong></div>
          </section>

          {sales.length === 0 ? (
            <div className="admin-empty-results">
              <strong>No sales recorded yet.</strong>
              <span>Use Record sale from a product when a purchase is completed.</span>
            </div>
          ) : (
            <div className="admin-sales-table-wrap">
              <table className="admin-sales-table">
                <thead>
                  <tr><th>Date</th><th>Product</th><th>Size</th><th>Qty</th><th>Price/unit</th><th>Total</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.sold_at).toLocaleString('en-PH')}</td>
                      <td>{sale.product_name}</td>
                      <td>{sale.variant_label || '—'}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatPeso(sale.unit_price)}</td>
                      <td>{formatPeso(Number(sale.quantity) * Number(sale.unit_price))}</td>
                      <td>{sale.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default AdminSalesPage
