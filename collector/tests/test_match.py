import json
from datetime import datetime
from pathlib import Path

import pytest

from collector import match

SPEC = json.loads((Path(__file__).parents[2] / "shared/match_cases.json").read_text(encoding="utf-8"))
NOW = datetime.fromisoformat(SPEC["now"])


def device_for(case):
    return {**SPEC["device"], **case.get("device", {})}


@pytest.mark.parametrize("case", SPEC["cases"], ids=[c["name"] for c in SPEC["cases"]])
def test_shared_case(case):
    dev, ev = device_for(case), case["event"]
    assert match.matches(ev, dev, NOW) is case["expect"]["matches"]
    assert match.score(ev, dev, NOW)[0] == case["expect"]["score"], case["expect"]["why"]


def test_reasons_read_like_a_person_wrote_them():
    case = SPEC["cases"][1]   # DTU Delhi
    dev, ev = device_for(case), {**case["event"], "location_approximate": False}
    _, parts = match.score(ev, dev, NOW)
    assert match.reasons(ev, dev, parts, NOW) == ["Matches Cybersecurity", "about 33 km away"]



def test_reasons_put_theme_first_on_a_tie():
    case = SPEC["cases"][0]   # everything full marks
    dev, ev = device_for(case), case["event"]
    _, parts = match.score(ev, dev, NOW)
    assert match.reasons(ev, dev, parts, NOW) == ["Matches AI/ML", "Online"]
