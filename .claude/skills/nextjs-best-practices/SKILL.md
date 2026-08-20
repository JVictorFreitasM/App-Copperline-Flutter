---
name: nextjs-best-practices
description: Next.js App Router principles. Server Components, data fetching via the project's NestJS API (never direct DB access), routing patterns, Tailwind styling convention.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Next.js Best Practices

> Principles for Next.js App Router development.

---

## 1. Server vs Client Components

### Decision Tree

```
Does it need...?
│
├── useState, useEffect, event handlers
│   └── Client Component ('use client')
│
├── Direct data fetching, no interactivity
│   └── Server Component (default)
│
└── Both? 
    └── Split: Server parent + Client child
```

### By Default

| Type | Use |
|------|-----|
| **Server** | Data fetching, layout, static content |
| **Client** | Forms, buttons, interactive UI |

---

## 2. Data Fetching Patterns

### Fetch Strategy

| Pattern | Use |
|---------|-----|
| **Default** | Static (cached at build) |
| **Revalidate** | ISR (time-based refresh) |
| **No-store** | Dynamic (every request) |

### Data Flow

| Source | Pattern |
|--------|---------|
| NestJS API | Server Component `fetch()` to internal API base URL (`process.env.API_URL`) |
| User input | Client state + Server Action (which itself calls the NestJS API) |

### Backend Integration (Project Convention)

This project's real backend is **NestJS + Prisma + PostgreSQL** — Next.js never touches Postgres, Prisma, or Redis directly. It's a client of the NestJS API.

- Server Components fetch data via `fetch(`${process.env.API_URL}/...`)`, forwarding auth (cookie/Bearer token) as needed.
- Server Actions call the same NestJS API for mutations — they orchestrate the HTTP call and revalidation, they don't reimplement business logic client-side.
- Route Handlers (`app/api/**/route.ts`) are for BFF-specific needs only: aggregating multiple NestJS calls for one client request, webhooks that must land on the Next.js domain, or hiding a third-party secret from the browser. They are not a parallel CRUD layer — if it's plain resource CRUD, call the NestJS API directly instead of duplicating the endpoint in Next.js.
- Never embed database credentials or the Prisma client in the Next.js app.

---

## 3. Routing Principles

### File Conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI |
| `layout.tsx` | Shared layout |
| `loading.tsx` | Loading state |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |

### Route Organization

| Pattern | Use |
|---------|-----|
| Route groups `(name)` | Organize without URL |
| Parallel routes `@slot` | Multiple same-level pages |
| Intercepting `(.)` | Modal overlays |

---

## 4. API Routes

### When to Use Route Handlers Here

The project's business API lives in NestJS. Route Handlers in Next.js are for BFF concerns only (see Backend Integration note above) — not a place to reimplement resource CRUD that already exists in NestJS.

### Route Handlers

| Method | Use |
|--------|-----|
| GET | Read data |
| POST | Create data |
| PUT/PATCH | Update data |
| DELETE | Remove data |

### Best Practices

- Validate input with Zod
- Return proper status codes
- Handle errors gracefully
- Use Edge runtime when possible

---

## 5. Performance Principles

### Image Optimization

- Use next/image component
- Set priority for above-fold
- Provide blur placeholder
- Use responsive sizes

### Bundle Optimization

- Dynamic imports for heavy components
- Route-based code splitting (automatic)
- Analyze with bundle analyzer

---

## 6. Metadata

### Static vs Dynamic

| Type | Use |
|------|-----|
| Static export | Fixed metadata |
| generateMetadata | Dynamic per-route |

### Essential Tags

- title (50-60 chars)
- description (150-160 chars)
- Open Graph images
- Canonical URL

---

## 7. Caching Strategy

### Cache Layers

| Layer | Control |
|-------|---------|
| Request | fetch options |
| Data | revalidate/tags |
| Full route | route config |

### Revalidation

| Method | Use |
|--------|-----|
| Time-based | `revalidate: 60` |
| On-demand | `revalidatePath/Tag` |
| No cache | `no-store` |

---

## 8. Server Actions

### Use Cases

- Form submissions
- Data mutations (call the NestJS API — see Backend Integration note in section 2)
- Revalidation triggers

### Best Practices

- Mark with 'use server'
- Validate all inputs (Zod), then forward to the NestJS API
- Return typed responses
- Handle errors, including the NestJS API returning a non-2xx status

---

## 9. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| 'use client' everywhere | Server by default |
| Fetch in client components | Fetch in server |
| Skip loading states | Use loading.tsx |
| Ignore error boundaries | Use error.tsx |
| Large client bundles | Dynamic imports |
| Prisma/Postgres access from Next.js | Always call the NestJS API |
| Loose CSS files or CSS-in-JS | Tailwind utility classes only |

---

## 10. Styling

This project uses **Tailwind CSS** as the single source of styling — no loose `.css` files beyond the global stylesheet, no CSS-in-JS.

- Compose utility classes directly in JSX; extract to a component (not a CSS class) when a pattern repeats.
- Shared design tokens (colors, spacing, radii) go in `tailwind.config` — don't hardcode hex values or pixel values that already have a token. The concrete token values (color palette, typography scale, border radius, component shapes) come from the project's `design-system` skill — extend `tailwind.config` with those, not the default Tailwind palette.
- For conditional classes, prefer a small utility (e.g. `clsx`/`cn`) over string concatenation.

---

## 11. Project Structure

```
app/
├── (marketing)/     # Route group
│   └── page.tsx
├── (dashboard)/
│   ├── layout.tsx   # Dashboard layout
│   └── page.tsx
├── api/
│   └── [resource]/
│       └── route.ts
└── components/
    └── ui/
```

---

> **Remember:** Server Components are the default for a reason. Start there, add client only when needed.
