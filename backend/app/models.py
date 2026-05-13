from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from .database import Base


class StravaToken(Base):
    __tablename__ = "strava_tokens"

    id = Column(Integer, primary_key=True)
    athlete_id = Column(Integer, unique=True, nullable=False)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    expires_at = Column(Integer, nullable=False)
    athlete_data = Column(JSON)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True)
    strava_id = Column(Integer, unique=True, nullable=False)
    name = Column(String)
    sport_type = Column(String)
    start_date = Column(DateTime, nullable=False)
    distance = Column(Float)          # meters
    moving_time = Column(Integer)     # seconds
    elapsed_time = Column(Integer)    # seconds
    total_elevation_gain = Column(Float)
    average_speed = Column(Float)     # m/s
    max_speed = Column(Float)
    average_heartrate = Column(Float)
    max_heartrate = Column(Float)
    average_cadence = Column(Float)
    suffer_score = Column(Integer)
    workout_type = Column(Integer)    # Strava workout type code
    description = Column(Text)

    # Rich detail fields (fetched from Strava detail endpoint on demand)
    map_polyline = Column(Text)        # encoded polyline for route map
    splits_metric = Column(JSON)       # per-km splits from Strava
    calories = Column(Integer)
    elev_high = Column(Float)
    elev_low = Column(Float)
    start_latlng = Column(JSON)        # [lat, lng]
    detail_fetched = Column(Boolean, default=False)

    # Derived metrics (calculated by us)
    pace_per_km = Column(Float)       # seconds/km
    tss = Column(Float)               # Training Stress Score
    trimp = Column(Float)             # Training Impulse
    vdot = Column(Float)              # Jack Daniels VDOT from this effort

    created_at = Column(DateTime, server_default=func.now())


class DailyMetrics(Base):
    """Rolled-up daily fitness metrics (CTL, ATL, TSB)."""
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True)
    date = Column(DateTime, unique=True, nullable=False)
    ctl = Column(Float, default=0)    # Chronic Training Load (fitness)
    atl = Column(Float, default=0)    # Acute Training Load (fatigue)
    tsb = Column(Float, default=0)    # Training Stress Balance (form)
    daily_tss = Column(Float, default=0)
    weekly_distance = Column(Float, default=0)  # meters for week ending this day


class RaceGoal(Base):
    __tablename__ = "race_goals"

    id = Column(Integer, primary_key=True)
    race_type = Column(String, nullable=False)   # 5K, 10K, half_marathon, marathon
    race_date = Column(DateTime, nullable=True)
    goal_time = Column(Integer, nullable=True)   # seconds, optional
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True)
    race_goal_id = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=False)
    phase = Column(String)            # base, build, peak, taper
    start_date = Column(DateTime, nullable=False)
    target_weekly_distance = Column(Float)   # meters
    workouts = Column(JSON)           # list of workout dicts
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class WorkoutLog(Base):
    """Links planned workouts to completed activities."""
    __tablename__ = "workout_logs"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon, 6=Sun
    planned_workout = Column(JSON)
    activity_id = Column(Integer, nullable=True)   # FK to activities.id
    status = Column(String, default="pending")     # pending, completed, missed, skipped
    notes = Column(Text)
