# GlobeTrotter — Frontend

Personalized travel planning SaaS built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS v4**.
Runs entirely on **mock JSON data** (client-side) — no backend required.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  (redirects to /dashboard)
npm run build    # production build
```

Any email/password logs you in (mock auth). `/` redirects to `/dashboard`.

## Routes

| Area | Route |
| --- | --- |
| Auth | `/login` · `/signup` · `/forgot-password` |
| App | `/dashboard` · `/trips` · `/trips/create` · `/trips/[tripId]` |
| Trip tabs | `…/itinerary` · `…/calendar` · `…/budget` |
| Explore | `/cities` · `/activities` · `/saved` · `/shared` |
| Account | `/profile` · `/settings` |
| Public | `/shared/[shareToken]` (try `europe-adventure-x7k2`) |
| Admin | `/admin` |

## Architecture

```
src/
├── app/                 # App Router pages + route groups (auth) / (dashboard)
├── components/          # ui/ · layout/ · dashboard/ · trips/ · itinerary/ …
├── lib/
│   ├── api/             # async mock API layer (swap for real backend later)
│   ├── constants/       # navigation, categories, status
│   └── utils/           # cn(), formatting helpers
├── data/mock/           # users, trips, cities, activities, itinerary, budget
└── types/               # shared TypeScript models
```

- **Design tokens** live as CSS variables in `app/globals.css`, mapped into Tailwind via `@theme` — swap the palette in one place.
- **Server Components** render static/read-only pages; `"use client"` is used only for forms, modals, charts, and interactive builders.
- The **Itinerary Builder** (`components/itinerary`) supports add/edit/delete/reorder and is structured so drag-and-drop can be layered on later.
- Charts use **Recharts**; icons use **lucide-react**.

## Connecting a real backend

Replace the bodies in `src/lib/api/*` with real `fetch` calls — components consume these functions and never build requests directly.
