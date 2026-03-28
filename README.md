# Budget Dashboard

A personal financial planning app built with Vue 3, Supabase, and Tailwind CSS. Track income and expenses, project balances over time, save and compare scenarios, and sync data across devices via Google sign-in.

## Features

- **Dashboard** — KPI cards, SVG trend chart, insights, and milestones at a glance
- **Projections** — Configure monthly income/expenses, project balances over N months, view monthly breakdown table
- **Scenarios** — Save, rename, load, delete, import/export budget plans
- **Exchange rates** — Live currency conversion via European Central Bank rates (SEK, EUR, USD, GBP)
- **Settings** — Theme (light/dark), currency, locale, start month, data reset
- **Auth** — Google OAuth via Supabase, per-user data isolation with Row Level Security
- **Responsive** — Desktop sidebar + mobile top bar and bottom tabs

## Tech Stack

- **Frontend:** Vue 3 (Composition API), Pinia, Vue Router, PrimeVue 4, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Build:** Vite, TypeScript
- **Testing:** Vitest (jsdom)
- **CI/CD:** GitHub Actions, Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- Google OAuth credentials ([Google Cloud Console](https://console.cloud.google.com))

### Setup

```bash
# Clone and install
git clone https://github.com/FilipGadzo1/budget-dashboard.git
cd budget-dashboard
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL and publishable key

# Run database migration
# Go to Supabase Dashboard > SQL Editor and run:
# supabase/migrations/001_initial_schema.sql

# Start dev server
npm run dev
```

### Supabase Setup

1. Create a Supabase project
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Enable **Google** under Authentication > Providers (add your OAuth client ID/secret)
4. Add redirect URLs under Authentication > URL Configuration:
   - `http://localhost:5173/**`
   - `https://your-production-domain.vercel.app/**`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Vite) |
| `npm run build` | Type-check and build for production |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check without building |

## Branch Strategy

| Branch | Environment | Deploy |
|---|---|---|
| `main` | Production | Vercel production |
| `staging` | Staging | Vercel preview |
| `dev` | Development | Vercel preview |

## Project Structure

```
src/
├── components/app/       # AppShell (sidebar, nav, layout)
├── components/shared/    # Reusable UI (EmptyState, ConfirmDeleteDialog)
├── composables/          # useAuth, useCurrency, useExchangeRates
├── data/                 # Default/mock data
├── lib/                  # Supabase client
├── models/               # TypeScript interfaces
├── router/               # Vue Router with auth guard
├── services/             # Database CRUD, projection math
├── stores/               # Pinia stores (projection, UI)
├── validation/           # Yup schemas
├── views/                # Page components
└── style.css             # Design system tokens and global styles
supabase/
└── migrations/           # SQL schema and RLS policies
```

## License

Private project.
