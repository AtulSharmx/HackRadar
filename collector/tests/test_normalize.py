from datetime import datetime, timezone

from collector.normalize import (clean_city, find_indian_city, map_themes, parse_date, parse_mode,
                                 parse_money, strip_html)


def test_money_indian_formats():
    assert parse_money("₹1,00,000") == (100000, False)
    assert parse_money("1 lakh") == (100000, False)
    assert parse_money("Rs. 2.5 Lakhs") == (250000, False)
    assert parse_money("INR 1 crore") == (10_000_000, False)
    assert parse_money("₹ <span data-currency-value>50,000</span>") == (50000, False)


def test_money_usd_is_converted_and_approximate():
    amount, approx = parse_money("$<span data-currency-value>10,000</span>")
    assert approx is True and amount == 880_000


def test_money_missing():
    assert parse_money(None) == (None, False)
    assert parse_money("Goodies and swag") == (None, False)


def test_mode_words():
    assert parse_mode("In-Person") == "offline"
    assert parse_mode("on-site event") == "offline"
    assert parse_mode("Virtual") == "online"
    assert parse_mode("Hybrid (online + offline)") == "hybrid"
    assert parse_mode("") is None


def test_city_aliases():
    assert clean_city("Gurgaon") == "Gurugram"
    assert clean_city(" bangalore ") == "Bengaluru"
    assert clean_city("Delhi NCR") == "Delhi"
    assert clean_city("unnao") == "Unnao"
    assert clean_city("") is None
    assert find_indian_city("Tripura Vasini Palace Grounds, Bengaluru") == "Bengaluru"
    assert find_indian_city("Databricks Singapore") is None


def test_deadline_without_time_is_2359_ist():
    assert parse_date("Oct 23, 2026", deadline=True) == datetime(2026, 10, 23, 18, 29, tzinfo=timezone.utc)
    assert parse_date("2026-10-04T19:59:00+05:30") == datetime(2026, 10, 4, 14, 29, tzinfo=timezone.utc)
    assert parse_date("not a date") is None
    # Unstop's approved_date: "GMT+0530" is India time, not UTC-5:30 (dateutil's POSIX reading)
    assert parse_date("2026-09-28 22:35:36 GMT+0530") == datetime(2026, 9, 28, 17, 5, 36, tzinfo=timezone.utc)


def test_themes():
    assert map_themes("Machine Learning/AI", "IoT") == ["ai_ml", "iot_hardware"]
    assert map_themes("Data Structures and Algorithms") == ["other"]
    assert map_themes("Web3 builders") == ["blockchain"]


def test_strip_html_and_cut():
    assert strip_html("<p>Hi&amp; <b>there</b></p>") == "Hi& there"
    assert len(strip_html("x" * 500, 300)) == 300


def test_themes_v2_on_real_titles():
    from collector.normalize import classify_themes
    generic = ["Problem Solving", "Teamwork and Collaboration", "Software Development"]
    assert classify_themes("Winter Coding Contest 6.0", generic) == ["coding_contest"]
    assert classify_themes("Competitive Programming Hackathon", generic) == ["coding_contest"]
    assert classify_themes("HackForge 2026", ["Data Structures and Algorithms", "C++ Programming Language"]) == ["open_innovation"]
    assert classify_themes("CP Contest", ["Data Structures and Algorithms"]) == ["coding_contest"]
    assert classify_themes("Build and Break Hackathon", generic) == ["open_innovation"]
    assert classify_themes("Idea Competition 2026", generic) == ["open_innovation"]
    assert classify_themes("Respawn", ["Game Development"]) == ["other"]   # nothing fits: stays honest
    # live "other" titles, 12 Oct 2026
    assert classify_themes("Virtual: PromptWars", generic) == ["ai_ml"]
    assert classify_themes("Agentic Banking Hackathon", []) == ["ai_ml"]
    assert classify_themes("The Code Voyage: The Ultimate Coding Battle", generic) == ["coding_contest"]
    assert classify_themes("C Code Auction Arena 2026", generic) == ["coding_contest"]
    assert classify_themes("CodeBreaker", generic) == ["coding_contest"]
    assert classify_themes("National Machine Coding, LLD and Production Debugging Contest", generic) == ["coding_contest"]    # description counts only with an unambiguous phrase
    assert classify_themes("Zero Hour", generic, "Build solutions using machine learning models") == ["ai_ml"]
    assert classify_themes("Zero Hour", generic, "An AI-powered future awaits you") == ["other"]


def test_degrees_from_unstop_eligibility_tags():
    from collector.normalize import degrees_from_unstop as d
    assert d(["All"]) is None and d([]) is None                                   # anyone
    assert d(["School Students"]) == [] and d(["Experienced Professionals", "Fresher"]) == []
    assert d(["Engineering Students", "Undergraduate"]) == ["bca", "bsc", "btech", "other"]
    assert d(["Engineering Students", "Postgraduate"]) == ["mca", "mtech", "other"]
    assert d(["Management", "Law"]) == ["other"]                                  # not for tech degrees
    full = ["Arts, Commerce, Sciences & Others", "Engineering Students", "Law", "Management",
            "Medical", "Postgraduate", "Undergraduate"]
    assert d(full) == ["bca", "bsc", "btech", "mca", "mtech", "other"]
