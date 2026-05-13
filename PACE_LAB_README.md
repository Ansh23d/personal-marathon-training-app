# Pace Lab — Personal Marathon Training Intelligence App

## What Is This?

Pace Lab is a personal fitness dashboard I built that connects to my Strava account and gives me deeper training insights than what Strava's free plan offers. Instead of paying for Strava's premium subscription, I built my own tool that calculates the same advanced metrics — and more — for free.

It lives on my laptop and shows me everything I need to understand my running fitness: how fit I am, how tired I am, how recovered I am, race time predictions, and a structured training plan to reach my goal race.

---

## Why I Built It

I am training for a marathon and needed a structured, guided path to improve my time and actually cross the finish line. The two tools everyone recommends for serious marathon training are **Strava Pro** and **Runna** — a dedicated marathon coaching app. Together they would have cost me **$32 per month**.

Instead, I vibe coded my own solution from scratch. Pace Lab replicates everything those two paid apps would have given me — advanced fitness tracking, race predictions, personalised training plans, and guided daily workouts — and it costs nothing because my code calculates everything by itself using my own Strava data.

Strava's free plan shows basic stats like distance, time, and pace. But the really useful metrics — things like Fitness, Fatigue, Freshness, and race time predictions — are locked behind a paid subscription.

Rather than paying for those features, I built Pace Lab to:

- **Calculate advanced fitness metrics** that Strava charges for, using the same scientific formulas
- **Predict my race times** for 5K, 10K, Half Marathon, and Marathon based on my actual training data
- **Generate a personalised training plan** tailored to my goal race and target finish time
- **Visualise my fitness trends** over time with interactive charts
- **See my run routes on a map** with per-kilometre splits, just like the Strava activity view
- **Own my data** — everything is stored locally on my machine

---

## What It Shows Me

### Dashboard
The home screen gives me an at-a-glance summary of my current training status:

- **Fitness** — How fit I am based on my training over the past 42 days (long-term load)
- **Fatigue** — How tired I am from my recent training over the past 7 days (short-term load)
- **Freshness** — How recovered I am (Fitness minus Fatigue). Positive = ready to race, negative = tired
- **Fitness Score** — A single number (like a VO2 max estimate) calculated from my best recent efforts
- **This Week / Last 30 Days** — My running volume
- **Latest Run** — Quick summary of my most recent activity
- **Race Predictions** — Estimated finish times for 5K, 10K, Half Marathon, and Marathon

### Fitness Analytics
A deeper look at my training trends:

- **Fitness & Freshness Chart** — A 30/90/180/365-day graph showing all three metrics over time, so I can see how my fitness has built up and when I was most ready to race
- **Weekly Relative Effort** — A bar chart showing how hard each week of training was
- **Training Zones** — My five personalised pace zones (Easy, Moderate, Tempo, Threshold, VO2 Max) calculated from my Fitness Score

### Activities
A full log of all my Strava runs with distance, time, pace, relative effort, and fitness score. Clicking any run opens the full detail view.

### Activity Detail (Individual Run)
For each run I can see:

- **GPS route map** showing the exact path I ran
- **Primary stats** — distance, time, pace, elevation
- **Secondary stats** — cadence, calories, relative effort, fitness score
- **Per-kilometre splits** — a table and chart showing how my pace changed throughout the run

### Training Plan
I can set a goal race (5K, 10K, Half Marathon, or Marathon), pick a race date, and set a target finish time. The app generates a week-by-week training plan with:

- Structured workouts for each day (Easy runs, Tempo, Long Run, Rest days, etc.)
- Target distances and pace ranges for each workout
- Training phases: Base → Build → Peak → Taper
- A visual week-by-week calendar view

---

## The Science Behind It

The app uses real exercise science formulas:

| Term | What It Means | Formula Used |
|---|---|---|
| Fitness (CTL) | Chronic Training Load — 42-day rolling average of daily training stress | Exponential moving average |
| Fatigue (ATL) | Acute Training Load — 7-day rolling average | Exponential moving average |
| Freshness (TSB) | Training Stress Balance — how recovered you are | CTL minus ATL |
| Fitness Score | An estimate of aerobic capacity, like VO2 max | Jack Daniels' VDOT formula |
| Race Predictions | Predicted finish times for standard race distances | Jack Daniels' running formula |
| Relative Effort | How hard a run was, scored as a number | Pace-based Training Stress Score (TSS) |
| Training Zones | Personalised pace ranges for different effort levels | Derived from Fitness Score |

---

## How It Works (Technical Overview)

The app has two parts that talk to each other:

**Backend (the brain)**
- Written in Python using a framework called FastAPI
- Connects to Strava's API to download my run data every day at 4am automatically
- Stores all data in a local database file on my laptop (SQLite)
- Calculates all the fitness metrics using the formulas above
- Serves the data to the frontend via a local API

**Frontend (the visual interface)**
- Built with React and TypeScript (a modern web app framework)
- Uses Tailwind CSS for the dark-themed design
- Draws the interactive charts using a library called Recharts
- Shows GPS maps using Leaflet (the same mapping library used by OpenStreetMap)
- Runs in the browser at http://localhost:5173

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend language | Python 3 | Core logic and calculations |
| Backend framework | FastAPI | Handles API requests from the frontend |
| Database | SQLite | Stores all activity and metrics data locally |
| ORM | SQLAlchemy | Reads and writes to the database |
| Scheduler | APScheduler | Runs the daily Strava sync at 4am |
| External API | Strava API (OAuth 2.0) | Downloads my run data |
| Frontend framework | React + TypeScript | Builds the interactive UI |
| Build tool | Vite | Compiles and runs the frontend |
| Styling | Tailwind CSS | Dark-themed responsive design |
| Charts | Recharts | Fitness and effort charts |
| Maps | Leaflet.js | GPS route maps |
| Icons | Lucide React | UI icons |

---

## Data Privacy

Everything stays on my laptop. No data is sent to any third-party server. The only external connection the app makes is to Strava to download my own activity data.

---

## Summary

Pace Lab is essentially a free alternative to Strava's premium subscription, built specifically for my own training. It takes my raw run data from Strava and turns it into actionable insights — telling me how fit I am, how tired I am, when I'm ready to race, and what I should do in training each day to hit my marathon goal.
