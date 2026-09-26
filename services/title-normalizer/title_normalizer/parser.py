"""Regex-based title parser: splits a raw IPTV title into a clean title, year and variant tags. See DECISIONS.md#d-017."""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date

from title_normalizer import tags

MIN_YEAR = 1900
MAX_YEAR = date.today().year + 1

# Multi-word tags folded into single tokens before tokenising ("WEB-DL" -> "webdl").
_PHRASES = [
    (re.compile(r"\bweb[-_. ]?(dl|rip)\b", re.I), r"web\1"),
    (re.compile(r"\bblu[-_. ]?ray\b", re.I), "bluray"),
    (re.compile(r"\bhd[-_. ]?(cam|ts|tc|rip|tv)\b", re.I), r"hd\1"),
    (re.compile(r"\bcam[-_. ]?rip\b", re.I), "camrip"),
    (re.compile(r"\bfull[-_. ]?hd\b", re.I), "fhd"),
    (re.compile(r"\bultra[-_. ]?hd\b", re.I), "uhd"),
    (re.compile(r"\bdual[-_. ]?(audio|aud)\b", re.I), "dual"),
    (re.compile(r"\bmulti[-_. ]?(sub|subs)\b", re.I), "multisub"),
    (re.compile(r"\bmulti[-_. ]?(audio|lang|language)\b", re.I), "multi"),
    (re.compile(r"\bdolby[-_. ]?vision\b", re.I), "dovi"),
    (re.compile(r"\bhdr10(\+|plus)?", re.I), "hdr"),
    (re.compile(r"\bpt[-_]br\b", re.I), "ptbr"),
    (re.compile(r"\bh\.?26([45])\b", re.I), r"x26\1"),
    (re.compile(r"\bdd[p+]?[257]\.[01]\b", re.I), "ac3"),
]

_PREFIX = re.compile(r"^\s*[\[(|]?\s*(?P<body>[A-Za-z0-9+]{2,6}(?:[-_ /][A-Za-z0-9+]{2,6}){0,2})\s*(?:[\])|:]|\s[-–]\s)\s*")
_BRACKET = re.compile(r"\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}")
_TOKEN_SPLIT = re.compile(r"[\s,/_+|\-–.]+")
_EDGE_PUNCTUATION = " -–:|.,_/"
_TRAILING_ARTICLE = re.compile(r"^(?P<rest>.+),\s*(?P<article>the|a|an)$", re.I)


@dataclass(frozen=True)
class ParsedTitle:
    raw: str
    clean_title: str
    key: str
    year: int | None
    quality: str | None
    source: str | None
    audio_languages: tuple[str, ...]
    audio_tag: str | None
    is_hdr: bool

    @property
    def compact_key(self) -> str:
        return self.key.replace(" ", "")

    @property
    def number_tokens(self) -> frozenset[str]:
        return frozenset(token for token in self.key.split() if token.isdigit())


class _Tags:
    def __init__(self) -> None:
        self.quality: str | None = None
        self.source: str | None = None
        self.languages: list[str] = []
        self.audio_tag: str | None = None
        self.hdr = False
        self.year: int | None = None

    def absorb(self, token: str, allow_short: bool, prefix: bool = False) -> bool:
        """Records `token` if it is a known tag. Returns False for unknown tokens. `prefix`: a leading group ("GE - ")."""
        word = _fold(token)
        if not word:
            return True
        if word in tags.QUALITY:
            self.quality = _best_quality(self.quality, tags.QUALITY[word])
        elif word in tags.SOURCE:
            self.source = self.source or tags.SOURCE[word]
        elif word in tags.HDR:
            self.hdr = True
        elif word in tags.AUDIO_TAG:
            self.audio_tag = self.audio_tag or tags.AUDIO_TAG[word]
        elif word in tags.LANGUAGE_LONG:
            self._add_language(tags.LANGUAGE_LONG[word])
        elif word in tags.LANGUAGE_SHORT and (allow_short or token.isupper()):
            self._add_language(tags.LANGUAGE_SHORT[word])
        elif prefix and word in tags.LANGUAGE_PREFIX:
            self._add_language(tags.LANGUAGE_PREFIX[word])
        elif word in tags.IGNORED:
            pass
        else:
            return False
        return True

    def absorb_compound(self, token: str, allow_short: bool, prefix: bool = False) -> bool:
        """Absorbs "ENG-ESP" style tokens only if every part is a known tag. Returns False (and records nothing) otherwise."""
        parts = [part for part in _TOKEN_SPLIT.split(token) if part]
        probe = _Tags()
        if not parts or not all(probe.absorb(part, allow_short, prefix) for part in parts):
            return False
        for part in parts:
            self.absorb(part, allow_short, prefix)
        return True

    def _add_language(self, code: str) -> None:
        if code not in self.languages:
            self.languages.append(code)


def parse_title(raw: str) -> ParsedTitle:
    found = _Tags()
    text = raw
    for pattern, replacement in _PHRASES:
        text = pattern.sub(replacement, text)

    text = _strip_prefixes(text, found)
    text, bracket_year = _strip_brackets(text, found)

    # Scene names use dots/underscores as spaces: "The.Matrix.1999.1080p".
    if " " not in text.strip() and (text.count(".") >= 2 or "_" in text):
        text = text.replace(".", " ").replace("_", " ")

    title_tokens, zone_year = _split_tag_zone(text.split(), found)
    title_tokens = _strip_trailing_tags(title_tokens, found)

    clean = _tidy(" ".join(title_tokens)) or _tidy(raw)
    return ParsedTitle(
        raw=raw,
        clean_title=clean,
        key=normalize_key(clean),
        year=bracket_year or zone_year,
        quality=found.quality,
        source=found.source,
        audio_languages=tuple(found.languages),
        audio_tag=found.audio_tag,
        is_hdr=found.hdr,
    )


def normalize_key(title: str) -> str:
    """Comparison key: accent-free, lowercase, punctuation-free, roman numerals as digits, no leading English article."""
    text = unicodedata.normalize("NFKD", title)
    text = "".join(char for char in text if not unicodedata.combining(char)).lower()
    text = text.replace("&", " and ")
    text = re.sub(r"['’`´]", "", text)
    text = re.sub(r"[\W_]+", " ", text).strip()
    tokens = [tags.ROMAN_NUMERALS.get(token, token) for token in text.split()]
    if len(tokens) > 1 and tokens[0] in ("the", "a", "an"):
        tokens = tokens[1:]
    return " ".join(tokens)


def parse_year(value: str | None) -> int | None:
    if value and re.fullmatch(r"\(?\d{4}\)?", value.strip()):
        year = int(value.strip("() "))
        return year if MIN_YEAR <= year <= MAX_YEAR else None
    return None


def _strip_prefixes(text: str, found: _Tags) -> str:
    """Removes leading tag groups like "EN - ", "|EN| ", "[4K-EN] ", "NF: ". Only uppercase or digit-bearing groups qualify."""
    while match := _PREFIX.match(text):
        body = match.group("body")
        if body != body.upper():
            break
        if not found.absorb_compound(body, allow_short=True, prefix=True):
            break
        text = text[match.end() :]
    return text


def _strip_brackets(text: str, found: _Tags) -> tuple[str, int | None]:
    year: int | None = None

    def replace(match: re.Match[str]) -> str:
        nonlocal year
        is_paren = match.group(2) is not None
        content = next(group for group in match.groups() if group is not None)
        tokens = [token for token in _TOKEN_SPLIT.split(content) if token]
        years = [parse_year(token) for token in tokens]
        probe = _Tags()
        if tokens and all(y is not None or probe.absorb(token, allow_short=True) for token, y in zip(tokens, years, strict=True)):
            for token, token_year in zip(tokens, years, strict=True):
                if token_year is not None:
                    year = year or token_year
                else:
                    found.absorb(token, allow_short=True)
            return " "
        return f" ({content}) " if is_paren else " "

    return _BRACKET.sub(replace, text), year


def _split_tag_zone(tokens: list[str], found: _Tags) -> tuple[list[str], int | None]:
    """Cuts at the first year or strong tag after the first token. Everything after is the tag zone."""
    for index, token in enumerate(tokens):
        if index == 0:
            continue
        year = parse_year(token.strip(_EDGE_PUNCTUATION))
        if year is None and not any(_fold(part) in tags.STRONG for part in _TOKEN_SPLIT.split(token)):
            continue
        for tag_token in tokens[index:]:
            for part in _TOKEN_SPLIT.split(tag_token):
                if parse_year(part) is None:
                    found.absorb(part, allow_short=False)
        return tokens[:index], year
    return tokens, None


def _strip_trailing_tags(tokens: list[str], found: _Tags) -> list[str]:
    while len(tokens) > 1:
        token = tokens[-1].strip(_EDGE_PUNCTUATION)
        if token and not found.absorb_compound(token, allow_short=False):
            break
        tokens = tokens[:-1]
    return tokens


def _tidy(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip(_EDGE_PUNCTUATION + " ")
    title = re.sub(r"\(\s*\)", "", title).strip()
    if match := _TRAILING_ARTICLE.match(title):
        title = f"{match.group('article').capitalize()} {match.group('rest')}"
    return title


def _fold(token: str) -> str:
    text = unicodedata.normalize("NFKD", token)
    return "".join(char for char in text if not unicodedata.combining(char)).lower().strip(_EDGE_PUNCTUATION + "()[]")


def _best_quality(current: str | None, candidate: str) -> str:
    if current is None:
        return candidate
    return max(current, candidate, key=lambda quality: tags.QUALITY_RANK.get(quality, 0))
