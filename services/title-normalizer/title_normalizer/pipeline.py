"""Turns a job payload (raw provider items) into master media records with variants. Pure: no I/O."""

import hashlib
import re
from collections import Counter
from dataclasses import dataclass, replace
from typing import Any

from title_normalizer import tags
from title_normalizer.matching import group_titles
from title_normalizer.parser import ParsedTitle, parse_title, parse_year


@dataclass(frozen=True)
class Variant:
    stream_id: str
    raw_title: str
    label: str
    quality: str | None
    source: str | None
    audio_languages: tuple[str, ...]
    audio_tag: str | None
    is_hdr: bool
    quality_score: int
    category_id: str | None
    poster_url: str | None
    rating: float | None
    container_extension: str | None
    added_at: int | None
    release_key: int | None
    subtitle_languages: tuple[str, ...] = ()


@dataclass(frozen=True)
class Master:
    id: str
    title: str
    normalized_key: str
    year: int | None
    poster_url: str | None
    rating: float | None
    best_quality: str | None
    added_at: int | None
    release_key: int | None
    variants: tuple[Variant, ...]


def build_masters(account_id: str, media_kind: str, items: list[dict[str, Any]]) -> list[Master]:
    """`items` use the backend payload shape: id, name, categoryId, posterUrl, rating, containerExtension, releaseDate, addedAt,
    tmdbId."""
    usable = [item for item in items if str(item.get("id") or "").strip() and str(item.get("name") or "").strip()]
    parsed = [_parse_item(item) for item in usable]
    groups = merge_by_tmdb(group_titles(parsed), [tmdb_id(item) for item in usable], [title.year for title in parsed])
    masters = [_build_master(account_id, media_kind, [usable[i] for i in group], [parsed[i] for i in group]) for group in groups]
    return sorted(masters, key=lambda master: (master.title.lower(), master.year or 0))


def tmdb_id(item: dict[str, Any]) -> str | None:
    """The TMDB id some providers send in their lists (`tmdb` or `tmdb_id`); "0" and empty mean none."""
    value = str(item.get("tmdbId") or "").strip()
    return value if value.isdigit() and value.strip("0") else None


def merge_by_tmdb(groups: list[list[int]], tmdb_ids: list[str | None], years: list[int | None]) -> list[list[int]]:
    """Joins name groups that share a TMDB id, e.g. "La Casa de Papel" and "Money Heist" (D-065). A shared id only joins
    groups whose years agree (or are unknown): providers sometimes reuse an id for a remake or get it wrong."""
    parent = list(range(len(groups)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    group_years = [{years[i] for i in group if years[i] is not None} for group in groups]
    first_group: dict[str, int] = {}
    for index, group in enumerate(groups):
        for identifier in sorted({tmdb_ids[i] for i in group if tmdb_ids[i]}):
            other = first_group.setdefault(identifier, index)
            if other == index:
                continue
            root, other_root = find(index), find(other)
            known = group_years[root], group_years[other_root]
            if root != other_root and (not known[0] or not known[1] or known[0] & known[1]):
                parent[max(root, other_root)] = min(root, other_root)
                group_years[min(root, other_root)] = known[0] | known[1]

    merged: dict[int, list[int]] = {}
    for index, group in enumerate(groups):
        merged.setdefault(find(index), []).extend(group)
    return [sorted(indexes) for indexes in merged.values()]


def quality_score(title: ParsedTitle) -> int:
    score = tags.QUALITY_RANK.get(title.quality or "", tags.UNKNOWN_QUALITY_RANK)
    score += tags.SOURCE_ADJUSTMENT.get(title.source or "", 0)
    score += 5 if title.is_hdr else 0
    return max(score, 0)


def variant_label(title: ParsedTitle, container_extension: str | None) -> str:
    parts = [
        title.quality,
        title.source if title.source in ("CAM", "TS", "TC", "SCR", "REMUX") else None,
        "HDR" if title.is_hdr else None,
        "/".join(title.audio_languages) or None,
        title.audio_tag,
    ]
    label = " · ".join(part for part in parts if part)
    return label or (container_extension or "Standard").upper()


def release_key(release_date: str | None, year: int | None) -> int | None:
    """YYYYMMDD from an ISO-like date ("2020-05-12"), else YYYY0000 from the year, for sorting."""
    match = re.match(r"\s*(\d{4})-(\d{1,2})-(\d{1,2})", release_date or "")
    if match and parse_year(match[1]) and 1 <= int(match[2]) <= 12 and 1 <= int(match[3]) <= 31:
        return int(match[1]) * 10000 + int(match[2]) * 100 + int(match[3])
    return year * 10000 if year else None


def master_id(account_id: str, media_kind: str, compact_key: str, year: int | None) -> str:
    """Stable across re-syncs while the group's key and year stay the same."""
    digest = hashlib.sha1(f"{account_id}|{media_kind}|{compact_key}|{year or ''}".encode()).hexdigest()
    return digest[:20]


def _parse_item(item: dict[str, Any]) -> ParsedTitle:
    parsed = parse_title(str(item["name"]))
    if parsed.year is None and (release_year := parse_year(str(item.get("releaseDate") or "")[:4])):
        parsed = replace(parsed, year=release_year)
    return parsed


def _build_master(account_id: str, media_kind: str, items: list[dict[str, Any]], parsed: list[ParsedTitle]) -> Master:
    variants = [_build_variant(item, title) for item, title in zip(items, parsed, strict=True)]
    order = sorted(range(len(variants)), key=lambda i: (-variants[i].quality_score, variants[i].stream_id))
    variants = _dedupe_labels([variants[i] for i in order])
    parsed = [parsed[i] for i in order]

    title_counts = Counter(title.clean_title for title in parsed)
    display_title = max(title_counts, key=lambda name: (title_counts[name], -[t.clean_title for t in parsed].index(name)))
    years = Counter(title.year for title in parsed if title.year is not None)
    year = years.most_common(1)[0][0] if years else None
    canonical = next(title for title in parsed if title.clean_title == display_title)
    ratings = [variant.rating for variant in variants if variant.rating is not None]
    qualities = [variant.quality for variant in variants if variant.quality]
    added = [variant.added_at for variant in variants if variant.added_at is not None]
    released = [variant.release_key for variant in variants if variant.release_key is not None]

    return Master(
        id=master_id(account_id, media_kind, canonical.compact_key, year),
        title=display_title,
        normalized_key=canonical.key,
        year=year,
        poster_url=next((variant.poster_url for variant in variants if variant.poster_url), None),
        rating=max(ratings) if ratings else None,
        best_quality=max(qualities, key=lambda q: tags.QUALITY_RANK.get(q, 0)) if qualities else None,
        added_at=max(added) if added else None,
        release_key=min(released) if released else release_key(None, year),
        variants=tuple(variants),
    )


def _build_variant(item: dict[str, Any], title: ParsedTitle) -> Variant:
    container = _optional_str(item.get("containerExtension"))
    rating = item.get("rating")
    added_at = item.get("addedAt")
    return Variant(
        stream_id=str(item["id"]).strip(),
        raw_title=str(item["name"]),
        label=variant_label(title, container),
        quality=title.quality,
        source=title.source,
        audio_languages=title.audio_languages,
        audio_tag=title.audio_tag,
        is_hdr=title.is_hdr,
        quality_score=quality_score(title),
        category_id=_optional_str(item.get("categoryId")),
        poster_url=_optional_str(item.get("posterUrl")),
        rating=float(rating) if isinstance(rating, (int, float)) else None,
        container_extension=container,
        added_at=int(added_at) if isinstance(added_at, (int, float)) and added_at > 0 else None,
        release_key=release_key(_optional_str(item.get("releaseDate")), None),
        subtitle_languages=title.subtitle_languages,
    )


def _dedupe_labels(variants: list[Variant]) -> list[Variant]:
    """Identical labels get " (2)", " (3)" so the version selector stays unambiguous."""
    seen: Counter[str] = Counter()
    result = []
    for variant in variants:
        seen[variant.label] += 1
        count = seen[variant.label]
        result.append(variant if count == 1 else replace(variant, label=f"{variant.label} ({count})"))
    return result


def _optional_str(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None
