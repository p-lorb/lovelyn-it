# Lovelyn It!

Lovelyn It! is a live React and Supabase storefront for a real, limited-inventory catalog of new and unused items. It is designed for a small seller who manages listings and availability directly, while buyers browse actual item photos and inquire through Facebook Messenger.

Live storefront: [lovelyn-it.pages.dev](https://lovelyn-it.pages.dev/)

## What it does

### Customer storefront

- Browse published products with real photos, pricing, condition, availability, and optional galleries.
- Search by product name or brand and filter by the currently published categories.
- View detail pages with share support and a Messenger inquiry path.
- Distinguish **Available**, **Reserved**, and **Sold out** items.
- Choose a size or variant only when that option has physical stock and is not fully reserved.

Lovelyn It! is intentionally an inquiry storefront. It does not include checkout, payment processing, customer accounts, order management, or automatic reservation expiration.

### Admin inventory workspace

- Sign in through Supabase Auth to manage the catalog.
- Create, rename, order, deactivate, and safely remove unused categories.
- Add, edit, publish, unpublish, and delete products where database rules allow it.
- Manage freeform size or variant labels such as bra sizes, clothing sizes, or any custom label needed for a product.
- Manage cover images and gallery images in Supabase Storage.
- Record completed sales and view an admin-only Sales History page.
- Reserve or release specific quantities for a product or a specific variant.

## Inventory rules

Inventory is built for finite stock and avoids treating a completed sale as the same thing as current availability.

- Non-variant products use one physical stock quantity.
- Variant products use physical stock per size or variant; the product total is derived from its active variants.
- Every inventory record can also have a reserved quantity.
- **Available quantity = physical stock − reserved quantity.**
- A normal sale can use only unreserved stock. A sale that completes a reservation must explicitly use reserved stock.
- A product becomes **Sold out** when its physical stock reaches zero. It becomes **Reserved** when physical stock remains but all of it is reserved, or when the admin applies a manual whole-listing reservation.
- Zero-physical-stock variants are not offered to customers. Fully reserved variants remain visible as Reserved but cannot be selected.
- Releasing a reservation makes that quantity available again; reservations do not expire automatically.

Sales are recorded with a product and variant snapshot, quantity, sale price, date, optional note, and whether reserved stock was used. Products and variants with history or active reservations are protected from unsafe deletion or retirement.

## Architecture

Lovelyn It! is a React single-page app built with Vite and React Router.

- `/` — published catalog, search, filters, and storefront information
- `/products/:slug` — product detail, gallery, sharing, and Messenger inquiry
- `/admin` — authenticated inventory workspace
- `/admin/products/new` — product creation
- `/admin/products/:id/edit` — product, image, variant, reservation, and sales actions
- `/admin/sales` — authenticated sales history
- Other paths — custom not-found page

Supabase provides the database, Auth session handling, and `product-images` Storage bucket. Core records include products, admin-managed categories, product gallery images, optional product variants, and sales history. Shared frontend utilities keep category ordering, inventory presentation, public image URLs, and gallery duplicate handling consistent.

## Security and data integrity

- The browser uses only the Supabase URL and publishable key; service-role credentials never belong in frontend code.
- Public catalog reads are limited to published products. Admin access relies on Supabase Auth plus Row Level Security policies.
- Database constraints protect unique product slugs, non-negative prices and quantities, valid statuses, reservation limits, and variant/product inventory consistency.
- Inventory-changing actions use PostgreSQL/Supabase RPCs with admin authorization and row locking. Recording a sale, reducing the correct stock, and writing sales history happen together, helping prevent overselling and partial updates.
- The `sales` table is admin-only. Frontend validation improves the experience but is not treated as the security boundary.

## UX, performance, and accessibility

- Responsive storefront and admin layouts for phone, tablet, and desktop use.
- Loading, retry, and empty states for catalog, detail, inventory, and sales workflows.
- Lazy-loaded routes, responsive image behavior, async decoding, image fallbacks, and gallery duplicate handling.
- Keyboard-visible focus styles, semantic controls and labels, reduced-motion support, and catalog scroll restoration when returning from product pages.

## Local development

```bash
git clone https://github.com/p-lorb/lovelyn-it.git
cd lovelyn-it
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution blocks `npm`:

```bash
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The production build is written to `dist/`.

## Environment variables

Create a local `.env.local` file with variable names only:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MESSENGER_USERNAME=
```

Never commit local environment files or expose a service-role key in a `VITE_` variable.

## Database migrations and release process

Version-controlled database migrations live in [`supabase/migrations`](supabase/migrations). They define the category, variants, sales, reservation, RLS, grant, and RPC changes used by the application.

Database changes should be reviewed and applied to staging first, then tested there with the matching application branch before any production rollout. Applying a migration is an external database operation and is intentionally separate from deploying the frontend.

## Deployment

The production storefront is hosted on Cloudflare Pages. Run `npm run build` to generate `dist/`; deployment needs SPA fallback behavior so direct visits to product and admin routes resolve correctly.

Provider-specific deployment settings are not stored in this repository.

## Project status

Feature-complete and production-ready for its current finite-inventory, Messenger-based selling workflow. Sales History may initially be empty until completed sales are recorded.

## What this project demonstrates

- Customer-facing React development and responsive UI work
- Real inventory and availability modeling for a finite catalog
- Supabase Auth, RLS, Storage, and PostgreSQL integration
- Admin CRUD, category management, freeform variants, reservations, and sales history
- Atomic database operations and overselling protection
- Image/gallery management, route-based detail pages, accessibility, and performance-focused loading
