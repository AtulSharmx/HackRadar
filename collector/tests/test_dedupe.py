from collector import dedupe as d

DL = "2026-10-10T18:29:00+00:00"


def row(title, city=None, mode="offline", org=None, dl=DL, url=None):
    return {"title": title, "city": city, "mode": mode, "organizer": org, "registration_deadline": dl,
            "registration_url": url or f"https://example.com/{abs(hash(title))}"}


# real pairs seen on Devpost + Unstop, 29 Sep 2026
MUST_MERGE = [
    (row("Hackyard Build 2026 | 24-Hour Hackathon at IIT Guwahati", "Guwahati"), row("Hackyard Build 2026", "Guwahati")),
    (row("Multimodal AI Hackathon 2026", mode="online"), row("Multimodal AI Hackathon 2026", mode="online")),
    (row("Kurukshetra CTF", mode="online"), row("Kurukshetra CTF", "Pimpri-Chinchwad", mode="hybrid")),
]
MUST_NOT_MERGE = [
    (row("CodeSprint by Elite Coders", mode="online"), row("DSAverse by Elite Her", mode="online")),
    (row("Junior Hackathon", "Delhi"), row("Junior Robo Sumo", "Delhi")),
    (row("TechFest Hackathon", "Delhi"), row("TechFest Hackathon", "Delhi", dl="2026-12-20T18:29:00+00:00")),
]
BORDERLINE = [   # kept separate, sent to review_queue
    (row("HackNova Winter Build", "Pune"), row("HackNova Build", "Mumbai")),
    (row("Smart Campus Ideathon"), row("Smart City Ideathon")),
]


def test_must_merge():
    for a, b in MUST_MERGE:
        assert d.score(a, b) >= d.MERGE_AT, (a["title"], b["title"], d.score(a, b))


def test_must_not_merge():
    for a, b in MUST_NOT_MERGE:
        assert d.score(a, b) < d.REVIEW_AT, (a["title"], b["title"], d.score(a, b))


def test_borderline_goes_to_review():
    for a, b in BORDERLINE:
        assert d.REVIEW_AT <= d.score(a, b) < d.MERGE_AT, (a["title"], b["title"], d.score(a, b))


def test_same_registration_url_merges_even_if_titles_differ():
    a = row("Totally different name", url="https://www.forms.gle/abc/?utm_source=insta")
    b = {"id": "e1", **row("Other title", url="https://forms.gle/abc")}
    match, s = d.best_match(a, [b])
    assert match["id"] == "e1" and s >= d.MERGE_AT


def test_clean_url():
    assert d.clean_url("HTTPS://WWW.Unstop.com/x/?utm_source=a&id=5#top") == "https://unstop.com/x?id=5"


def test_merge_prefers_detail_and_unions_themes():
    thin = {"title": "X Hack", "city": None, "fee_amount": None, "themes": ["other"], "prize_text": None}
    rich = {"title": "X Hack 2026", "city": "Pune", "fee_amount": 0, "themes": ["ai_ml"], "prize_text": "₹50,000"}
    stored = {"title": "old", "city": "Old City", "fee_amount": 100, "themes": ["web"], "prize_text": None}
    m = d.merge([thin, rich], stored)
    assert m["title"] == "X Hack 2026" and m["city"] == "Pune" and m["fee_amount"] == 0
    assert m["themes"] == ["ai_ml"]
    assert d.merge([thin], stored)["city"] == "Old City"   # a missing field never wipes a known one


def test_online_vs_offline_with_similar_titles_is_not_even_a_review():
    # real pair from 30 Sep: flagged at 84 before the mode penalty
    a = row("Grand Innovation Challenge", "Digdoh", mode="offline")
    b = row("Graphiques Innovation Challenge", None, mode="online")
    assert d.score(a, b) < d.REVIEW_AT


def test_same_name_and_deadline_merge_across_a_place_name_unless_both_organizers_are_known():
    unstop = {"title": "The Big Hack 2.0", "city": "Bengaluru", "mode": "offline", "organizer": "Acharya Institute",
              "registration_deadline": "2026-11-10T18:29:00+00:00"}
    devfolio = {"title": "The Big Hack 2.0", "city": "Soladevanahalli", "mode": "offline", "organizer": None,
                "registration_deadline": "2026-11-10T18:29:00+00:00"}
    assert d.score(unstop, devfolio) >= d.MERGE_AT
    other_host = {**devfolio, "city": "Mohali", "organizer": "Chandigarh University"}
    assert d.score(unstop, other_host) < d.MERGE_AT      # franchise events keep their own editions
