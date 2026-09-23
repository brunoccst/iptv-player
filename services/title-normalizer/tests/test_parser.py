import pytest

from title_normalizer.parser import normalize_key, parse_title


@pytest.mark.parametrize(
    ("raw", "title", "year", "quality", "source", "languages", "audio_tag", "hdr"),
    [
        ("EN - The Matrix (1999) [4K] [MULTI]", "The Matrix", 1999, "4K", None, ("ENG",), "MULTI", False),
        ("The.Matrix.1999.1080p.BluRay.x264-GROUP", "The Matrix", 1999, "1080p", "BLURAY", (), None, False),
        ("|EN| The Matrix 4K HDR", "The Matrix", None, "4K", None, ("ENG",), None, True),
        ("Matrix, The (1999)", "The Matrix", 1999, None, None, (), None, False),
        ("The Matrix (1999) HDTS ENG", "The Matrix", 1999, None, "TS", ("ENG",), None, False),
        ("The Matrix - 1999 - CAM", "The Matrix", 1999, None, "CAM", (), None, False),
        ("ES: Matrix (1999) Dual Audio", "Matrix", 1999, None, None, ("ESP",), "DUAL", False),
        ("[4K] The Matrix 1999 UHD", "The Matrix", 1999, "4K", None, (), None, False),
        ("4K-EN - Dune: Part Two (2024) HDR10+", "Dune: Part Two", 2024, "4K", None, ("ENG",), None, True),
        ("Spider-Man: No Way Home (2021) WEB-DL 1080p", "Spider-Man: No Way Home", 2021, "1080p", "WEB", (), None, False),
        ("Movie Name 2023 HDCAM", "Movie Name", 2023, None, "CAM", (), None, False),
        ("Leon The Professional (1994) [Extended] ENG-ESP", "Leon The Professional", 1994, None, None, ("ENG", "ESP"), None, False),
        ("Taken 2 (2012) DUAL-1080p", "Taken 2", 2012, "1080p", None, (), "DUAL", False),
        ("O Auto da Compadecida (2000) Dublado", "O Auto da Compadecida", 2000, None, None, ("POR",), None, False),
        ("Amélie (2001) [FR]", "Amélie", 2001, None, None, ("FRE",), None, False),
        ("The Matrix - EN", "The Matrix", None, None, None, ("ENG",), None, False),
        ("|NF| Stranger Things", "Stranger Things", None, None, None, (), None, False),
        ("Film (2020) [1080p] [720p]", "Film", 2020, "1080p", None, (), None, False),
    ],
)
def test_parse_title_extracts_tags(raw, title, year, quality, source, languages, audio_tag, hdr):
    parsed = parse_title(raw)

    assert (parsed.clean_title, parsed.year, parsed.quality, parsed.source, parsed.audio_languages, parsed.audio_tag, parsed.is_hdr) == (
        title,
        year,
        quality,
        source,
        languages,
        audio_tag,
        hdr,
    )


@pytest.mark.parametrize(
    ("raw", "title", "year"),
    [
        ("It (2017)", "It", 2017),  # "IT" is also Italian; lowercase title must survive
        ("It: Chapter Two (2019)", "It: Chapter Two", 2019),
        ("Us (2019)", "Us", 2019),
        ("Toy Story 2 (1999)", "Toy Story 2", 1999),
        ("2001: A Space Odyssey (1968)", "2001: A Space Odyssey", 1968),  # leading number is title, not year
        ("Blade Runner 2049 (2017)", "Blade Runner 2049", 2017),  # 2049 is out of year range
        ("Mission: Impossible - Fallout (2018) 720p", "Mission: Impossible - Fallout", 2018),
        ("The Office (US)", "The Office (US)", None),  # country qualifier is not a language tag
        ("Ted ENG", "Ted", None),
        ("Pan (2015)", "Pan", 2015),
        ("1917 (2019)", "1917", 2019),
    ],
)
def test_parse_title_keeps_real_title_words(raw, title, year):
    parsed = parse_title(raw)

    assert (parsed.clean_title, parsed.year) == (title, year)


def test_parse_title_falls_back_to_raw_when_only_tags():
    assert parse_title("[4K]").clean_title == "[4K]"


@pytest.mark.parametrize(
    ("title", "key"),
    [
        ("The Matrix", "matrix"),
        ("Amélie", "amelie"),
        ("Ocean's Eleven", "oceans eleven"),
        ("Fast & Furious", "fast and furious"),
        ("Rocky II", "rocky 2"),
        ("Spider-Man: No Way Home", "spider man no way home"),
        ("A", "a"),
        ("Москва слезам не верит", "москва слезам не верит"),
    ],
)
def test_normalize_key(title, key):
    assert normalize_key(title) == key
