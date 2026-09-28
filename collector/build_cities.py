"""One-time builder for shared/cities.json: coordinates come from OpenStreetMap Nominatim, not by hand.

Run with:  python -m collector.build_cities
Re-run only when adding cities. Respects Nominatim's 1 request/second limit.
"""
import json
import time
import unicodedata

import httpx

from . import config

# (name, state, aliases). Names are the spelling the app shows; aliases map old/alternate spellings.
CITIES = [
    ("Delhi", "Delhi", ["New Delhi", "Delhi NCR", "West Delhi", "South Delhi", "North Delhi", "East Delhi"]),
    ("Gurugram", "Haryana", ["Gurgaon"]), ("Faridabad", "Haryana", []), ("Sonipat", "Haryana", []),
    ("Panipat", "Haryana", []), ("Rohtak", "Haryana", []), ("Hisar", "Haryana", []),
    ("Kurukshetra", "Haryana", []), ("Ambala", "Haryana", []),
    ("Noida", "Uttar Pradesh", []), ("Greater Noida", "Uttar Pradesh", []), ("Ghaziabad", "Uttar Pradesh", []),
    ("Meerut", "Uttar Pradesh", []), ("Lucknow", "Uttar Pradesh", []), ("Kanpur", "Uttar Pradesh", []),
    ("Prayagraj", "Uttar Pradesh", ["Allahabad"]), ("Varanasi", "Uttar Pradesh", ["Banaras"]),
    ("Agra", "Uttar Pradesh", []), ("Mathura", "Uttar Pradesh", []), ("Aligarh", "Uttar Pradesh", []),
    ("Gorakhpur", "Uttar Pradesh", []), ("Bareilly", "Uttar Pradesh", []), ("Unnao", "Uttar Pradesh", []),
    ("Mumbai", "Maharashtra", ["Bombay"]), ("Navi Mumbai", "Maharashtra", []), ("Thane", "Maharashtra", []),
    ("Pune", "Maharashtra", ["Poona"]), ("Pimpri-Chinchwad", "Maharashtra", ["Pimpri Chinchwad"]),
    ("Nagpur", "Maharashtra", []), ("Nashik", "Maharashtra", []), ("Aurangabad", "Maharashtra", ["Chhatrapati Sambhajinagar"]),
    ("Kolhapur", "Maharashtra", []), ("Solapur", "Maharashtra", []), ("Amravati", "Maharashtra", []),
    ("Bengaluru", "Karnataka", ["Bangalore"]), ("Mysuru", "Karnataka", ["Mysore"]),
    ("Mangaluru", "Karnataka", ["Mangalore"]), ("Manipal", "Karnataka", []), ("Hubballi", "Karnataka", ["Hubli"]),
    ("Belagavi", "Karnataka", ["Belgaum"]),
    ("Chennai", "Tamil Nadu", ["Madras"]), ("Coimbatore", "Tamil Nadu", []), ("Madurai", "Tamil Nadu", []),
    ("Tiruchirappalli", "Tamil Nadu", ["Trichy"]), ("Vellore", "Tamil Nadu", []), ("Salem", "Tamil Nadu", []),
    ("Hyderabad", "Telangana", ["Secunderabad"]), ("Warangal", "Telangana", []),
    ("Visakhapatnam", "Andhra Pradesh", ["Vizag"]), ("Vijayawada", "Andhra Pradesh", []),
    ("Guntur", "Andhra Pradesh", []), ("Tirupati", "Andhra Pradesh", []),
    ("Kochi", "Kerala", ["Cochin"]), ("Thiruvananthapuram", "Kerala", ["Trivandrum"]),
    ("Kozhikode", "Kerala", ["Calicut"]), ("Thrissur", "Kerala", []),
    ("Kolkata", "West Bengal", ["Calcutta"]), ("Durgapur", "West Bengal", []), ("Siliguri", "West Bengal", []),
    ("Kharagpur", "West Bengal", []),
    ("Ahmedabad", "Gujarat", []), ("Gandhinagar", "Gujarat", []), ("Surat", "Gujarat", []),
    ("Vadodara", "Gujarat", ["Baroda"]), ("Rajkot", "Gujarat", []),
    ("Jaipur", "Rajasthan", []), ("Jodhpur", "Rajasthan", []), ("Udaipur", "Rajasthan", []),
    ("Kota", "Rajasthan", []), ("Ajmer", "Rajasthan", []), ("Bikaner", "Rajasthan", []),
    ("Indore", "Madhya Pradesh", []), ("Bhopal", "Madhya Pradesh", []), ("Gwalior", "Madhya Pradesh", []),
    ("Jabalpur", "Madhya Pradesh", []),
    ("Chandigarh", "Chandigarh", []), ("Mohali", "Punjab", ["SAS Nagar"]), ("Ludhiana", "Punjab", []),
    ("Amritsar", "Punjab", []), ("Jalandhar", "Punjab", []), ("Patiala", "Punjab", []), ("Phagwara", "Punjab", []),
    ("Dehradun", "Uttarakhand", []), ("Roorkee", "Uttarakhand", []), ("Haridwar", "Uttarakhand", []),
    ("Shimla", "Himachal Pradesh", []), ("Mandi", "Himachal Pradesh", []),
    ("Srinagar", "Jammu and Kashmir", []), ("Jammu", "Jammu and Kashmir", []),
    ("Patna", "Bihar", []), ("Gaya", "Bihar", []), ("Ranchi", "Jharkhand", []),
    ("Jamshedpur", "Jharkhand", []), ("Dhanbad", "Jharkhand", []),
    ("Bhubaneswar", "Odisha", []), ("Cuttack", "Odisha", []), ("Rourkela", "Odisha", []),
    ("Raipur", "Chhattisgarh", []), ("Bhilai", "Chhattisgarh", []),
    ("Guwahati", "Assam", []), ("Silchar", "Assam", []), ("Shillong", "Meghalaya", []),
    ("Imphal", "Manipur", []), ("Agartala", "Tripura", []), ("Aizawl", "Mizoram", []),
    ("Itanagar", "Arunachal Pradesh", []), ("Kohima", "Nagaland", []), ("Gangtok", "Sikkim", []),
    ("Panaji", "Goa", ["Goa", "Panjim"]), ("Puducherry", "Puducherry", ["Pondicherry"]),
]

NOMINATIM = "https://nominatim.openstreetmap.org/search"


def _ascii(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def main():
    out = []
    with httpx.Client(headers={"User-Agent": config.USER_AGENT}, timeout=20) as http:
        for name, state, aliases in CITIES:
            time.sleep(1.1)
            r = http.get(NOMINATIM, params={"city": name, "state": state, "country": "India",
                                            "format": "jsonv2", "limit": 1})
            r.raise_for_status()
            hits = r.json()
            # guard against same-named villages: the top hit must actually be this city
            first = _ascii(hits[0]["display_name"].split(",")[0]) if hits else ""
            if not hits or not any(_ascii(n) in first for n in [name, *aliases]):
                print(f"REJECTED: {name}, {state} -> {hits[0]['display_name'] if hits else 'no result'}")
                continue
            out.append({"name": name, "state": state, "aliases": aliases,
                        "lat": round(float(hits[0]["lat"]), 4), "lng": round(float(hits[0]["lon"]), 4)})
            print(f"{name}: {out[-1]['lat']}, {out[-1]['lng']}  ({hits[0]['display_name'][:60]})")
    (config.ROOT / "shared/cities.json").write_text(
        json.dumps({"source": "OpenStreetMap Nominatim, © OpenStreetMap contributors (ODbL)", "cities": out},
                   ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{len(out)} of {len(CITIES)} cities written")


if __name__ == "__main__":
    main()
