from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .database import AsyncSessionLocal
from .strava import sync_activities
from .services import recalculate_all_metrics

scheduler = AsyncIOScheduler()


async def _daily_sync_job():
    async with AsyncSessionLocal() as db:
        new_count = await sync_activities(db)
        if new_count > 0:
            await recalculate_all_metrics(db)
        print(f"[Scheduler] Daily sync complete — {new_count} new activities")


def start_scheduler():
    scheduler.add_job(_daily_sync_job, "cron", hour=4, minute=0, id="daily_strava_sync")
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()
