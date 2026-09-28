from collector import geocode


class FakeNominatim:
    def __init__(self, answers):
        self.answers, self.queries = answers, []

    def search(self, q):
        self.queries.append(q)
        return self.answers.get(q, [])


def hit(lat, lng, name="x", rank=30):
    return {"lat": str(lat), "lon": str(lng), "display_name": name, "place_rank": rank}


def test_haversine_delhi_to_gurugram_about_25km():
    assert 20 < geocode.haversine_km(28.6665, 77.217, 28.4646, 77.0299) < 30


def test_venue_found():
    nom = FakeNominatim({"Amity University, Gurugram, Haryana": [hit(28.316, 76.914)]})
    assert geocode.locate(nom, "Amity University", "Gurugram", "Haryana") == (28.316, 76.914, False)


def test_same_name_far_away_is_rejected_then_city_centre():
    # a "Sector 5" match in another state must not be used for a Gurugram event
    nom = FakeNominatim({"Sector 5, Gurugram, Haryana": [hit(19.0, 72.8)]})
    lat, lng, approx = geocode.locate(nom, "Sector 5", "Gurugram", "Haryana")
    assert approx and (lat, lng) == (28.4646, 77.0299)


def test_placeholder_venue_skips_lookup():
    nom = FakeNominatim({})
    assert geocode.locate(nom, "TBA", "Greater Noida", "Uttar Pradesh")[2] is True
    assert nom.queries == []


def test_venue_name_retry_before_giving_up():
    nom = FakeNominatim({"IIT ISM, Dhanbad": [hit(23.814, 86.441)]})
    assert geocode.locate(nom, "IIT ISM, Hirapur, Dhanbad", "Dhanbad", "Jharkhand")[:2] == (23.814, 86.441)
    assert len(nom.queries) == 2


def test_town_not_in_city_list_uses_state_check():
    nom = FakeNominatim({"Karjat, Maharashtra": [hit(18.91, 73.32, "Karjat, Raigad, Maharashtra, India", 16)]})
    assert geocode.locate(nom, "TBA", "Karjat", "Maharashtra") == (18.91, 73.32, True)


def test_brackets_removed_before_search():
    nom = FakeNominatim({"Delhi Technological University, Delhi, Delhi": [hit(28.75, 77.11)]})
    assert geocode.locate(nom, "Delhi Technological University (DTU)", "Delhi", "Delhi") == (28.75, 77.11, False)


def test_city_level_hit_is_approximate():
    nom = FakeNominatim({"Delhi, Delhi, Delhi": [hit(28.6665, 77.217, "Delhi, India", 16)]})
    assert geocode.locate(nom, "Delhi", "Delhi", "Delhi")[2] is True
