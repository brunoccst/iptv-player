import pytest

from tests.cases_loader import load
from title_normalizer.parser import normalize_key, parse_title

PARSER = load("parser")
FIELDS = {
    "title": "clean_title",
    "year": "year",
    "quality": "quality",
    "source": "source",
    "languages": "audio_languages",
    "audioTag": "audio_tag",
    "hdr": "is_hdr",
}


@pytest.mark.parametrize("case", PARSER["parse"], ids=lambda case: case["raw"])
def test_parse_title(case):
    parsed = parse_title(case["raw"])

    actual = {field: getattr(parsed, attribute) for field, attribute in FIELDS.items() if field in case}
    expected = {field: tuple(case[field]) if field == "languages" else case[field] for field in FIELDS if field in case}
    assert actual == expected


@pytest.mark.parametrize("case", PARSER["keys"], ids=lambda case: case["title"])
def test_normalize_key(case):
    assert normalize_key(case["title"]) == case["key"]
