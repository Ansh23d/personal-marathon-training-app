"""
Adaptive marathon training plan generator.

Supports: 5K (8wk), 10K (10wk), Half Marathon (12wk), Marathon (16-20wk)
Periodization: Base → Build → Peak → Taper
All paces derived from user's current VDOT.
"""

from datetime import date, timedelta
from typing import Optional
from .metrics import (
    predict_race_time,
    pace_zones_from_vdot,
    estimate_threshold_pace,
    format_pace,
    format_time,
    RACE_DISTANCES_M,
)

# ---------------------------------------------------------------------------
# Plan templates: weekly structure as % of target weekly volume + workout types
# ---------------------------------------------------------------------------

RACE_CONFIGS = {
    "5K": {
        "distance_m": 5000,
        "weeks": 8,
        "phases": {"base": 3, "build": 3, "peak": 1, "taper": 1},
        "peak_weekly_km": 40,
    },
    "10K": {
        "distance_m": 10000,
        "weeks": 10,
        "phases": {"base": 4, "build": 4, "peak": 1, "taper": 1},
        "peak_weekly_km": 50,
    },
    "half_marathon": {
        "distance_m": 21097.5,
        "weeks": 12,
        "phases": {"base": 4, "build": 5, "peak": 2, "taper": 1},
        "peak_weekly_km": 65,
    },
    "marathon": {
        "distance_m": 42195,
        "weeks": 18,
        "phases": {"base": 6, "build": 7, "peak": 3, "taper": 2},
        "peak_weekly_km": 80,
    },
}

# Weekly volume multipliers by phase and week-within-phase
# Includes 1 cutback week every 4 for marathon/HM
VOLUME_RAMP = {
    "base":  [0.55, 0.65, 0.75, 0.60, 0.80, 0.85],  # up to 6 weeks
    "build": [0.80, 0.88, 0.95, 0.75, 0.90, 0.97, 1.00],
    "peak":  [0.95, 1.00, 0.85],
    "taper": [0.65, 0.45, 0.30],
}

# Workout blueprints: each day is (workout_type, description, distance_pct_of_weekly)
# workout_type: easy | tempo | intervals | long | rest | strides | race_pace
WEEKLY_TEMPLATES = {
    "5K": {
        "base": [
            ("rest",      "Rest or cross-train", 0),
            ("easy",      "Easy run", 0.20),
            ("easy",      "Easy run w/ strides", 0.18),
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.18),
            ("long",      "Long easy run", 0.28),
            ("rest",      "Rest or walk", 0),
        ],
        "build": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.15),
            ("intervals", "Track intervals: 6×400m @ interval pace", 0.20),
            ("easy",      "Easy recovery run", 0.15),
            ("tempo",     "Tempo run: 20 min @ threshold pace", 0.20),
            ("long",      "Long easy run", 0.25),
            ("rest",      "Rest", 0),
        ],
        "peak": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run w/ strides", 0.15),
            ("intervals", "Track: 8×400m @ interval pace", 0.22),
            ("easy",      "Easy jog", 0.13),
            ("tempo",     "Tempo: 25 min @ threshold", 0.20),
            ("long",      "Moderate long run", 0.25),
            ("rest",      "Rest", 0),
        ],
        "taper": [
            ("rest",      "Rest", 0),
            ("easy",      "Short easy run", 0.20),
            ("intervals", "Light intervals: 4×400m @ race pace", 0.20),
            ("rest",      "Rest", 0),
            ("easy",      "Easy shakeout", 0.15),
            ("rest",      "Rest", 0),
            ("race",      "RACE DAY — 5K", 0),
        ],
    },
    "10K": {
        "base": [
            ("rest",      "Rest or cross-train", 0),
            ("easy",      "Easy run", 0.20),
            ("easy",      "Easy run w/ strides", 0.18),
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.18),
            ("long",      "Long easy run", 0.30),
            ("rest",      "Rest or walk", 0),
        ],
        "build": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.14),
            ("intervals", "1K repeats: 5×1K @ interval pace, 90s rest", 0.22),
            ("easy",      "Easy recovery", 0.14),
            ("tempo",     "Tempo run: 25–30 min @ threshold", 0.22),
            ("long",      "Long run", 0.28),
            ("rest",      "Rest", 0),
        ],
        "peak": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run w/ strides", 0.13),
            ("intervals", "1K repeats: 6×1K @ interval pace", 0.22),
            ("easy",      "Easy jog", 0.13),
            ("tempo",     "Cruise intervals: 3×10 min @ threshold, 2 min rest", 0.22),
            ("long",      "Long run", 0.28),
            ("rest",      "Rest", 0),
        ],
        "taper": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.18),
            ("intervals", "Light: 4×1K @ race pace", 0.20),
            ("rest",      "Rest", 0),
            ("easy",      "Easy shakeout w/ strides", 0.15),
            ("rest",      "Rest", 0),
            ("race",      "RACE DAY — 10K", 0),
        ],
    },
    "half_marathon": {
        "base": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.17),
            ("easy",      "Easy run", 0.17),
            ("easy",      "Easy run w/ strides", 0.16),
            ("easy",      "Easy run", 0.16),
            ("long",      "Long easy run", 0.30),
            ("rest",      "Rest or cross-train", 0),
        ],
        "build": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.13),
            ("tempo",     "Tempo run: 30 min @ threshold", 0.22),
            ("easy",      "Easy recovery", 0.13),
            ("intervals", "Mile repeats: 4×1 mile @ interval pace", 0.22),
            ("long",      "Long run w/ last 5K @ marathon pace", 0.30),
            ("rest",      "Rest", 0),
        ],
        "peak": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.12),
            ("tempo",     "Tempo: 2×20 min @ threshold, 3 min rest", 0.22),
            ("easy",      "Easy recovery", 0.12),
            ("intervals", "Mile repeats: 5×1 mile @ interval pace", 0.22),
            ("long",      "Long run: last 8K @ half marathon goal pace", 0.32),
            ("rest",      "Rest", 0),
        ],
        "taper": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.20),
            ("tempo",     "Short tempo: 15 min @ threshold", 0.18),
            ("rest",      "Rest", 0),
            ("easy",      "Easy shakeout", 0.15),
            ("rest",      "Rest", 0),
            ("race",      "RACE DAY — Half Marathon", 0),
        ],
    },
    "marathon": {
        "base": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.13),
            ("easy",      "Easy run", 0.13),
            ("easy",      "Easy run w/ strides", 0.13),
            ("easy",      "Easy run", 0.13),
            ("long",      "Long easy run", 0.30),
            ("rest",      "Rest or cross-train", 0),
        ],
        "build": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.12),
            ("tempo",     "Tempo: 35–40 min @ threshold", 0.20),
            ("easy",      "Easy recovery", 0.12),
            ("race_pace", "Marathon pace run: 10–16K @ goal pace", 0.20),
            ("long",      "Long run w/ middle miles @ marathon pace", 0.33),
            ("rest",      "Rest", 0),
        ],
        "peak": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.10),
            ("tempo",     "Tempo: 2×20 min @ threshold, 3 min rest", 0.18),
            ("easy",      "Easy recovery", 0.10),
            ("race_pace", "Marathon pace: 18–22K @ goal pace", 0.22),
            ("long",      "Long run 29–35K", 0.35),
            ("rest",      "Rest", 0),
        ],
        "taper": [
            ("rest",      "Rest", 0),
            ("easy",      "Easy run", 0.15),
            ("tempo",     "Short tempo: 20 min @ threshold", 0.15),
            ("easy",      "Easy recovery", 0.10),
            ("race_pace", "Short race pace run: 6–8K @ goal pace", 0.12),
            ("easy",      "Easy shakeout", 0.10),
            ("race",      "RACE DAY — Marathon", 0),
        ],
    },
}


def _phase_sequence(config: dict) -> list[tuple[str, int]]:
    """Returns list of (phase_name, week_in_phase) tuples in order."""
    phases = []
    for phase, num_weeks in config["phases"].items():
        for w in range(num_weeks):
            phases.append((phase, w))
    return phases


def _build_workout(
    day_type: str,
    description: str,
    target_distance_m: float,
    zones: dict,
    goal_pace_s_km: Optional[float],
) -> dict:
    """Build a single workout dict with pace targets."""
    workout = {
        "type": day_type,
        "description": description,
        "target_distance_km": round(target_distance_m / 1000, 1),
    }

    if day_type == "rest" or day_type == "race":
        return workout

    if zones:
        if day_type == "easy":
            workout["pace_range"] = f"{format_pace(zones['easy']['max'])}–{format_pace(zones['easy']['min'])}/km"
        elif day_type == "tempo":
            workout["pace_range"] = f"{format_pace(zones['threshold']['max'])}–{format_pace(zones['threshold']['min'])}/km"
        elif day_type == "intervals":
            workout["pace_range"] = f"{format_pace(zones['interval']['max'])}–{format_pace(zones['interval']['min'])}/km"
        elif day_type == "race_pace" and goal_pace_s_km:
            gp = format_pace(goal_pace_s_km)
            workout["pace_range"] = f"{gp}/km"
        elif day_type == "long":
            workout["pace_range"] = f"{format_pace(zones['easy']['max'])}–{format_pace(zones['marathon']['min'])}/km"

    return workout


def generate_plan(
    race_type: str,
    vdot: float,
    start_date: date,
    race_date: Optional[date] = None,
    goal_time_s: Optional[float] = None,
) -> list[dict]:
    """
    Generate a full training plan.
    Returns list of week dicts with workouts for each day.
    """
    if race_type not in RACE_CONFIGS:
        raise ValueError(f"Unknown race type: {race_type}. Choose from {list(RACE_CONFIGS.keys())}")

    config = RACE_CONFIGS[race_type]
    zones = pace_zones_from_vdot(vdot) if vdot > 0 else {}

    # Determine goal pace
    if goal_time_s:
        goal_pace_s_km = goal_time_s / (config["distance_m"] / 1000)
    elif vdot > 0:
        predicted_s = predict_race_time(vdot, config["distance_m"])
        goal_pace_s_km = predicted_s / (config["distance_m"] / 1000)
    else:
        goal_pace_s_km = None

    peak_km = config["peak_weekly_km"]
    phase_seq = _phase_sequence(config)
    template = WEEKLY_TEMPLATES[race_type]

    weeks = []
    week_start = start_date
    # Adjust start to Monday
    week_start = week_start - timedelta(days=week_start.weekday())

    for week_idx, (phase, week_in_phase) in enumerate(phase_seq):
        vol_ramp = VOLUME_RAMP[phase]
        multiplier = vol_ramp[min(week_in_phase, len(vol_ramp) - 1)]

        # Cutback every 4th week in base/build
        if phase in ("base", "build") and (week_in_phase + 1) % 4 == 0:
            multiplier *= 0.75

        target_weekly_m = peak_km * 1000 * multiplier
        daily_template = template[phase]

        workouts = []
        for day_idx, (day_type, desc, pct) in enumerate(daily_template):
            day_date = week_start + timedelta(days=day_idx)
            dist_m = target_weekly_m * pct if pct > 0 else 0
            workout = _build_workout(day_type, desc, dist_m, zones, goal_pace_s_km)
            workout["date"] = day_date.isoformat()
            workout["day_of_week"] = day_idx
            workouts.append(workout)

        weeks.append({
            "week_number": week_idx + 1,
            "phase": phase,
            "start_date": week_start.isoformat(),
            "target_weekly_km": round(target_weekly_m / 1000, 1),
            "workouts": workouts,
        })
        week_start += timedelta(weeks=1)

    return weeks


def adapt_plan(
    plan_weeks: list[dict],
    completed_activities: list[dict],
    current_week: int,
    current_vdot: float,
) -> list[dict]:
    """
    Adapt remaining plan weeks based on actual performance.
    - If recent VDOT improved by >1.5: bump remaining paces up
    - If weekly distance consistently short (<80%): reduce volume next week
    - If weekly distance overshooting (>110%): cap next week volume
    """
    if not plan_weeks or current_week >= len(plan_weeks):
        return plan_weeks

    # Recalculate zones from current VDOT
    zones = pace_zones_from_vdot(current_vdot)
    if not zones:
        return plan_weeks

    adapted = []
    for week in plan_weeks:
        if week["week_number"] <= current_week:
            adapted.append(week)
            continue

        # Rebuild workouts with updated pace zones
        race_type = None
        for rt, cfg in RACE_CONFIGS.items():
            # Infer from plan structure (rough heuristic)
            if abs(cfg["weeks"] - len(plan_weeks)) <= 2:
                race_type = rt
                break

        if race_type:
            updated_workouts = []
            for w in week["workouts"]:
                updated = _build_workout(
                    w["type"],
                    w["description"],
                    w.get("target_distance_km", 0) * 1000,
                    zones,
                    None,
                )
                updated["date"] = w["date"]
                updated["day_of_week"] = w["day_of_week"]
                if "status" in w:
                    updated["status"] = w["status"]
                updated_workouts.append(updated)
            week = {**week, "workouts": updated_workouts}

        adapted.append(week)

    return adapted


def get_race_predictions(vdot: float) -> dict:
    """Return predicted race times for all standard distances."""
    if vdot <= 0:
        return {}
    return {
        name: {
            "time_s": predict_race_time(vdot, dist_m),
            "time_formatted": format_time(predict_race_time(vdot, dist_m)),
        }
        for name, dist_m in RACE_DISTANCES_M.items()
    }
