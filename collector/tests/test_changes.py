from collector import changes

OLD = {"title": "X", "registration_deadline": "2026-10-10T18:29:00+00:00", "start_date": None,
       "venue_address": "Hall A", "city": "Pune", "mode": "offline", "fee_amount": 0, "prize_text": "₹10k"}


def test_same_value_different_timestamp_format_is_not_a_change():
    new = {**OLD, "registration_deadline": "2026-10-10T23:59:00+05:30"}   # same instant, IST form
    assert changes.fingerprint(OLD) == changes.fingerprint(new)
    assert changes.diff(OLD, new) is None


def test_deadline_change_is_detected():
    new = {**OLD, "registration_deadline": "2026-10-15T18:29:00+00:00"}
    assert changes.fingerprint(OLD) != changes.fingerprint(new)
    d = changes.diff(OLD, new)
    assert d["changed_fields"] == ["registration_deadline"]
    assert d["old_values"] == {"registration_deadline": OLD["registration_deadline"]}


def test_untracked_field_is_ignored():
    new = {**OLD, "title": "X renamed", "prize_text": "₹20k"}
    assert changes.fingerprint(OLD) == changes.fingerprint(new)
    assert changes.diff(OLD, new) is None


def test_several_fields():
    new = {**OLD, "city": "Mumbai", "venue_address": "Hall B", "fee_amount": 200}
    assert changes.diff(OLD, new)["changed_fields"] == ["venue_address", "city", "fee_amount"]
