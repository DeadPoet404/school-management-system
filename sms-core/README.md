# sms-core (Frontend)

Next.js 16 (App Router) frontend for the School Management System.
Built with React 19, TypeScript, Tailwind CSS v4, and TanStack Query.

## Tech stack
  - Framework      : Next.js 16 (App Router)
  - UI library     : React 19
  - Language       : TypeScript 5
  - Styling        : Tailwind CSS v4 (PostCSS plugin)
  - Components     : shadcn/ui style primitives under src/components/ui,
                     built on Radix UI / Base UI
  - Data fetching  : TanStack React Query v5
  - Charts         : Recharts
  - Toasts         : sonner
  - Icons          : lucide-react
  - Auth           : httpOnly cookie JWTs (see lib/auth-context and
                       lib/fetch-with-auth)
  - Package mgr    : npm 10+ (package-lock.json committed)

## Running locally

  cd ~/sms-monorepo/sms-core
  npm install
  NEXT_PUBLIC_API_URL="http://localhost:5000/api" \
    BACKEND_URL="http://localhost:5000" \
    npm run dev

  # open localhost on port 3000

For production builds:
  npm run build
  npm run start

For Docker builds see the Dockerfile at the repo root and the
docker-compose.yml in the parent directory.

## Environment variables

  NEXT_PUBLIC_API_URL   Public URL the browser uses to call the API.
                       Baked into the client bundle at build time.
                       Behind Docker Compose rewrites use "/api". For
                        local dev use "http://localhost:5000/api".
  BACKEND_URL          Server-side only, used by Next.js rewrites in
                        next.config.ts to proxy /api/* to the backend.
                       The browser never sees this.

## Folder layout

  src/
    app/                Next.js App Router pages
      layout.tsx       Root layout (Poppins font, providers)
      page.tsx         Redirects to /login
      login/  Login page
      dashboard/        Authenticated dashboard with KPI charts
      students/        Student registry (list, add, departure, gradebook)
      teachers/        Faculty registry (list, add, departure)
      staff/           Staff registry (list, add, departure)
      finance/         Finance module (fees, invoices, payments, payroll)
      operations/      Operations hub and attendance capture
    components/
      ui/               Reusable primitives (button, card, table, dialog)
      *.tsx            Domain-specific views (tables, forms, filters)
    lib/
      auth-context.txx React Context for session state
      fetch-with-auth.ts  Auth fetcher with automatic 401 refresh
      api/              React Query hooks grouped by domain
      query-client.ts  TanStack Query client
      utils.ts         cn() class merger (clsx + tailwind-merge)
    hooks/             Custom React hoks (use-mobile)
    proxy.ts          Edge middleware: cookie-existence route guard
    providers.tsx     Root providers (QueryClient, AuthProvider, Toaster)

## Authentication model

  - Login posts to /api/auth/login;"backend sets httpOnly cookies
    access_token (15 min) and refresh_token (7 day rotating).
    Nothing is stored in localStorage.
  - fetch-with-auth sends credentials:"include" automatically; on 401 it
    calls /api/auth/refresh (single-flight lock) and replays the request.
  - Edge middleware (src/proxy.ts) checks the access_token cookie before
    serving protected routes; redirects to /login if absent. The backend
    still verifies JWT validity so stolen cookies cannot access the API.
  - Client-side ProtectedRoute revalidates on mount via /api/auth/me.

## Lint / build

  npm run lint
  npm run build     # next build; fails on TypeScript errors
