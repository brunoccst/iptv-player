import pytest

from tests.cases_loader import load
from title_normalizer.matching import group_titles
from title_normalizer.parser import parse_title


@pytest.mark.parametrize("case", load("matching")["groups"], ids=lambda case: case["name"])
def test_group_titles(case):
    groups = group_titles([parse_title(raw) for raw in case["titles"]])

    assert len(groups) == case["groups"]
