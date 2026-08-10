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
            Buying from Lovelyn It!
          </p>

          <h2>
            How it works
          </h2>

          <p>
            This website is the live catalog. Browse the actual
            items and send a message through Facebook to confirm
            quantities, payment, and delivery privately. The shop
            is based in Cavite.
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
              Send a message
            </h3>

            <p>
              Open a product to see the full description, photos,
              price, and available quantity. When you’re ready,
              tap Message about this item to open Messenger.
            </p>
          </article>

          <article className="how-step">
            <span className="how-step-number">
              03
            </span>

            <h3>
              Choose delivery
            </h3>

            <p>
              Cash meetup or personal delivery may be available
              near Cavite. For farther locations, Lalamove can be
              arranged with the delivery fee paid by the buyer.
            </p>
          </article>

          <article className="how-step">
            <span className="how-step-number">
              04
            </span>

            <h3>
              Confirm and receive
            </h3>

            <p>
              Requested quantities are reserved after confirmation
              in Messenger and held for 24 hours. Cash is accepted
              at meetup; Lalamove orders require payment before
              dispatch.
            </p>
          </article>
        </div>

        <p className="store-process-note">
          Listed prices do not include delivery. Lalamove fees
          are based on the live app quote at booking. No payment
          or checkout happens directly on this website. Payment
          account details and exact addresses are only shared
          privately after confirmation. GCash, Maya, GoTyme, and
          PayPal may be arranged through Messenger. If a hold is
          not confirmed within 24 hours, the quantity may be offered
          to the next interested buyer.
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
              Send the product name, quantity, and your general
              location in or outside Cavite. Availability, payment,
              and delivery options will be confirmed in Messenger.
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
            Lovelyn It!
          </strong>

          <span>
            Find something you’ll love.
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
