from backend.numeric import compare_numbers, compare_prices, first_number, parse_prices


def test_parse_month_with_billed_annually():
    (p,) = parse_prices("Pricing starts at $12/seat/month billed annually. Includes 24/7 support.")
    assert (p.amount, p.currency, p.period, p.per_month) == (12, "USD", "month", 12)


def test_parse_year_normalizes_per_month():
    (p,) = parse_prices("$100/year")
    assert p.period == "year" and abs(p.per_month - 8.3333) < 0.01


def test_no_currency_is_not_a_price():
    assert parse_prices("24/7 onboarding support, 3 seats") == []


def test_compare_prices():
    acme, rival = parse_prices("$8/user/mo")[0], parse_prices("$12/seat/month")[0]
    assert compare_prices(acme, rival)[0] == "win"
    assert compare_prices(rival, acme)[0] == "lose"
    assert compare_prices(acme, parse_prices("$96/year")[0])[0] == "tie"
    assert compare_prices(parse_prices("€8/month")[0], rival)[0] == "n/a"  # currency mismatch
    assert compare_prices(parse_prices("$99 one-time")[0], rival)[0] == "n/a"


def test_compare_numbers():
    assert compare_numbers(12, 10, higher_is_better=True)[0] == "win"
    assert compare_numbers(12, 10, higher_is_better=False)[0] == "lose"
    assert first_number("Battery: 12.5 hours") == 12.5
