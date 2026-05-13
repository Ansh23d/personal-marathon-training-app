# Pace Lab: Personal Marathon Training App

## What Is This?

Pace Lab is a personal fitness dashboard I built that connects to my Strava account and gives me deeper training insights than what Strava's free plan offers. Instead of paying for Strava's premium subscription, I built my own tool that calculates the same advanced metrics for free.

It lives on my laptop and shows me everything I need to understand my running fitness: how fit I am, how tired I am, how recovered I am, race time predictions, and a structured training plan to reach my goal race.

## Why I Built It

I am training for a marathon and needed a structured, guided path to improve my time and actually cross the finish line. The two tools everyone recommends for serious marathon training are **Strava Pro** and **Runna** - a dedicated marathon coaching app. Together they would have cost me **$32 per month**.

Instead, I vibe coded my own solution from scratch. Pace Lab replicates everything those two paid apps would have given me — advanced fitness tracking, race predictions, personalised training plans, and guided daily workouts and it costs nothing because my code calculates everything by itself using my own Strava data.

## Setup

### 1. Strava API credentials

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an app:
   - Website: `http://localhost:3000`
   - Authorization Callback Domain: `localhost`
3. Copy your **Client ID** and **Client Secret**

### 2. Configure backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and fill in STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET
```

### 3. Start the app

```bash
./start.sh
```

Opens:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 4. Connect Strava

Click **Connect with Strava** in the app, authorize, then click **Sync Strava** to import your activities.

---

## Features

| Feature | Description |
|---|---|
| **Strava Sync** | Imports all running activities, auto-syncs daily at 4am |
| **VDOT** | Jack Daniels' fitness score from your best recent efforts |
| **CTL / ATL / TSB** | Performance Management Chart — Fitness, Fatigue, Form |
| **TSS** | Training Stress Score per run (pace-based) |
| **TRIMP** | Training Impulse (HR-based when available) |
| **Pace Zones** | 5 training zones derived from your threshold pace |
| **Race Predictions** | Predicted times for 5K → marathon from current VDOT |
| **Training Plans** | 5K / 10K / Half / Full plans with periodization |
| **Adaptive Plans** | Paces update as your fitness changes |

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /dashboard` | CTL, ATL, TSB, weekly km, VDOT, race predictions |
| `GET /fitness/pmc?days=90` | PMC chart data |
| `GET /fitness/zones` | Pace zones from VDOT |
| `GET /fitness/predictions` | Race time predictions |
| `GET /activities` | Activity log with TSS/VDOT |
| `POST /sync` | Manual Strava sync |
| `POST /plan/create` | Create training plan |
| `GET /plan/current` | Full active plan |
| `GET /plan/this-week` | Current week's workouts |

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite + APScheduler
- **Frontend**: React + TypeScript + Vite + Tailwind + Recharts
- **Analytics**: Jack Daniels VDOT, Banister PMC, pace-based TSS — all custom implementations
