# Lovelyn It!

Lovelyn It! is a real, finite-inventory product catalog and storefront for browsing and inquiring about new and unused items. It was built for an active small-business catalog rather than as a static mockup: products, availability, images, and admin updates come from Supabase.

Live storefront: [lovelyn-it.pages.dev](https://lovelyn-it.pages.dev/)

## Features

### Customer storefront

- Browse a product catalog with prices, conditions, quantities, and availability.
- Search by product name, brand, or category.
- Filter by Bags & Wallets, Clothing, Accessories, Intimates, and Kitchen & Home.
- Open product detail pages with descriptions, cover photos, gallery images, and status information.
- Distinguish Available, Reserved, and Sold items at a glance.
- Use Facebook Messenger to ask about an available item and share product links through the Web Share API or clipboard fallback.
- See only published products in the public catalog and on public product-detail routes.
- Navigate comfortably on phone, tablet, and desktop layouts.

### Admin workspace

- Sign in with Supabase Auth using email and password.
- Add, edit, and delete products.
- Save products as unpublished drafts or publish them when ready.
- Update prices, stock quantities, and Available / Reserved / Sold status.
- Upload, replace, remove, and preview cover images.
- Add and remove gallery images, with duplicate image-path handling.
- Filter the inventory by search term, category, status, and publication state.

## Tech stack

- React 19
- Vite 8
- React Router 7
- Supabase JavaScript client for database, Auth, and Storage access
- ESLint with React Hooks and React Refresh rules
- Plain CSS for the responsive visual system

## Architecture

The application is a React single-page app with a small route surface:

- `/` — customer storefront, search, filters, featured products, and store information
- `/products/:slug` — customer product details and gallery
- `/admin` — authenticated inventory dashboard
- `/admin/products/new` — product creation
- `/admin/products/:id/edit` — product editing and image management
- Any other path — custom not-found page

Supabase provides the `products` data, `product_images` gallery records, email/password sessions, and the `product-images` Storage bucket. Shared utilities centralize product categories, inventory-state validation, public image URLs, and duplicate image-path handling. The storefront queries published products, while admin workflows load and manage the inventory after authentication.

## Security and data integrity

- The browser client uses the Supabase URL and publishable key only; no service-role key belongs in frontend code.
- Public storefront queries explicitly request `published = true`, including product-detail lookups.
- Admin screens require a Supabase Auth session before exposing product-management workflows.
- Supabase Row Level Security and Storage policies are the authoritative boundary for unpublished-product visibility and admin-only writes. Those policies are managed in the Supabase project rather than stored in this repository.
- Inventory validation keeps the application’s status rules consistent: Available items need stock, while Reserved and Sold items have zero available stock.
- The deployed Supabase schema also enforces data-integrity rules including unique product slugs, valid inventory statuses, non-negative stock and prices, and consistency between product status and available stock.

## UX, performance, and accessibility

- Responsive layouts adapt the storefront, filters, product cards, detail pages, and admin screens to narrow widths.
- Catalog and route loading states provide feedback while data or lazy-loaded pages are arriving.
- Catalog failures and product-detail failures have separate, retryable error states.
- Product images use explicit dimensions, lazy loading where appropriate, asynchronous decoding, priority hints, and graceful fallbacks.
- Product detail routes and admin routes are lazy-loaded to keep the initial customer bundle smaller.
- Product cards and controls include keyboard-visible focus states and semantic labels.
- Reduced-motion preferences disable nonessential transitions and smooth scrolling.
- Browser-back navigation restores the catalog position when returning from a product page.

## Local development

```bash
git clone https://github.com/p-lorb/lovelyn-it.git
cd lovelyn-it
npm install
npm run dev
```

The development server runs through Vite and prints its local URL in the terminal.

Run the available checks with:

```bash
npm run lint
npm run build
```

The production build is written to `dist/`.

## Environment variables

Create a local `.env.local` file with the required variable names:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MESSENGER_USERNAME=
```

Use a publishable/anon client key only. Never commit `.env.local` or place a Supabase service-role key in a `VITE_` variable.

## Deployment

The production storefront is hosted on Cloudflare Pages. The application is built with `npm run build`, which generates the production files in `dist/`. Client-side routes require SPA fallback behavior so direct visits to product and admin routes resolve correctly.

Provider-specific deployment configuration is not stored in this repository.

## Project status

Feature-complete and production-ready for the current storefront and admin workflows.

## What this project demonstrates

- Building a customer-facing React storefront for a real catalog
- Responsive UI design and accessible browsing interactions
- Supabase database, Auth, and Storage integration
- Authenticated CRUD and inventory-management workflows
- Product image and gallery handling
- Search, filtering, route-based detail pages, and custom 404 handling
- Performance-minded loading, image behavior, and route splitting
- Honest security boundaries between frontend validation and backend policy enforcement
