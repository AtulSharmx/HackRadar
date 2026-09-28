from dataclasses import asdict, dataclass, field
from datetime import datetime

# fields used by the collector but not stored on the events row
SOURCE_ONLY = ("source", "source_event_id", "source_url", "in_india", "is_open")


@dataclass
class Event:
    """One parsed + normalized record from a source. Field names match the events table."""
    source: str
    source_event_id: str
    source_url: str
    title: str
    registration_url: str
    event_url: str | None = None
    organizer: str | None = None
    description_short: str | None = None
    mode: str | None = None              # online | offline | hybrid
    venue_address: str | None = None
    city: str | None = None
    state: str | None = None
    in_india: bool | None = None
    is_open: bool = True                 # source says registration is open
    registration_deadline: datetime | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    themes: list[str] = field(default_factory=list)
    team_min: int | None = None
    team_max: int | None = None
    solo_allowed: bool | None = None
    fee_amount: int | None = None        # INR; None = unknown, 0 = source said free
    prize_text: str | None = None
    prize_amount_inr: int | None = None
    prize_approximate: bool = False
    eligibility_text: str | None = None

    def to_row(self) -> dict:
        row = {k: v for k, v in asdict(self).items() if k not in SOURCE_ONLY}
        for k in ("registration_deadline", "start_date", "end_date"):
            if row[k] is not None:
                row[k] = row[k].isoformat()
        return row
