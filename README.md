# Travel Planner — Card-Based AI Itinerary Generator

Plan trips by dragging recommendation cards onto a per-day timeline. AI cards
are generated with OpenAI `gpt-4o-mini` (structured outputs). Built with
Next.js 14 (App Router, standalone), Prisma + PostgreSQL, Tailwind, and
@dnd-kit.

---

## 1. Environment variables

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@<truenas-ip>:5432/travel_planner?schema=public` | Connection string to **your own** PostgreSQL instance on TrueNAS |
| `OPENAI_API_KEY` | yes | `sk-...` | OpenAI API key for the card generator |
| `PORT` | yes | `30001` | Port the server listens on (mapped to host `30001`) |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Override the model (defaults to `gpt-4o-mini`) |

---

## 2. Local development

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL + OPENAI_API_KEY
npx prisma migrate dev --name init   # creates the DB schema
npm run dev                   # http://localhost:3000
```

Run unit tests:

```bash
npm test
```

---

## 3. Prepare your PostgreSQL on TrueNAS

You only need to do this once. The app container does **not** run its own
PostgreSQL — it connects to yours.

1. Open your PostgreSQL instance on TrueNAS (e.g. the official Postgres app or
   another container you already host).
2. Create an empty database and a user:
   ```sql
   CREATE DATABASE travel_planner;
   CREATE USER travelapp WITH PASSWORD 'choose-a-strong-password';
   GRANT ALL PRIVILEGES ON DATABASE travel_planner TO travelapp;
   ```
3. Build the connection string:
   ```
   postgresql://travelapp:choose-a-strong-password@<truenas-ip>:5432/travel_planner?schema=public
   ```
   Use the IP/hostname reachable from the app container. If both run on the
   same TrueNAS host, the internal Docker gateway IP usually works
   (e.g. `172.17.0.1`), or the TrueNAS LAN IP.

> The schema is created automatically: the container runs
> `prisma migrate deploy` on startup, so the `DATABASE_URL` must be correct.

---

## 4. GitLab CI — build & push to two registries

The pipeline (`.gitlab-ci.yml`) builds the image and pushes it to both:

- `registry.gitlab.com/<your-user>/<your-repo>:latest`
- `ghcr.io/<your-user>/<your-repo>:latest`

Set these CI/CD variables in **Settings → CI/CD → Variables**:

| Variable | Value |
|---|---|
| `GHCR_USER` | your GitHub username |
| `GHCR_PAT` | GitHub Personal Access Token with `write:packages` scope |

The GitLab registry authenticates automatically via `$CI_JOB_TOKEN`. Push to
the default branch to trigger a build.

---

## 5. Deploy on TrueNAS SCALE (Custom App)

### 5.1 Add the registry credentials

1. **Apps → Discover Apps → Custom App** (or `Configuration → Container Images → Pull`).
2. To pull from a private registry, add **Registry Login / Credentials**:
   - **GitLab**: `registry.gitlab.com`, username `gitlab-ci-token` (or a
     [deploy token](https://docs.gitlab.com/ee/user/project/deploy_tokens/)
     with `read_package_registry`), password = the token value.
   - **GHCR**: `ghcr.io`, username = your GitHub username, password = the
     `GHCR_PAT` used above.

### 5.2 Create the Custom App

- **Image**: `registry.gitlab.com/<your-user>/<your-repo>:latest`
  (or the `ghcr.io/...` equivalent)
- **Container port**: `30001`
- **Host port**: `30001` (this is what Cloudflare Tunnel will target)
- **Environment variables**:
  - `DATABASE_URL` = the string from step 3
  - `OPENAI_API_KEY` = your key
  - `PORT` = `30001`
- **Restart policy**: `Unless Stopped`

On first start the entrypoint runs `prisma migrate deploy`, creating all
tables in your PostgreSQL.

---

## 6. Cloudflare Zero Trust Tunnel

1. In the Cloudflare Zero Trust dashboard go to **Networks → Tunnels → Create
   a tunnel** (type: Cloudflared).
2. Install the connector on a machine that can reach your TrueNAS host (the
   TrueNAS host itself, or any always-on machine on the LAN).
3. Add a **Public Hostname** route:
   - **Subdomain/Domain**: e.g. `travel.yourdomain.com`
   - **Service**: `HTTP` → `<truenas-ip>:30001`
4. Save. The app is now reachable at `https://travel.yourdomain.com`.

---

## 7. API overview

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/trips` | list trips |
| POST | `/api/trips` | create trip |
| GET | `/api/trips/[id]` | trip detail (+ cards + slots) |
| PUT | `/api/trips/[id]` | update trip |
| DELETE | `/api/trips/[id]` | delete trip (cascade) |
| POST | `/api/trips/[id]/generate-cards` | AI-generate cards |
| POST | `/api/trips/[id]/cards` | create manual card |
| POST | `/api/trips/[id]/itinerary` | batch save slot positions |
| DELETE | `/api/trips/[id]/itinerary` | unassign cards (body: `{cardIds}`) |
| PATCH | `/api/itinerary/[slotId]` | resize / move a single slot |
| PUT | `/api/cards/[cardId]` | update card |
| DELETE | `/api/cards/[cardId]` | delete card |
