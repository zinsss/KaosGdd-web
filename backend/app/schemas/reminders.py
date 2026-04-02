def normalize_minutes(value, default=10):
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return default
    return minutes if minutes > 0 else default
