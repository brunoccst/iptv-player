"""Groups parsed titles that refer to the same work. See DECISIONS.md#d-017."""

from collections import defaultdict
from collections.abc import Sequence

from rapidfuzz import fuzz

from title_normalizer.parser import ParsedTitle

FUZZY_THRESHOLD = 90
MIN_FUZZY_LENGTH = 6
BLOCK_PREFIX_LENGTH = 4


class _UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, index: int) -> int:
        while self.parent[index] != index:
            self.parent[index] = self.parent[self.parent[index]]
            index = self.parent[index]
        return index

    def union(self, left: int, right: int) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root != right_root:
            self.parent[max(left_root, right_root)] = min(left_root, right_root)


def group_titles(titles: Sequence[ParsedTitle]) -> list[list[int]]:
    """Returns groups of indexes into `titles`. Each group becomes one master media object."""
    # Pass 1: exact compact key + year ("Spider-Man" == "Spiderman").
    exact: dict[tuple[str, int | None], list[int]] = defaultdict(list)
    for index, title in enumerate(titles):
        exact[(title.compact_key, title.year)].append(index)

    buckets = list(exact.values())
    union = _UnionFind(len(buckets))
    representative = [titles[bucket[0]] for bucket in buckets]

    # Pass 2: a year-less bucket joins the single dated bucket with the same key. Ambiguous -> stays separate.
    dated_by_key: dict[str, list[int]] = defaultdict(list)
    for bucket_index, title in enumerate(representative):
        if title.year is not None:
            dated_by_key[title.compact_key].append(bucket_index)
    for bucket_index, title in enumerate(representative):
        if title.year is None and len(candidates := dated_by_key.get(title.compact_key, [])) == 1:
            union.union(bucket_index, candidates[0])

    # Pass 3: fuzzy match within blocks sharing a key prefix (keeps comparisons near-linear).
    blocks: dict[str, list[int]] = defaultdict(list)
    for bucket_index, title in enumerate(representative):
        blocks[title.compact_key[:BLOCK_PREFIX_LENGTH]].append(bucket_index)
    for block in blocks.values():
        for position, left in enumerate(block):
            for right in block[position + 1:]:
                if is_fuzzy_match(representative[left], representative[right]):
                    union.union(left, right)

    merged: dict[int, list[int]] = defaultdict(list)
    for bucket_index, bucket in enumerate(buckets):
        merged[union.find(bucket_index)].extend(bucket)
    return [sorted(indexes) for indexes in merged.values()]


def is_fuzzy_match(left: ParsedTitle, right: ParsedTitle) -> bool:
    """Typo-tolerant match. Years must be equal (None == None); year-less-to-dated joins happen only in pass 2.
    Otherwise one year-less title could chain remakes together ("Dune" -> 1984 and 2021). Numbers must match (sequels).
    """
    if left.year != right.year:
        return False
    if left.number_tokens != right.number_tokens:
        return False
    if min(len(left.compact_key), len(right.compact_key)) < MIN_FUZZY_LENGTH:
        return left.compact_key == right.compact_key
    return fuzz.ratio(left.compact_key, right.compact_key) >= FUZZY_THRESHOLD
