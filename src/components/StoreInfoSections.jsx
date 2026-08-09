function StoreInfoSections() {
  const messengerUsername =
    import.meta.env.VITE_MESSENGER_USERNAME

  const messengerUrl = messengerUsername
    ? `https://m.me/${messengerUsername}`
    : null

  return (
    <>
      <section
        className="how-it-works"
        id="how-it-works"
      >
        <div className="store-section-heading">
          <p className="eyebrow">
            Simple and straightforward
          </p>

          <h2>
            How it works
          </h2>

          <p>
            See something you like? There is no complicated
            checkout process. Just browse, message us, and
            we’ll confirm the details with you.
          </p>
        </div>

        <div className="how-it-works-grid">
          <article className="how-step">
            <span className="how-step-number">
              01
            </span>

            <h3>
              Browse the shop
            </h3>

            <p>
              Look through the available items and open
              any product to see its details, price,
              condition, and availability.
            </p>
          </article>

          <article className="how-step">
            <span className="how-step-number">
              02
            </span>

            <h3>
              Message us
            </h3>

            <p>
              Tap Message Seller on an available item
              and you’ll be taken directly to Messenger.
            </p>
          </article>

          <article className="how-step">
            <span className="how-step-number">
              03
            </span>

            <h3>
              Confirm the details
            </h3>

            <p>
              We’ll confirm that the item is still available
              and arrange the rest with you through Messenger.
            </p>
          </article>
        </div>

        <p className="store-process-note">
          This website is for browsing and inquiries.
          No payment or checkout happens directly on the site.
        </p>
      </section>

      <section
        className="contact-section"
        id="contact"
      >
        <div className="contact-card">
          <div className="contact-copy">
            <p className="eyebrow">
              Have a question?
            </p>

            <h2>
              Send us a message
            </h2>

            <p>
              Ask about an item, availability, or anything
              you’d like to know before deciding.
            </p>
          </div>

          {messengerUrl ? (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noreferrer"
              className="contact-button"
            >
              Open Messenger →
            </a>
          ) : (
            <span className="contact-button disabled">
              Messenger unavailable
            </span>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <strong>
            Corner Store
          </strong>

          <span>
            Good finds, finding new homes.
          </span>
        </div>

        <a href="#shop">
          Back to shop ↑
        </a>
      </footer>
    </>
  )
}

export default StoreInfoSections