# Deploying NetWorth.io on Railway

## 1. Create the project

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → pick `dash`.
2. In the service **Settings → Source**, set **Root Directory** to `app`
   (the code lives in the `app/` subfolder of the repo).
3. Railway detects the `Dockerfile` automatically (also pinned in `railway.json`).

## 2. Add a MySQL database

1. In the same project: **New → Database → MySQL**.
2. Open the MySQL service → **Variables** → copy the connection URL
   (or use the `DATABASE_URL` reference Railway offers).
3. On the app service → **Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `mysql://root:<password>@<mysql-host>:3306/railway` |
   | `APP_SECRET` | any long random string (signs login sessions) |

The schema is created automatically on first boot (migrations run at server
start, with retries while the database wakes up).

## 3. Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project →
   **APIs & Services → OAuth consent screen** → External → fill in app name/email.
2. **Credentials → Create Credentials → OAuth client ID** → type **Web application**.
3. Under **Authorized redirect URIs** add:

   ```
   https://<your-app>.up.railway.app/api/oauth/google/callback
   ```

   (Find the exact domain under the app service → **Settings → Networking →
   Generate Domain**.)
4. Add to the app's Railway **Variables**:

   | Variable | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | `….apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | the client secret |

Redeploy. Visiting the app now shows a **Sign in with Google** page; each
Google account gets its own portfolio. If the Google variables are removed,
the app falls back to an open single shared workspace (no login).

## 4. SnapTrade (live brokerage data)

Either set `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` as Railway
variables, or enter them later in the app's **Settings** page (stored in the
database, masked after saving). Without them the app runs on realistic demo
data so every screen still works.

## 5. Useful notes

- The server listens on `PORT` (Railway sets it automatically) — nothing to do.
- Health check: `GET /api/trpc/ping` returns `{ ok: true }`.
- First request after a cold start may take a few seconds while migrations
  finish; the UI retries automatically.
- To run migrations manually instead: `npm run db:migrate` with `DATABASE_URL` set.
