# Double

A longitudinal cognitive infrastructure for tracking beliefs, values, goals, and contradictions over time.

---

## Security — read this first

- Never commit `.env` to git. It is already in `.gitignore`.
- Never paste API keys or database passwords into chat, email, or public forums.
- If you accidentally expose a secret, rotate it immediately at the provider's dashboard.

---

## Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (only needed for the local database option)
- A [Clerk](https://clerk.com) account (for auth)

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` in a text editor. The only required variable to get started is `DATABASE_URL` — see the database options below.

### 3. Set up the database

**Choose one option:**

---

#### Option A — Local Docker (recommended for development)

Requires Docker Desktop to be running.

```bash
npm run db:local
```

This starts a Postgres container named `companion-db` on port 5432. If the container already exists it just starts it — safe to run repeatedly.

Set this in your `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/companion"
```

---

#### Option B — Remote Postgres (Neon, Supabase, Railway, etc.)

1. Create a free database at [neon.tech](https://neon.tech), [supabase.com](https://supabase.com), or [railway.app](https://railway.app).
2. Copy the connection string from the dashboard.
3. Paste it into your `.env`:

```
DATABASE_URL="postgresql://user:password@your-host.neon.tech/dbname?sslmode=require"
```

---

### 4. Run database migrations

```bash
npm run db:migrate
```

This applies all schema changes and generates the Prisma client. Run this whenever you pull new changes that include schema updates.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database commands

| Command | What it does |
|---|---|
| `npm run db:local` | Start (or create) the local Postgres Docker container |
| `npm run db:stop` | Stop the local Postgres container |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate dev`) |
| `npm run db:reset` | **Wipe all data** and re-apply migrations from scratch |
| `npm run db:studio` | Open Prisma Studio — visual database browser |

### Opening Prisma Studio

```bash
npm run db:studio
```

Studio opens at [http://localhost:5555](http://localhost:5555). You can browse and edit any table.

If you see "Can't reach database server at localhost:5432":
1. Make sure Docker Desktop is running.
2. Run `npm run db:local`.
3. Run `npm run db:studio` again.

---

## Other commands

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # Run ESLint
npm test           # Run tests (Vitest)
```

---

## Environment variables reference

See `.env.example` for the full list with descriptions. Required variables:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Local Docker or remote Postgres provider |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk dashboard](https://dashboard.clerk.com) |
| `CLERK_SECRET_KEY` | [Clerk dashboard](https://dashboard.clerk.com) |
