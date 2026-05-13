from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from .config import settings
from .database import get_db, init_db
from .models import Activity, DailyMetrics, RaceGoal, TrainingPlan, StravaToken
from .strava import get_auth_url, exchange_code, sync_activities, ensure_activity_detail
from .services import (
    recalculate_all_metrics,
    get_fitness_summary,
    create_training_plan,
    get_current_vdot,
)
from .metrics import pace_zones_from_vdot, format_pace
from .training_plan import get_race_predictions
from .scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Marathon Training Intelligence", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.get("/auth/login")
async def strava_login():
    return RedirectResponse(get_auth_url())


@app.get("/auth/callback")
async def strava_callback(code: str, db: AsyncSession = Depends(get_db)):
    token_data = await exchange_code(code)

    result = await db.execute(
        select(StravaToken).where(StravaToken.athlete_id == token_data["athlete"]["id"])
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = token_data["access_token"]
        existing.refresh_token = token_data["refresh_token"]
        existing.expires_at = token_data["expires_at"]
        existing.athlete_data = token_data["athlete"]
    else:
        token = StravaToken(
            athlete_id=token_data["athlete"]["id"],
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            expires_at=token_data["expires_at"],
            athlete_data=token_data["athlete"],
        )
        db.add(token)

    await db.commit()
    return RedirectResponse("http://localhost:5173/?connected=true")


@app.get("/auth/status")
async def auth_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StravaToken).limit(1))
    token = result.scalar_one_or_none()
    if not token:
        return {"connected": False}
    athlete = token.athlete_data or {}
    return {
        "connected": True,
        "athlete_name": f"{athlete.get('firstname', '')} {athlete.get('lastname', '')}".strip(),
        "athlete_photo": athlete.get("profile_medium"),
    }


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

@app.post("/sync")
async def manual_sync(db: AsyncSession = Depends(get_db)):
    new_count = await sync_activities(db)
    if new_count > 0:
        await recalculate_all_metrics(db)
    return {"new_activities": new_count, "message": f"Synced {new_count} new activities"}


@app.post("/recalculate")
async def force_recalculate(db: AsyncSession = Depends(get_db)):
    await recalculate_all_metrics(db)
    return {"message": "Metrics recalculated"}


# ---------------------------------------------------------------------------
# Dashboard / Fitness
# ---------------------------------------------------------------------------

@app.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    return await get_fitness_summary(db)


@app.get("/fitness/pmc")
async def pmc_chart(
    days: int = Query(default=90, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(DailyMetrics)
        .where(DailyMetrics.date >= cutoff)
        .order_by(DailyMetrics.date)
    )
    rows = result.scalars().all()
    return [
        {
            "date": r.date.strftime("%Y-%m-%d"),
            "fitness": r.ctl,
            "fatigue": r.atl,
            "freshness": r.tsb,
            "relative_effort": r.daily_tss,
        }
        for r in rows
    ]


@app.get("/fitness/zones")
async def pace_zones(db: AsyncSession = Depends(get_db)):
    vdot = await get_current_vdot(db)
    if vdot <= 0:
        return {"error": "Not enough data to calculate zones. Sync more activities."}
    zones = pace_zones_from_vdot(vdot)
    zone_labels = {
        "easy":        "Easy",
        "marathon":    "Moderate",
        "threshold":   "Tempo",
        "interval":    "Threshold",
        "repetition":  "VO2 Max",
    }
    return {
        "fitness_score": round(vdot, 1),
        "zones": {
            zone_labels.get(name, name): {
                "min_pace": format_pace(z["min"]),
                "max_pace": format_pace(z["max"]),
                "min_s": round(z["min"], 1),
                "max_s": round(z["max"], 1),
            }
            for name, z in zones.items()
        },
    }


@app.get("/fitness/predictions")
async def race_predictions(db: AsyncSession = Depends(get_db)):
    vdot = await get_current_vdot(db)
    if vdot <= 0:
        return {"error": "Not enough data"}
    return {"fitness_score": round(vdot, 1), "predictions": get_race_predictions(vdot)}


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

@app.get("/activities")
async def list_activities(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Activity)
        .order_by(desc(Activity.start_date))
        .limit(limit)
        .offset(offset)
    )
    acts = result.scalars().all()
    return [_serialize_activity(a) for a in acts]


@app.get("/activities/{activity_id}")
async def get_activity(activity_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    act = result.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")
    # Fetch full detail from Strava on first view (splits, calories, full polyline)
    act = await ensure_activity_detail(db, act)
    return _serialize_activity_detail(act)


def _serialize_activity_detail(a: Activity) -> dict:
    base = _serialize_activity(a)
    base.update({
        "elapsed_time_s": a.elapsed_time,
        "max_speed": a.max_speed,
        "max_heartrate": a.max_heartrate,
        "average_cadence": a.average_cadence,
        "calories": a.calories,
        "elev_high": a.elev_high,
        "elev_low": a.elev_low,
        "description": a.description,
        "map_polyline": a.map_polyline,
        "start_latlng": a.start_latlng,
        "splits": _serialize_splits(a.splits_metric),
        "strava_url": f"https://www.strava.com/activities/{a.strava_id}",
    })
    return base


def _serialize_splits(splits_metric: list | None) -> list:
    if not splits_metric:
        return []
    result = []
    for s in splits_metric:
        dist = s.get("distance", 0)
        time_s = s.get("moving_time", 0)
        pace = (time_s / dist * 1000) if dist > 0 else None
        result.append({
            "split": s.get("split"),
            "distance_km": round(dist / 1000, 2),
            "moving_time_s": time_s,
            "pace_s": round(pace, 1) if pace else None,
            "elevation_diff": s.get("elevation_difference"),
            "average_heartrate": s.get("average_heartrate"),
            "average_speed": s.get("average_speed"),
        })
    return result


def _serialize_activity(a: Activity) -> dict:
    return {
        "id": a.id,
        "strava_id": a.strava_id,
        "name": a.name,
        "sport_type": a.sport_type,
        "date": a.start_date.strftime("%Y-%m-%d"),
        "distance_km": round((a.distance or 0) / 1000, 2),
        "moving_time_s": a.moving_time,
        "pace_per_km": a.pace_per_km,
        "average_heartrate": a.average_heartrate,
        "relative_effort": a.tss,
        "fitness_score": a.vdot,
        "total_elevation_gain": a.total_elevation_gain,
    }


# ---------------------------------------------------------------------------
# Training Plans
# ---------------------------------------------------------------------------

class PlanCreateRequest(BaseModel):
    race_type: str       # 5K | 10K | half_marathon | marathon
    race_date: Optional[date] = None
    goal_time_s: Optional[float] = None


@app.post("/plan/create")
async def create_plan(req: PlanCreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await create_training_plan(
            db,
            race_type=req.race_type,
            race_date=req.race_date,
            goal_time_s=req.goal_time_s,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/plan/current")
async def current_plan(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RaceGoal).where(RaceGoal.is_active == True).limit(1)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        return {"plan": None}

    plans_result = await db.execute(
        select(TrainingPlan)
        .where(TrainingPlan.race_goal_id == goal.id)
        .order_by(TrainingPlan.week_number)
    )
    weeks = plans_result.scalars().all()

    return {
        "race_type": goal.race_type,
        "race_date": goal.race_date.strftime("%Y-%m-%d") if goal.race_date else None,
        "goal_time_s": goal.goal_time,
        "weeks": [
            {
                "week_number": w.week_number,
                "phase": w.phase,
                "start_date": w.start_date.strftime("%Y-%m-%d"),
                "target_weekly_km": round((w.target_weekly_distance or 0) / 1000, 1),
                "workouts": w.workouts,
            }
            for w in weeks
        ],
    }


@app.get("/plan/this-week")
async def this_week(db: AsyncSession = Depends(get_db)):
    """Return workouts for the current calendar week."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    result = await db.execute(
        select(RaceGoal).where(RaceGoal.is_active == True).limit(1)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        return {"workouts": []}

    plans_result = await db.execute(
        select(TrainingPlan)
        .where(TrainingPlan.race_goal_id == goal.id)
        .where(TrainingPlan.start_date >= datetime.combine(week_start, datetime.min.time()))
        .order_by(TrainingPlan.week_number)
        .limit(1)
    )
    week = plans_result.scalar_one_or_none()
    if not week:
        return {"workouts": []}

    return {
        "week_number": week.week_number,
        "phase": week.phase,
        "target_weekly_km": round((week.target_weekly_distance or 0) / 1000, 1),
        "workouts": week.workouts,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
