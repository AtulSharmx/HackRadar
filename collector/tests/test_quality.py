from datetime import datetime, timezone

from collector import quality

# Real open Unstop titles, 29 Sep 2026
MUST_EXCLUDE = {
    "Valorant Tournament – Battle Zone": "esports",
    "BGMI Tournament – Battle Zone": "esports",
    "National Young Programmers Olympiad": "quiz",
    "Poster Exhibition": "presentation",
    "Business Plan Competition – From Idea to Impact": "business",
    "Dohyo: Robo Sumo": "robot race",
    "Overdrive: Robo Race": "robot race",
    "Junior Robo Soccer": "robot race",
    "Line Follower (Autonomous Bot Time Trial)": "robot race",
    "Drone Race": "robot race",
    "UAV Competition": "robot race",
    "Bug Bounty": "bug bounty",   # kept until 24 Nov 2026; Plan P0 puts bug bounties out
    # Live Unstop and Hack2Skill lists, 24 Nov 2026 (Plan P0), plus a few made up for the edges
    "Mogoj Dholai (CP contest)": "coding contest",
    "CPP - Competitive Programming Potpourri": "coding contest",
    "CodeSprint coding contest": "coding contest",
    "Divergent Merch Design Challenge": "design",
    "Watch Face Design Challenge 2026": "design",
    "UI/UX Design Challenge 2026": "design",
    "Build with AI: Bootcamps": "bootcamp",
    "Ethical Hacking Bootcamp": "bootcamp",   # "Hacking" doesn't make it a hackathon
    "HackerRank Coding Contest": "coding contest",   # nor does "Hacker"
    "Builder Pop-Up": "meetup",
    "Meet the Builders 2026": "meetup",
    "Webinar: Getting Started with Google Gemini": "webinar",
    "MyOnne National Bug Bounty Challenge 2026": "bug bounty",
    "Tauras by Revat: Crypto Trading Hackathon | Prove Your Edge, Then Trade It Live": "trading",   # says Hackathon, still out
}
# Titles that look odd or carry misleading tags, but are real build/solve events: they must stay
MUST_KEEP = [
    "NASA Space Apps Challenge 2026", "Game Jam - TantraFiesta 2026", "Game Dev", "Pokerbots", "ReConCTF'26",
    "Red Team vs Blue Team", "Code Yudh - Battle of Codes", "Startupathon", "Algothon'26",
    "Vibeathon - AI Powered Development", "Deepfake ML Hackathon", "Hack-the-issue'26 Hackathon",
    "Conv_Cup '26: FIFA of Bots", "Qiskit Fall Fest", "Global Mesh AI & Swarm Robotics Challenge 2026",
    "Win $500: Get an Agent Passport?", "Math-O-Stellar", "Idea Competition 2026", "Digital Twin Challenge 2026",
    # 24 Nov 2026: "contest" or "challenge" alone keeps an event in, and so does a rule word next to a hackathon
    "Code for Good Hackathon", "India AI Open 2026: Free AI Talent Contest for Students and Engineers",
    "Ideathon: Idea to Prototyping Challenge", "Claude Build Challenge 2026", "Starlight Arena - AI Red Teaming Competition",
    "KITE Winter Innovation Expedition – National-Level Innovation Challenge", "Build with AI: PromptWars",
    "Merchant Innovation Challenge 2026", "AI Bootcamp & Hackathon 2026", "Pop-Up Hackathon @ Bengaluru",
    "Code Clash: Hackathons & Coding Contest", "Bug Bounty Hack Night", "PromptWars x AKI HACKS",
    "GenAI Bootcamp & Buildathon 2026", "Startup Pop-Up Ideathon", "HackSurgeX Webinar", "HackFest Bootcamp",
]


def test_non_hackathons_are_caught_with_the_right_reason():
    for title, reason in MUST_EXCLUDE.items():
        assert quality.not_hackathon_reason(title) == reason, title


def test_real_hackathons_are_never_excluded():
    for title in MUST_KEEP:
        assert quality.not_hackathon_reason(title) is None, title


NOW = datetime(2026, 9, 29, tzinfo=timezone.utc)


def test_registration_after_the_event_is_flagged_not_changed():
    row = {"registration_deadline": "2026-10-20T18:29:00+00:00", "end_date": "2026-10-10T18:29:00+00:00"}
    flags = quality.date_flags(row, NOW)
    assert [f["code"] for f in flags] == ["date_conflict"] and "after the event ends" in flags[0]["text"]
    assert row["registration_deadline"] == "2026-10-20T18:29:00+00:00"   # never rewritten


def test_deadline_years_away_is_flagged():
    assert "more than a year away" in quality.date_flags({"registration_deadline": "2028-01-01T00:00:00+00:00"}, NOW)[0]["text"]


def test_normal_dates_have_no_flags():
    row = {"registration_deadline": "2026-10-04T18:29:00+00:00", "start_date": "2026-10-09T04:00:00+00:00",
           "end_date": "2026-10-09T10:30:00+00:00"}
    assert quality.date_flags(row, NOW) == []
