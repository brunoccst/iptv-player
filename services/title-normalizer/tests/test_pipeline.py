from title_normalizer.parser import parse_title
from title_normalizer.pipeline import build_masters, master_id, quality_score, variant_label


def item(stream_id: str, name: str, **extra) -> dict:
    return {"id": stream_id, "name": name, **extra}


def test_build_masters_groups_and_orders_variants_best_first():
    masters = build_masters(
        "acc",
        "movie",
        [
            item("1", "The Matrix (1999) CAM", posterUrl=None, rating=6.0),
            item("2", "EN - The Matrix (1999) [4K] HDR", posterUrl="http://img/4k.jpg", rating=8.7, containerExtension="mkv"),
            item("3", "The Matrix (1999) 1080p", posterUrl="http://img/hd.jpg", categoryId="10"),
            item("4", "Inception (2010)"),
        ],
    )

    assert [master.title for master in masters] == ["Inception", "The Matrix"]
    matrix = masters[1]
    assert matrix.year == 1999
    assert [variant.stream_id for variant in matrix.variants] == ["2", "3", "1"]
    assert matrix.poster_url == "http://img/4k.jpg"
    assert matrix.rating == 8.7
    assert matrix.best_quality == "4K"
    assert matrix.variants[0].label == "4K · HDR · ENG"
    assert matrix.variants[1].category_id == "10"
    assert matrix.variants[2].label == "CAM"


def test_master_ids_are_stable_and_scoped():
    first = build_masters("acc", "movie", [item("1", "Heat (1995)")])[0]
    again = build_masters("acc", "movie", [item("9", "Heat (1995) 4K"), item("1", "Heat (1995)")])[0]

    assert first.id == again.id == master_id("acc", "movie", "heat", 1995)
    assert build_masters("other", "movie", [item("1", "Heat (1995)")])[0].id != first.id
    assert build_masters("acc", "series", [item("1", "Heat (1995)")])[0].id != first.id


def test_release_date_supplies_missing_year():
    master = build_masters("acc", "series", [item("7", "Breaking Bad", releaseDate="2008-01-20")])[0]

    assert master.year == 2008


def test_duplicate_labels_are_numbered():
    master = build_masters("acc", "movie", [item("1", "Heat (1995) 1080p"), item("2", "Heat (1995) 1080p")])[0]

    assert [variant.label for variant in master.variants] == ["1080p", "1080p (2)"]


def test_invalid_items_are_skipped():
    assert build_masters("acc", "movie", [{"id": "", "name": "x"}, {"id": "1"}, {"name": "y"}]) == []


def test_display_title_is_most_common_spelling():
    master = build_masters(
        "acc",
        "movie",
        [
            item("1", "Spider-Man: No Way Home (2021)"),
            item("2", "Spider-Man: No Way Home (2021) 4K"),
            item("3", "Spiderman No Way Home (2021)"),
        ],
    )[0]

    assert master.title == "Spider-Man: No Way Home"


def test_quality_score_ranks_sources():
    scores = [quality_score(parse_title(raw)) for raw in ("X (2020) 4K HDR", "X (2020) 1080p", "X (2020)", "X (2020) 4K CAM")]

    assert scores == sorted(scores, reverse=True)


def test_variant_label_falls_back_to_container():
    assert variant_label(parse_title("Heat (1995)"), "mkv") == "MKV"
    assert variant_label(parse_title("Heat (1995)"), None) == "STANDARD"
