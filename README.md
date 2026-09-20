# Parsely 🌿

A household budgeting app for two: upload bank statements and receipts, get transactions auto-extracted and categorized by Claude, set monthly budgets, forecast upcoming spend, and see month-over-month analytics. Built as an installable PWA so it works well on both iOS and Android without an app store.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS, installable as a PWA (`vite-plugin-pwa`)
- **Backend**: [Supabase](https://supabase.com) — Postgres with Row Level Security, email/password auth, file storage, and one Edge Function
- **Document parsing**: the `parse-document` Edge Function sends uploaded statements/receipts to the Claude API for structured extraction and category suggestions

## One-time setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free project, and note two values from **Settings → API**:
- Project URL
- `anon` public key

### 2. Configure the app

```sh
npm install
cp .env.example .env
```

Fill in `.env` with the Project URL and anon key from step 1.

### 3. Apply the database schema

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don't have it, then either:

**Option A — CLI (recommended):**
```sh
supabase login
supabase init          # only if supabase/config.toml doesn't exist yet; keeps existing migrations/functions
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Option B — paste manually:** open the Supabase dashboard's SQL Editor and paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then run it.

This creates all tables, Row Level Security policies, a private `documents` storage bucket, and the onboarding functions used to create/join a household.

### 4. Deploy the document-parsing Edge Function

You'll need an [Anthropic API key](https://console.anthropic.com/) (cost is a few cents per document — pennies per month for a household's normal usage).

```sh
supabase functions deploy parse-document
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

The key is only ever read server-side inside this function — it's never shipped to the browser.

### 5. Run it locally

```sh
npm run dev
```

Open the printed URL, sign up, create a household, and share the invite code (shown in Settings) with your wife so she can join the same household from her own account.

## Deploying so you can use it on your phones

Push this repo to GitHub, then connect it to [Cloudflare Pages](https://pages.cloudflare.com/) or [Vercel](https://vercel.com/) (both have generous free tiers):

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from your `.env`

Once deployed, open the URL on your phone:

- **iOS (Safari)**: tap Share → "Add to Home Screen"
- **Android (Chrome)**: tap the menu (⋮) → "Add to Home screen" / "Install app"

It'll behave like a native app — its own icon, full-screen, works offline for the app shell.

### Icons

[`public/icons/icon-192.png`](public/icons/icon-192.png) and [`icon-512.png`](public/icons/icon-512.png) are solid-green placeholders. Swap them for a real logo (same filenames/sizes) whenever you'd like — no code changes needed.

## How the AI parsing works

Uploading a statement or receipt (from **Upload**):
1. The file goes to Supabase Storage, under your household's private folder.
2. The `parse-document` Edge Function downloads it and sends it to Claude along with your household's category list.
3. Claude returns structured transactions (date, amount, merchant, suggested category — plus line items for receipts).
4. You land on a **review screen** where you can check boxes, fix categories/amounts, and confirm. Likely duplicates (matching an existing transaction by account/date/amount/description) are flagged and unchecked by default. Category corrections you make are remembered as merchant rules, so the same merchant gets categorized consistently next time.

CSV statement exports are sent to Claude as text; PDFs and receipt photos as documents/images.

## Project structure

```
src/
  lib/            Pure logic (dedupe hashing, budget math, forecasting, aggregation) + Supabase client & data hooks
  components/     Shared UI (tab bar, cards, progress bars, month picker)
  routes/         One file per screen (Dashboard, Upload, Review, Transactions, Budgets, Forecast, Analytics, Settings)
supabase/
  migrations/     SQL schema + RLS policies
  functions/      The parse-document Edge Function
```

## Testing

```sh
npm test
```

Covers the pure logic: dedupe hashing, receipt/statement matching, budget progress math, month arithmetic, forecast projections, and merchant-rule matching.
