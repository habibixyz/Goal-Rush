# Goal Rush — Live Football Intelligence Engine

Goal Rush is a production-ready, real-time football intelligence platform powered by live data ingestion and AI match analysis. 

## 1. System Architecture

```
                 SOFASCORE API
                        |
                Poll every 15 sec
                        |
               Live Match Collector (Service 1)
                        |
                   PostgreSQL (via Prisma)
                        |
            Redis Event Broker (Pub/Sub)
                        |
        --------------------------------
        |                              |
  WebSocket Server (Service 2)     AI Match Analyst (Service 3)
        |                              |
        | (Instant updates)            | (Tactical insights & projections)
        |                              |
  Next.js Frontend / REST API --------->
```

* **Live Match Collector (Service 1)**: Polls Sofascore API (or runs fallback high-fidelity simulations) every 15 seconds, detects changed data (goals, cards, substitutions), and commits to Postgres. Publishes change events to Redis.
* **WebSocket Server (Service 2)**: Listens to Redis channels and broadcasts match updates instantly to user rooms with built-in reconnection and deduplication.
* **AI Match Analyst (Service 3)**: Triggered by match events or updates; queries OpenAI API to generate win probabilities, tactical analysis, key player insights, and final score projections, storing them in Postgres.
* **Next.js 15 Frontend & REST API**: Displays live scorecards, timeline incidents, group standings, and AI insights with instant WebSocket updates.

---

## 2. Local Setup (Docker Compose)

The easiest way to start all services locally is via `docker-compose`:

1. Ensure you have Docker and Docker Compose installed.
2. Run the following command from this directory:
   ```bash
   docker-compose up --build
   ```
3. The services will start:
   * **PostgreSQL**: `localhost:5432`
   * **Redis**: `localhost:6379`
   * **WebSocket Server**: `localhost:4000`
   * **Next.js Frontend / REST API**: `localhost:3000`
   * **Collector & AI Analyst**: Running in background.

---

## 3. Production Deployment Guide (Railway)

To deploy the Goal Rush infrastructure on Railway, you will create a PostgreSQL database, a Redis database, and four distinct services pointing to your repository.

### Step 1: Provision Databases
1. Go to your Railway dashboard and click **New Project** -> **Provision PostgreSQL**.
2. Click **New** -> **Database** -> **Provision Redis**.

### Step 2: Deploy Next.js Frontend
1. Click **New** -> **GitHub Repo** and select this repository.
2. In the service settings, rename the service to `goal-rush-frontend`.
3. In **Settings** -> **Build & Deploy**:
   * Set **Root Directory** to `/football-engine`.
   * Set **Dockerfile Path** to `Dockerfile`.
4. In **Variables**, add:
   * `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}` (Railway automatic reference)
   * `NEXT_PUBLIC_SOCKET_URL`: Link to your deployed WebSocket service (e.g., `https://goal-rush-socket-production.up.railway.app`)

### Step 3: Deploy WebSocket Server
1. Click **New** -> **GitHub Repo** and select this repository.
2. Rename the service to `goal-rush-socket`.
3. In **Settings** -> **Build & Deploy**:
   * Set **Root Directory** to `/football-engine/socket`.
   * Set **Dockerfile Path** to `Dockerfile`.
4. In **Variables**, add:
   * `REDIS_URL`: `${{ Redis.REDIS_URL }}`
   * `PORT`: `4000`
5. Generate a domain under **Networking** to expose the WebSocket server.

### Step 4: Deploy Live Match Collector
1. Click **New** -> **GitHub Repo** and select this repository.
2. Rename the service to `goal-rush-collector`.
3. In **Settings** -> **Build & Deploy**:
   * Set **Root Directory** to `/football-engine/collector`.
   * Set **Dockerfile Path** to `Dockerfile`.
4. In **Variables**, add:
   * `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}`
   * `REDIS_URL`: `${{ Redis.REDIS_URL }}`
   * `SOFASCORE_API_URL`: (Optional API Endpoint)
   * `SOFASCORE_API_KEY`: (Optional API Key)

### Step 5: Deploy AI Match Analyst
1. Click **New** -> **GitHub Repo** and select this repository.
2. Rename the service to `goal-rush-ai`.
3. In **Settings** -> **Build & Deploy**:
   * Set **Root Directory** to `/football-engine/ai`.
   * Set **Dockerfile Path** to `Dockerfile`.
4. In **Variables**, add:
   * `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}`
   * `REDIS_URL`: `${{ Redis.REDIS_URL }}`
   * `OPENAI_API_KEY`: Your OpenAI API key (If not provided, the engine automatically falls back to the local deterministic probability and analysis engine).
