"""Unit tests for the tracking maths and ping validation.

Pure functions only - no database, no Redis. The ping *path* is integration-shaped and needs
a live Redis; what is worth pinning down here is the arithmetic a customer reads off the
screen and the rules that decide which pings are allowed to reach them at all.
"""

import pytest

from app.core.config import settings
from app.services import tracking_service


def test_haversine_matches_known_baku_distance():
    # Fountain Square to the Flame Towers, ~2.1 km apart.
    metres = tracking_service.haversine_m(40.37200, 49.83500, 40.35900, 49.83300)
    assert 1300 < metres < 1600


def test_haversine_is_zero_for_the_same_point():
    assert tracking_service.haversine_m(40.4, 49.8, 40.4, 49.8) == pytest.approx(0, abs=0.01)


def test_eta_is_a_range_not_a_point():
    low, high = tracking_service.eta_range_seconds(3000, 8.0)
    assert low < high


def test_eta_falls_back_to_city_average_when_stopped():
    """A courier at a red light reads 0 m/s; using it directly would give an infinite ETA."""
    stopped = tracking_service.eta_range_seconds(3000, 0.0)
    moving = tracking_service.eta_range_seconds(3000, settings.tracking_avg_speed_mps)
    assert stopped == moving


def test_eta_never_promises_under_a_minute():
    low, high = tracking_service.eta_range_seconds(5, 10.0)
    assert low >= 60
    assert high >= 120


def test_validate_rejects_a_low_accuracy_fix():
    with pytest.raises(tracking_service.PingRejected):
        tracking_service.validate(settings.tracking_ping_max_accuracy_m + 1, 5.0)


def test_validate_rejects_a_gps_jump():
    with pytest.raises(tracking_service.PingRejected):
        tracking_service.validate(10.0, settings.tracking_ping_max_speed_mps + 1)


def test_validate_accepts_a_normal_ping_and_missing_fields():
    tracking_service.validate(12.0, 7.5)
    # Android frequently reports no speed or no accuracy at all; that is not a bad ping.
    tracking_service.validate(None, None)


def test_channel_is_per_order():
    """The authorisation boundary: one order's subscribers can only ever be sent that order."""
    assert tracking_service.channel("a") != tracking_service.channel("b")
