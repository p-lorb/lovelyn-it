import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand brand-link">
          Lovelyn It!
        </Link>

        <nav className="nav" aria-label="Main navigation">
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

      <main className="not-found-page">
        <section className="not-found-card">
          <p className="eyebrow">
            Error 404
          </p>

          <h1>
            This page isn’t part of the collection.
          </h1>

          <p>
            The address may be incorrect, or the page may have
            moved. Return to the storefront to continue browsing.
          </p>

          <Link to="/" className="not-found-button">
            Back to the shop →
          </Link>
        </section>
      </main>
    </>
  )
}

export default NotFoundPage
