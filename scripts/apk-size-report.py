"""Prints a Markdown size breakdown of an APK (native libraries, Dex, JS bundle, resources). Used by tv-apk.yml."""

import sys
import zipfile
from collections import Counter


def group(name: str) -> str:
    if name.startswith("lib/"):
        return "/".join(name.split("/")[:2])
    if name.endswith(".dex"):
        return "dex"
    if name.startswith("assets/index.android.bundle"):
        return "JS bundle (Hermes)"
    return name.split("/")[0]


def main(path: str) -> None:
    apk = zipfile.ZipFile(path)
    stored, raw = Counter(), Counter()
    for info in apk.infolist():
        stored[group(info.filename)] += info.compress_size
        raw[group(info.filename)] += info.file_size
    total = sum(stored.values())
    print(f"### APK size: {total / 1e6:.1f} MB\n")
    print("| Part | In APK (MB) | Uncompressed (MB) |")
    print("| --- | ---: | ---: |")
    for key, size in stored.most_common(12):
        print(f"| {key} | {size / 1e6:.2f} | {raw[key] / 1e6:.2f} |")
    libs = sorted(
        (i for i in apk.infolist() if i.filename.startswith("lib/arm64-v8a/")),
        key=lambda i: -i.compress_size,
    )
    print("\n**Largest arm64 native libraries**\n")
    print("| Library | In APK (MB) | Uncompressed (MB) |")
    print("| --- | ---: | ---: |")
    for info in libs[:10]:
        print(f"| {info.filename.split('/')[-1]} | {info.compress_size / 1e6:.2f} | {info.file_size / 1e6:.2f} |")


if __name__ == "__main__":
    main(sys.argv[1])
