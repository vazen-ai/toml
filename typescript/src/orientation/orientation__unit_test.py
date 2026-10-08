"""Unit tests for orientation conversion functions.

Tests verify the mappings match the Overview Table in README.md.
"""

import pytest

from .orientation import (
    Orientation,
    PsaOrientation,
    orientation_from_psa_integer,
    orientation_from_psa_orientation,
    psa_orientation_from_psa_integer,
)

# Overview Table from README.md - the authoritative source
# fmt: off
OVERVIEW_TABLE: list[tuple[int, PsaOrientation, Orientation]] = [
    # (JDA integer, JDA Name, Vazen Name)
    ( 0, "Front",     "F"),
    ( 1, "Front90",   "Fr"),
    ( 2, "Side",      "L"),
    ( 3, "Side90",    "Lr"),
    ( 4, "Top",       "U"),
    ( 5, "Top90",     "Ur"),
    ( 6, "Back",      "B"),
    ( 7, "Back90",    "Br"),
    ( 8, "Right",     "R"),
    ( 9, "Right90",   "Rr"),
    (10, "Base",      "D"),
    (11, "Base90",    "Dr"),
    (12, "Front180",  "Fu"),
    (13, "Front270",  "Fl"),
    (14, "Side180",   "Lu"),
    (15, "Side270",   "Ll"),
    (16, "Top180",    "Uu"),
    (17, "Top270",    "Ul"),
    (18, "Back180",   "Bu"),
    (19, "Back270",   "Bl"),
    (20, "Right180",  "Ru"),
    (21, "Right270",  "Rl"),
    (22, "Base180",   "Du"),
    (23, "Base270",   "Dl"),
]
# fmt: on


class TestPsaOrientationFromPsaInteger:
    """Tests for psa_orientation_from_psa_integer function."""

    @pytest.mark.parametrize(
        ("psa_integer", "expected_psa_orientation", "_vazen"),
        OVERVIEW_TABLE,
        ids=[f"int_{i}" for i, _, _ in OVERVIEW_TABLE],
    )
    def test_all_valid_integers_match_overview_table(
        self, psa_integer: int, expected_psa_orientation: PsaOrientation, _vazen: str
    ):
        """Verify all PSA integers map to correct PSA orientation names."""
        assert psa_orientation_from_psa_integer(psa_integer) == expected_psa_orientation

    def test_default_orientation_for_negative_one(self):
        """PSA integer -1 represents a missing/default value."""
        assert psa_orientation_from_psa_integer(-1) == "Default"

    def test_accepts_string_input(self):
        """Function should accept string representations of integers."""
        assert psa_orientation_from_psa_integer("0") == "Front"
        assert psa_orientation_from_psa_integer("23") == "Base270"

    def test_invalid_integer_below_range(self):
        """Should raise ValueError for integers below -1."""
        with pytest.raises(ValueError, match="Invalid PSA orientation integer: -2"):
            psa_orientation_from_psa_integer(-2)

    def test_invalid_integer_above_range(self):
        """Should raise ValueError for integers above 23."""
        with pytest.raises(ValueError, match="Invalid PSA orientation integer: 24"):
            psa_orientation_from_psa_integer(24)


class TestOrientationFromPsaOrientation:
    """Tests for orientation_from_psa_orientation function."""

    @pytest.mark.parametrize(
        ("_psa_int", "psa_orientation", "expected_vazen"),
        OVERVIEW_TABLE,
        ids=[psa_name for _, psa_name, _ in OVERVIEW_TABLE],
    )
    def test_all_psa_orientations_match_overview_table(
        self, _psa_int: int, psa_orientation: PsaOrientation, expected_vazen: Orientation
    ):
        """Verify all PSA orientation names map to correct Vazen names."""
        assert orientation_from_psa_orientation(psa_orientation) == expected_vazen

    def test_default_orientation_maps_to_front(self):
        """Default orientation should map to Front (F)."""
        assert orientation_from_psa_orientation("Default") == "F"


class TestOrientationFromPsaInteger:
    """Tests for the combined orientation_from_psa_integer function."""

    def test_full_conversion_chain(self):
        """Verify end-to-end conversion from PSA integer to Vazen orientation."""
        # Test a sample of values from overview table
        assert orientation_from_psa_integer(0) == "F"
        assert orientation_from_psa_integer(23) == "Dl"
        assert orientation_from_psa_integer(12) == "Fu"
        assert orientation_from_psa_integer(-1) == "F"  # Default -> F

    def test_string_input_full_chain(self):
        """Full conversion should work with string input."""
        assert orientation_from_psa_integer("4") == "U"
        assert orientation_from_psa_integer("10") == "D"
