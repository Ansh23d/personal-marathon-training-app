"""
Custom fitness metrics calculated from raw Strava activity data.

Implements:
- VDOT  (Jack Daniels' running formula)
- TSS   (Training Stress Score, pace-based)
- TRIMP (Training Impulse, HR-based when available)
- CTL   (Chronic Training Load / Fitness, 42-day EMA)
- ATL   (Acute Training Load / Fatigue, 7-day EMA)
- TSB   (Training Stress Balance / Form = CTL - ATL)
- Pace zones derived from threshold pace
- Race time predictions across distances
"""

import math
from datetime import date, timedelta
from typing import Optional


# ---------------------------------------------------------------------------
# VDOT — Jack Daniels' running formula
# ---------------------------------------------------------------------------

RACE_DISTANCES_M = {
    "1500m": 1500,
    "1_mile": 1609.34,
    "3000m": 3000,
    "5K": 5000,
    "10K": 10000,
    "15K": 15000,
    "half_marathon": 21097.5,
    "marathon": 42195,
}


def _velocity_from_vdot(vdot: float) -> float:
    """Returns velocity in m/min that corresponds to 100% VO2max for given VDOT."""
    # Iterative solver: VO2(v) = VDOT, where VO2(v) = -4.60 + 0.182258*v + 0.000104*v^2
    # Quadratic: 0.000104v^2 + 0.182258v - (4.60 + vdot) = 0
    a, b, c = 0.000104, 0.182258, -(4.60 + vdot)
    return (-b + math.sqrt(b**2 - 4 * a * c)) / (2 * a)


def _percent_vo2max_at_time(t_minutes: float) -> float:
    """Fraction of VO2max sustainable for t minutes (Daniels & Gilbert 1979)."""
    if t_minutes < 3:
        return 1.0
    # Percent VO2max = 0.8 + 0.1894393*e^(-0.012778*t) + 0.2989558*e^(-0.1932605*t)
    return (
        0.8
        + 0.1894393 * math.exp(-0.012778 * t_minutes)
        + 0.2989558 * math.exp(-0.1932605 * t_minutes)
    )


def _vo2_at_velocity(v_m_per_min: float) -> float:
    """VO2 (ml/kg/min) at velocity v (m/min)."""
    return -4.60 + 0.182258 * v_m_per_min + 0.000104 * v_m_per_min**2


def vdot_from_race(distance_m: float, time_seconds: float) -> float:
    """Calculate VDOT from a race performance."""
    if time_seconds <= 0 or distance_m <= 0:
        return 0.0
    t_min = time_seconds / 60.0
    v = distance_m / t_min  # m/min
    vo2 = _vo2_at_velocity(v)
    pct = _percent_vo2max_at_time(t_min)
    if pct <= 0:
        return 0.0
    return vo2 / pct


def predict_race_time(vdot: float, distance_m: float) -> float:
    """Predict finish time in seconds for a given distance from VDOT."""
    if vdot <= 0:
        return 0.0
    # Binary search on time
    lo, hi = 60.0, 36000.0  # 1 min to 10 hours
    for _ in range(60):
        mid = (lo + hi) / 2
        t_min = mid / 60.0
        v = distance_m / t_min
        vo2 = _vo2_at_velocity(v)
        pct = _percent_vo2max_at_time(t_min)
        estimated_vdot = vo2 / pct if pct > 0 else 0
        if estimated_vdot > vdot:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def pace_zones_from_vdot(vdot: float) -> dict:
    """
    Return pace zones (seconds/km) from VDOT.
    Zones based on Jack Daniels' training intensities.
    """
    if vdot <= 0:
        return {}

    # Threshold pace: ~88% VO2max, sustainable ~60 min
    # Easy: 59-74% VO2max; Marathon: 75-84%; Threshold: 83-88%
    # Interval: 95-100%; Repetition: 105-120%

    def pace_at_pct(pct_vo2max: float) -> float:
        """Return pace in sec/km at a given % of VO2max."""
        target_vo2 = vdot * pct_vo2max
        # Solve: -4.60 + 0.182258*v + 0.000104*v^2 = target_vo2
        a, b, c = 0.000104, 0.182258, -(4.60 + target_vo2)
        disc = b**2 - 4 * a * c
        if disc < 0:
            return 0.0
        v_m_per_min = (-b + math.sqrt(disc)) / (2 * a)
        if v_m_per_min <= 0:
            return 0.0
        return 1000 / v_m_per_min * 60  # sec/km

    return {
        "easy":      {"min": pace_at_pct(0.59), "max": pace_at_pct(0.74)},
        "marathon":  {"min": pace_at_pct(0.75), "max": pace_at_pct(0.84)},
        "threshold": {"min": pace_at_pct(0.83), "max": pace_at_pct(0.88)},
        "interval":  {"min": pace_at_pct(0.95), "max": pace_at_pct(1.00)},
        "repetition":{"min": pace_at_pct(1.05), "max": pace_at_pct(1.15)},
    }


# ---------------------------------------------------------------------------
# TSS — Training Stress Score (pace-based)
# ---------------------------------------------------------------------------

def tss_from_activity(
    distance_m: float,
    moving_time_s: float,
    threshold_pace_s_per_km: float,
) -> float:
    """
    Pace-based TSS (no power meter required).
    Uses normalised graded pace if elevation data present (simplified here).
    TSS = (duration_h * IF^2) * 100
    IF = threshold_pace / actual_pace  (inverted because lower pace = faster)
    """
    if distance_m <= 0 or moving_time_s <= 0 or threshold_pace_s_per_km <= 0:
        return 0.0

    actual_pace = (moving_time_s / distance_m) * 1000  # s/km
    intensity_factor = threshold_pace_s_per_km / actual_pace  # >1 = faster than threshold
    duration_h = moving_time_s / 3600
    return duration_h * (intensity_factor**2) * 100


def trimp_from_activity(
    moving_time_s: float,
    avg_hr: Optional[float],
    max_hr: float = 190,
    resting_hr: float = 50,
) -> float:
    """
    TRIMP (Banister 1991) — HR-based training impulse.
    Falls back to duration-only estimate when HR unavailable.
    """
    if moving_time_s <= 0:
        return 0.0
    duration_min = moving_time_s / 60

    if avg_hr and avg_hr > 0 and max_hr > resting_hr:
        hr_ratio = (avg_hr - resting_hr) / (max_hr - resting_hr)
        hr_ratio = max(0.0, min(1.0, hr_ratio))
        # Banister's sex-specific constant: 1.92 for male (standard default)
        return duration_min * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
    else:
        # No HR: rough estimate — 1 TRIMP/minute of easy running
        return duration_min * 0.8


# ---------------------------------------------------------------------------
# CTL / ATL / TSB (Performance Management Chart)
# ---------------------------------------------------------------------------

CTL_DAYS = 42  # chronic load time constant
ATL_DAYS = 7   # acute load time constant

CTL_FACTOR = 1 - math.exp(-1 / CTL_DAYS)
ATL_FACTOR = 1 - math.exp(-1 / ATL_DAYS)


def compute_pmc(daily_tss: dict[date, float]) -> list[dict]:
    """
    Compute the Performance Management Chart from a dict of {date: tss}.
    Returns list of {date, ctl, atl, tsb, daily_tss} sorted by date.
    """
    if not daily_tss:
        return []

    start = min(daily_tss.keys())
    end = max(daily_tss.keys())

    ctl, atl = 0.0, 0.0
    results = []
    current = start

    while current <= end:
        tss = daily_tss.get(current, 0.0)
        ctl = ctl + CTL_FACTOR * (tss - ctl)
        atl = atl + ATL_FACTOR * (tss - atl)
        tsb = ctl - atl
        results.append({
            "date": current,
            "ctl": round(ctl, 2),
            "atl": round(atl, 2),
            "tsb": round(tsb, 2),
            "daily_tss": round(tss, 2),
        })
        current += timedelta(days=1)

    return results


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def format_pace(seconds_per_km: float) -> str:
    """Format pace as MM:SS/km string."""
    if not seconds_per_km or seconds_per_km <= 0:
        return "--:--"
    m = int(seconds_per_km // 60)
    s = int(seconds_per_km % 60)
    return f"{m}:{s:02d}"


def format_time(seconds: float) -> str:
    """Format seconds as H:MM:SS or M:SS."""
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def estimate_threshold_pace(vdot: float) -> float:
    """Return threshold pace in sec/km from VDOT."""
    zones = pace_zones_from_vdot(vdot)
    if not zones:
        return 300.0  # 5:00/km default
    t = zones["threshold"]
    return (t["min"] + t["max"]) / 2
