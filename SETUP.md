# Making Forge public

Follow these in order. Each step ends with something you can check.
`npm run doctor` verifies steps 3–6 at any time.

The app is already usable with none of this — it just saves progress in the
browser. This guide adds Google sign-in and progress that follows a person
between devices.

---

## 1 · Put the code on GitHub

```bash
cd ~/thats_me/forge
gh repo create forge --public --source=. --push     # or create the repo in the UI
```

Without the `gh` CLI: create an empty repo on github.com, then

```bash
git remote add origin https://github.com/<you>/forge.git
git branch -M main
git push -u origin main
```

**Check:** the repository shows your files, including `supabase/schema.sql`.

---

## 2 · Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repository.
2. Framework preset: **Next.js** (auto-detected). Leave everything default.
3. Deploy.

You get a URL like `https://forge-abc123.vercel.app`. **Write it down — call it
`SITE_URL`.**

**Check:** open `SITE_URL`. The landing page loads, you can practise problems,
and progress saves. The account menu says *"Saved in this browser"*. That is
correct — there is no backend yet.

> Everything from here is optional. If you stop now, you have a working public
> product with per-browser progress.

---

## 3 · Create the Supabase project

1. [supabase.com](https://supabase.com) → **New project**.
2. Name it, pick a region near your users, set a database password (save it).
3. Wait for provisioning (~2 minutes).
4. **Project Settings → API.** Copy two values:
   - **Project URL** → `https://<ref>.supabase.co` — call it `SUPABASE_URL`
   - **anon / public** key → a long JWT starting `eyJ` — call it `ANON_KEY`

> **The one people get wrong.** That settings page also shows a *RESTful
> endpoint*, `https://<ref>.supabase.co/rest/v1/`. That is **not** the project
> URL. Copy the origin only — everything after `.supabase.co` must go. The app
> strips it defensively and `npm run doctor` will tell you, but the `.env` is
> clearer without it.
>
> Never put the `service_role` key here. It bypasses row-level security and
> this value ships to every browser.

`<ref>` is the random subdomain, e.g. `abcdefghijklm`. **Write it down.**

> The anon key is *meant* to be public — it ships in the browser bundle. What
> protects your data is row-level security, applied in the next step. Never use
> the `service_role` key in this app.

---

## 4 · Create the tables

Supabase dashboard → **SQL Editor** → **New query**. Paste the entire contents
of `supabase/schema.sql` and click **Run**.

This creates `progress` and `attempts`, enables row-level security, and adds
policies so each person can only read and write their own rows.

**Check:**

```bash
cd ~/thats_me/forge
cp .env.example .env.local
# edit .env.local: paste SUPABASE_URL and ANON_KEY
npm run doctor
```

Sections 1–3 should be green: tables exist, RLS hides other users' rows.
Google is still expected to fail.

---

## 5 · Create the Google OAuth client

In [console.cloud.google.com](https://console.cloud.google.com):

1. Create a project (or pick one).
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create
   - App name, your support email, your developer email → Save
   - Scopes: leave the defaults (`email`, `profile`, `openid`). **Add nothing
     else** — extra scopes trigger Google's verification review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins:**
     ```
     https://<ref>.supabase.co
     ```
   - **Authorized redirect URIs:** ← the step everyone gets wrong
     ```
     https://<ref>.supabase.co/auth/v1/callback
     ```
     This is **Supabase's** callback, not your app's. Google talks to Supabase;
     Supabase then talks to your app.
4. Create → copy the **Client ID** and **Client secret**.

**Check:** the redirect URI ends in `/auth/v1/callback` and contains your
Supabase ref, not your Vercel domain.

---

## 6 · Connect Google to Supabase

Supabase dashboard → **Authentication → Sign In / Providers → Google**:

1. Toggle **Enable**.
2. Paste the **Client ID** and **Client Secret** from step 5.
3. Save.

Then **Authentication → URL Configuration**:

- **Site URL:** where you are testing **right now**. Use `http://localhost:3000`
  while developing and switch it to the deployed domain once the site is live.
  This is the address Supabase falls back to when a redirect is not allowlisted,
  so pointing it at a domain you are not on is how sign-in silently sends you
  somewhere else.
- **Redirect URLs** — add both:
  ```
  https://<your-vercel-domain>/auth/callback
  http://localhost:3000/auth/callback
  ```
  For Vercel preview deployments, also add the wildcard:
  ```
  https://<your-project>-*.vercel.app/auth/callback
  ```

**Check:** `npm run doctor` — section 4 now says *Google sign-in is enabled*.

---

## 7 · Give Vercel the variables

Vercel → your project → **Settings → Environment Variables**. Add three, for
**Production, Preview and Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `NEXT_PUBLIC_SITE_URL` | your Vercel domain, no trailing slash |

Then **Deployments → ⋯ → Redeploy**. Environment variables are baked in at
build time, so an existing deployment will not pick them up.

**Check:** open `SITE_URL`. The account menu (top right) now offers
**Sign in with Google**.

---

## 8 · Let everybody in

While the Google consent screen is in **Testing**, only accounts you list as
test users can sign in — capped at 100.

Google Cloud → **OAuth consent screen** → **Publish app** → confirm.

Because you only requested `email`, `profile` and `openid` — all non-sensitive —
publishing is immediate and needs no Google review.

**Check:** sign in from an account that is *not* yours. It should work.

---

## 9 · Verify end to end

1. Open `SITE_URL`, solve a problem or tick a lab **while signed out**.
2. Sign in with Google. The account menu should show **"Synced to your account"**
   with a green dot.
3. Your signed-out work should still be there — sign-in *merges*, it never wipes.
4. Open the site in a different browser, sign in with the same account: the same
   progress appears.
5. Supabase → **Table Editor → progress**: exactly one row, your user id, with a
   `data` column holding your state.

If the dot is red, open the account menu — the sync error is printed there.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `redirect_uri_mismatch` from Google | Google has your app URL instead of Supabase's | Redirect URI must be `https://<ref>.supabase.co/auth/v1/callback` |
| doctor: `PGRST125 Invalid path`, or auth health 404 | The URL is the REST endpoint, not the project URL | Strip `/rest/v1/` — keep only `https://<ref>.supabase.co` |
| doctor: "reachable but rejected the key" | Wrong or truncated anon key | Re-copy the **anon / public** key; it is ~200+ chars and starts `eyJ` |
| Signs in, lands on a different deployment, not signed in | The redirect was not allowlisted, so Supabase used Site URL instead | Add the exact callback for where you are testing (`http://localhost:3000/auth/callback`) to Redirect URLs, and set Site URL to that same origin |
| Progress "disappeared" after that bounce | localStorage is per-origin — the work is still on the origin you ticked it on | Go back to that origin. Nothing is lost, and an empty device never overwrites the cloud |
| "Sign-in is off" on the login page | Env vars missing at **build** time | Add them in Vercel, then **redeploy** |
| `Access blocked: has not completed verification` | Consent screen still in Testing | Step 8, Publish app |
| Red dot, error mentions `relation ... does not exist` | Schema never ran | Re-run `supabase/schema.sql` |
| Red dot, error mentions row-level security | Policies missing | Re-run `supabase/schema.sql` — it is idempotent |
| Works for you, fails for others | Still in Testing mode | Step 8 |
| Everything green, no data in the table | Nothing to sync yet | Progress pushes on a ~1s debounce after a change |

---

## Running it locally with sign-in

```bash
cp .env.example .env.local     # paste SUPABASE_URL and ANON_KEY
npm run doctor                 # should be all green
npm run dev                    # http://localhost:3000
```

`http://localhost:3000/auth/callback` must be in the Supabase redirect list
(step 6). Leave `NEXT_PUBLIC_SITE_URL` unset locally so it uses the real origin.

---

## Costs

Supabase and Vercel both have free tiers that comfortably cover a personal
project. Supabase pauses a free project after ~1 week of no activity — the
dashboard restores it in a click, and `npm run doctor` reports the project as
unreachable when it is paused.
