import time
from datetime import datetime, timezone
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import StravaToken, Activity
from .config import settings

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"

SCOPES = "activity:read_all"


def get_auth_url() -> str:
    return (
        f"{STRAVA_AUTH_URL}"
        f"?client_id={settings.strava_client_id}"
        f"&redirect_uri={settings.strava_redirect_uri}"
        f"&response_type=code"
        f"&scope={SCOPES}"
        f"&approval_prompt=auto"
    )


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(STRAVA_TOKEN_URL, data={
            "client_id": settings.strava_client_id,
            "client_secret": settings.strava_client_secret,
            "code": code,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(STRAVA_TOKEN_URL, data={
            "client_id": settings.strava_client_id,
            "client_secret": settings.strava_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        })
        resp.raise_for_status()
        return resp.json()


async def get_valid_token(db: AsyncSession) -> str | None:
    result = await db.execute(select(StravaToken).limit(1))
    token_row = result.scalar_one_or_none()
    if not token_row:
        return None

    if int(time.time()) >= token_row.expires_at - 300:
        data = await refresh_access_token(token_row.refresh_token)
        token_row.access_token = data["access_token"]
        token_row.refresh_token = data["refresh_token"]
        token_row.expires_at = data["expires_at"]
        await db.commit()

    return token_row.access_token


async def fetch_activities(access_token: str, after: int | None = None, per_page: int = 100) -> list[dict]:
    """Fetch all running activities from Strava, paginated."""
    activities = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            params = {"per_page": per_page, "page": page}
            if after:
                params["after"] = after
            resp = await client.get(
                f"{STRAVA_API_BASE}/athlete/activities",
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            # Keep only running activities
            running = [a for a in batch if a.get("sport_type") in ("Run", "TrailRun", "VirtualRun")]
            activities.extend(running)
            if len(batch) < per_page:
                break
            page += 1
    return activities


def _parse_activity(raw: dict) -> dict:
    start_date = datetime.fromisoformat(raw["start_date"].replace("Z", "+00:00"))
    distance = raw.get("distance", 0)
    moving_time = raw.get("moving_time", 0)
    avg_speed = raw.get("average_speed", 0)
    pace_per_km = (1000 / avg_speed) if avg_speed > 0 else None

    # Summary polyline is included in the activities list response
    map_data = raw.get("map") or {}
    polyline = map_data.get("summary_polyline") or None

    return {
        "strava_id": raw["id"],
        "name": raw.get("name"),
        "sport_type": raw.get("sport_type"),
        "start_date": start_date,
        "distance": distance,
        "moving_time": moving_time,
        "elapsed_time": raw.get("elapsed_time"),
        "total_elevation_gain": raw.get("total_elevation_gain"),
        "average_speed": avg_speed,
        "max_speed": raw.get("max_speed"),
        "average_heartrate": raw.get("average_heartrate"),
        "max_heartrate": raw.get("max_heartrate"),
        "average_cadence": raw.get("average_cadence"),
        "suffer_score": raw.get("suffer_score"),
        "workout_type": raw.get("workout_type"),
        "description": raw.get("description"),
        "pace_per_km": pace_per_km,
        "map_polyline": polyline,
        "start_latlng": raw.get("start_latlng"),
        "elev_high": raw.get("elev_high"),
        "elev_low": raw.get("elev_low"),
    }


async def fetch_activity_detail(access_token: str, strava_id: int) -> dict:
    """Fetch full activity detail from Strava (includes splits, laps, calories)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{STRAVA_API_BASE}/activities/{strava_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def ensure_activity_detail(db: AsyncSession, activity: Activity) -> Activity:
    """
    Fetch and cache the full Strava detail for an activity if not already done.
    Populates splits_metric, calories, and the full-resolution polyline.
    """
    if activity.detail_fetched:
        return activity

    access_token = await get_valid_token(db)
    if not access_token:
        return activity

    raw = await fetch_activity_detail(access_token, activity.strava_id)

    # Prefer full polyline from detail over summary polyline
    map_data = raw.get("map") or {}
    full_polyline = map_data.get("polyline") or map_data.get("summary_polyline")
    if full_polyline:
        activity.map_polyline = full_polyline

    activity.splits_metric = raw.get("splits_metric")
    activity.calories = raw.get("calories") or raw.get("kilojoules")
    activity.elev_high = raw.get("elev_high") or activity.elev_high
    activity.elev_low = raw.get("elev_low") or activity.elev_low
    activity.detail_fetched = True

    await db.commit()
    return activity


async def sync_activities(db: AsyncSession) -> int:
    """Sync new activities from Strava. Returns count of new activities added."""
    access_token = await get_valid_token(db)
    if not access_token:
        return 0

    # Find most recent activity to only fetch newer ones
    from sqlalchemy import func as sqlfunc
    result = await db.execute(
        select(sqlfunc.max(Activity.start_date))
    )
    latest = result.scalar_one_or_none()
    after = int(latest.replace(tzinfo=timezone.utc).timestamp()) if latest else None

    raw_activities = await fetch_activities(access_token, after=after)

    new_count = 0
    for raw in raw_activities:
        existing = await db.execute(
            select(Activity).where(Activity.strava_id == raw["id"])
        )
        if existing.scalar_one_or_none():
            continue

        parsed = _parse_activity(raw)
        activity = Activity(**parsed)
        db.add(activity)
        new_count += 1

    await db.commit()
    return new_count
