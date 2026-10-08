from typing import Literal

# See README.md for an explanation of this

# fmt: off
type Orientation = Literal[
    "B", "Bl", "Br", "Bu", # back
    "D", "Dl", "Dr", "Du", # down
    "F", "Fl", "Fr", "Fu", # front
    "L", "Ll", "Lr", "Lu", # left
    "R", "Rl", "Rr", "Ru", # right
    "U", "Ul", "Ur", "Uu", # up
]

type PsaOrientation = Literal[
    "Back",  "Back270",  "Back90",  "Back180",
    "Base",  "Base270",  "Base90",  "Base180",
    "Front", "Front270", "Front90", "Front180",
    "Side",  "Side270",  "Side90",  "Side180",
    "Right", "Right270", "Right90", "Right180",
    "Top",   "Top270",   "Top90",   "Top180",

    "Default"
]

PSA_INTEGER_TO_PSA_ORIENTATION_MAPPING: dict[int, PsaOrientation] = {
    -1: "Default",  0: "Front",     1: "Front90",  2: "Side",
     3: "Side90",   4: "Top",       5: "Top90",    6: "Back",
     7: "Back90",   8: "Right",     9: "Right90",  10: "Base",
    11: "Base90",  12: "Front180", 13: "Front270", 14: "Side180",
    15: "Side270", 16: "Top180",   17: "Top270",   18: "Back180",
    19: "Back270", 20: "Right180", 21: "Right270", 22: "Base180",
    23: "Base270",
}

PSA_ORIENTATION_TO_ORIENTATION_MAPPING: dict[PsaOrientation, Orientation] = {
     "Back": "B",  "Back270": "Bl",  "Back90": "Br",  "Back180": "Bu",
     "Base": "D",  "Base270": "Dl",  "Base90": "Dr",  "Base180": "Du",
    "Front": "F", "Front270": "Fl", "Front90": "Fr", "Front180": "Fu",
     "Side": "L",  "Side270": "Ll",  "Side90": "Lr",  "Side180": "Lu",
    "Right": "R", "Right270": "Rl", "Right90": "Rr", "Right180": "Ru",
      "Top": "U",   "Top270": "Ul",   "Top90": "Ur",   "Top180": "Uu",

    "Default": "F",  # Default to Front
}
# fmt: on


def psa_orientation_from_psa_integer(orientation_integer: int | str) -> PsaOrientation:
    """Convert PSA orientation integer to PSA orientation string."""
    if isinstance(orientation_integer, str):
        orientation_integer = int(orientation_integer)
    if orientation_integer < -1 or orientation_integer > 23:
        raise ValueError(
            f"Invalid PSA orientation integer: {orientation_integer}. Must be between -1 and 23."
        )
    return PSA_INTEGER_TO_PSA_ORIENTATION_MAPPING.get(orientation_integer, "Default")


def orientation_from_psa_orientation(psa_orientation: PsaOrientation) -> Orientation:
    """Convert PSA orientation string to standard Orientation string."""
    return PSA_ORIENTATION_TO_ORIENTATION_MAPPING.get(psa_orientation, "F")


def orientation_from_psa_integer(orientation_integer: int | str) -> Orientation:
    """Convert PSA orientation integer to standard Orientation string."""
    return orientation_from_psa_orientation(psa_orientation_from_psa_integer(orientation_integer))
