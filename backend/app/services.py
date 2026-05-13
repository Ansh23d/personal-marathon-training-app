"""
Business logic layer: recalculate derived metrics for all activities,
update DailyMetrics, and handle plan creation/adaptation.
"""

from datetime import date, datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from .models import Activity, DailyMetrics, RaceGoal, TrainingPlan, WorkoutLog
from .metrics import (
    vdot_from_race,
    tss_from_activity,
    trimp_from_activity,
    compute_pmc,
    estimate_threshold_pace,
    RACE_DISTANCES_M,
)
from .training_plan import generate_plan, get_race_predictions


async def recalculate_all_metrics(db: AsyncSession):
    """Recalculate TSS, TRIMP, VDOT for all activities, then rebuild PMC."""
    result = await db.execute(select(Activity).order_by(Activity.start_date))
    activities = result.scalars().all()

    # Estimate threshold pace from best recent efforts
    best_vdot = await _estimate_vdot(activities)
    threshold_pace = estimate_threshold_pace(best_vdot) if best_vdot > 0 else 300.0

    daily_tss: dict[date, float] = {}

    for act in activities:
        dist = act.distance or 0
        time_s = act.moving_time or 0

        if dist < 400 or time_s < 60:
            continue

        # VDOT from this effort (only meaningful for efforts > 3 min)
        act.vdot = round(vdot_from_race(dist, time_s), 2) if time_s > 180 else None

        # TSS
        act.tss = round(tss_from_activity(dist, time_s, threshold_pace), 2)

        # TRIMP
        act.trimp = round(trimp_from_activity(time_s, act.average_heartrate), 2)

        act_date = act.start_date.date() if isinstance(act.start_date, datetime) else act.start_date
        daily_tss[act_date] = daily_tss.get(act_date, 0) + act.tss

    await db.commit()

    # Rebuild DailyMetrics
    await db.execute(delete(DailyMetrics))
    pmc = compute_pmc(daily_tss)
    for entry in pmc:
        dm = DailyMetrics(
            date=datetime.combine(entry["date"], datetime.min.time()),
            ctl=entry["ctl"],
            atl=entry["atl"],
            tsb=entry["tsb"],
            daily_tss=entry["daily_tss"],
        )
        db.add(dm)
    await db.commit()


async def _estimate_vdot(activities: list) -> float:
    """Estimate current VDOT from best effort in recent 90 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    best = 0.0
    for act in activities:
        start = act.start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start < cutoff:
            continue
        if act.distance and act.moving_time and act.moving_time > 300:
            v = vdot_from_race(act.distance, act.moving_time)
            if v > best:
                best = v
    return best


async def get_current_vdot(db: AsyncSession) -> float:
    result = await db.execute(
        select(Activity)
        .where(Activity.start_date >= datetime.now(timezone.utc) - timedelta(days=90))
        .where(Activity.moving_time >= 300)
        .order_by(Activity.vdot.desc())
        .limit(1)
    )
    act = result.scalar_one_or_none()
    return act.vdot if act and act.vdot else 0.0


async def get_fitness_summary(db: AsyncSession) -> dict:
    """Return current CTL, ATL, TSB and weekly stats."""
    result = await db.execute(
        select(DailyMetrics).order_by(DailyMetrics.date.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()

    # Weekly distance (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    acts_result = await db.execute(
        select(Activity).where(Activity.start_date >= week_ago)
    )
    recent = acts_result.scalars().all()
    weekly_km = sum(a.distance or 0 for a in recent) / 1000

    # Monthly distance (last 30 days)
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    acts_result30 = await db.execute(
        select(Activity).where(Activity.start_date >= month_ago)
    )
    monthly = acts_result30.scalars().all()
    monthly_km = sum(a.distance or 0 for a in monthly) / 1000

    vdot = await get_current_vdot(db)
    predictions = get_race_predictions(vdot) if vdot > 0 else {}

    return {
        "fitness": round(latest.ctl, 1) if latest else 0,
        "fatigue": round(latest.atl, 1) if latest else 0,
        "freshness": round(latest.tsb, 1) if latest else 0,
        "weekly_km": round(weekly_km, 1),
        "monthly_km": round(monthly_km, 1),
        "fitness_score": round(vdot, 1) if vdot else 0,
        "race_predictions": predictions,
    }


async def create_training_plan(
    db: AsyncSession,
    race_type: str,
    race_date: date | None,
    goal_time_s: float | None,
) -> dict:
    """Create a new training plan, deactivating any existing active plan."""

    vdot = await get_current_vdot(db)

    # Deactivate existing active goals/plans
    existing_goals = await db.execute(select(RaceGoal).where(RaceGoal.is_active == True))
    for goal in existing_goals.scalars().all():
        goal.is_active = False
    await db.commit()

    race_goal = RaceGoal(
        race_type=race_type,
        race_date=datetime.combine(race_date, datetime.min.time()) if race_date else None,
        goal_time=int(goal_time_s) if goal_time_s else None,
        is_active=True,
    )
    db.add(race_goal)
    await db.flush()

    start = date.today()
    plan_weeks = generate_plan(
        race_type=race_type,
        vdot=vdot,
        start_date=start,
        race_date=race_date,
        goal_time_s=goal_time_s,
    )

    for week in plan_weeks:
        plan_week = TrainingPlan(
            race_goal_id=race_goal.id,
            week_number=week["week_number"],
            phase=week["phase"],
            start_date=datetime.fromisoformat(week["start_date"]),
            target_weekly_distance=week["target_weekly_km"] * 1000,
            workouts=week["workouts"],
            is_current=(week["week_number"] == 1),
        )
        db.add(plan_week)

        for workout in week["workouts"]:
            log = WorkoutLog(
                plan_id=race_goal.id,
                week_number=week["week_number"],
                day_of_week=workout["day_of_week"],
                planned_workout=workout,
                status="pending",
            )
            db.add(log)

    await db.commit()
    return {"plan_weeks": len(plan_weeks), "race_goal_id": race_goal.id}
