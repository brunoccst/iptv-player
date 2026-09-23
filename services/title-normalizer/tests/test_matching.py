from title_normalizer.matching import group_titles
from title_normalizer.parser import parse_title


def groups_of(*raw_titles: str) -> list[list[str]]:
    groups = group_titles([parse_title(raw) for raw in raw_titles])
    return sorted(sorted(raw_titles[i] for i in group) for group in groups)


def test_groups_quality_and_language_variants():
    assert groups_of(
        "EN - The Matrix (1999) [4K]",
        "The.Matrix.1999.1080p.BluRay",
        "Matrix, The (1999) CAM",
        "ES: The Matrix (1999) Dual Audio",
    ) == [sorted(["EN - The Matrix (1999) [4K]", "The.Matrix.1999.1080p.BluRay", "Matrix, The (1999) CAM",
                  "ES: The Matrix (1999) Dual Audio"])]


def test_spacing_and_punctuation_differences_merge():
    assert len(groups_of("Spider-Man: No Way Home (2021)", "Spiderman No Way Home (2021) 4K")) == 1


def test_typos_merge_fuzzily():
    assert len(groups_of("The Shawshank Redemption (1994)", "The Shawshank Redemtion (1994) 720p")) == 1


def test_sequels_never_merge():
    assert len(groups_of("Toy Story 2 (1999)", "Toy Story 3 (2010)", "Toy Story (1995)")) == 3
    assert len(groups_of("Rocky II", "Rocky III")) == 2


def test_remakes_with_different_years_never_merge():
    assert len(groups_of("Dune (1984)", "Dune (2021) 4K")) == 2


def test_year_less_entry_joins_single_dated_group():
    assert len(groups_of("Inception (2010) 4K", "Inception HD")) == 1


def test_year_less_entry_stays_separate_when_ambiguous():
    assert len(groups_of("Dune (1984)", "Dune (2021)", "Dune 1080p")) == 3


def test_short_titles_require_exact_match():
    assert len(groups_of("Up (2009)", "Us (2009)")) == 2


def test_distinct_titles_stay_apart():
    assert len(groups_of("The Batman (2022)", "Batman (1989)", "Batman Begins (2005)")) == 3
