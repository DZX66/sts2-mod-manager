#!/usr/bin/env python3
"""GitHub Release helper for sts2-mod-manager CI.

Creates or updates a GitHub Release for a version tag, and automatically
generates release notes from:

1. The annotated tag message (if the tag was created with `git tag -a ... -m ...`)
2. The git log commit list between the previous tag and this tag
   (this project uses plain commits instead of PRs, so GitHub's own
   auto-generated notes would otherwise be empty)
3. GitHub's official PR-based auto-generated notes as a supplement

Usage:
    python scripts/ci/gh_publish.py --repo-root <root> tag-release [--tag <tag>]

Requires the `gh` CLI and GH_TOKEN / GITHUB_TOKEN in the environment.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


def _github_repository() -> str:
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not repo:
        print("GITHUB_REPOSITORY must be set (GitHub Actions provides it).", file=sys.stderr)
        raise SystemExit(1)
    return repo


def _gh(args: list[str]) -> None:
    subprocess.run(["gh", *args], check=True)


def _gh_output(args: list[str]) -> str:
    r = subprocess.run(["gh", *args], check=True, capture_output=True, text=True)
    return r.stdout


def _release_exists(tag: str, repo: str) -> bool:
    r = subprocess.run(
        ["gh", "release", "view", tag, "--repo", repo],
        capture_output=True,
    )
    return r.returncode == 0


def _release_asset_names(tag: str, repo: str) -> list[str]:
    try:
        out = _gh_output(
            [
                "release",
                "view",
                tag,
                "--repo",
                repo,
                "--json",
                "assets",
                "--jq",
                ".assets[].name",
            ]
        )
    except subprocess.CalledProcessError:
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def _clear_release_assets(tag: str, repo: str) -> None:
    for name in _release_asset_names(tag, repo):
        _gh(["release", "delete-asset", tag, name, "--yes", "--repo", repo])


def _generate_release_notes(tag: str, repo: str, target_commitish: str) -> str:
    """GitHub official auto-generated notes (PR-based; may be near-empty without PRs)."""
    args = [
        "api",
        "-X",
        "POST",
        f"repos/{repo}/releases/generate-notes",
        "-F",
        f"tag_name={tag}",
    ]
    if target_commitish:
        args.extend(["-F", f"target_commitish={target_commitish}"])
    args.extend(["--jq", ".body"])
    return _gh_output(args).strip()


def _read_tag_annotation(repo_root: Path, tag: str) -> str:
    """Annotated tag message via git for-each-ref; lightweight tags -> empty string."""
    tag_ref = f"refs/tags/{tag}"
    kind = subprocess.run(
        ["git", "for-each-ref", "--count=1", tag_ref, "--format=%(objecttype)"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if kind.returncode != 0 or kind.stdout.strip() != "tag":
        return ""
    body = subprocess.run(
        ["git", "for-each-ref", "--count=1", tag_ref, "--format=%(contents)"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if body.returncode != 0:
        return ""
    text = body.stdout.strip()
    sig = "-----BEGIN PGP SIGNATURE-----"
    if sig in text:
        text = text.split(sig, 1)[0].rstrip()
    return text


def _parse_version(v: str) -> tuple[int, int, int]:
    """Parse a version-ish tag like ``v1.5.1`` / ``v1.20`` into a comparable tuple."""
    s = v.strip()
    if s[:1] in ("v", "V"):
        s = s[1:]
    parts: list[int] = []
    for seg in re.split(r"[._-]", s):
        m = re.match(r"(\d+)", seg)
        if not m:
            break
        parts.append(int(m.group(1)))
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])  # type: ignore[return-value]


def _previous_tag(repo_root: Path, tag: str) -> str:
    """Highest semver tag reachable from this tag, strictly below ``tag``.

    Same rule GitHub's auto-generated notes use: pick the greatest version tag
    that this tag can reach, excluding itself.  A plain ``--sort=-version:refname``
    is not enough here because tags like ``v1.20`` would be treated as newer
    than ``v1.5.1`` by name sort order.
    """
    r = subprocess.run(
        ["git", "tag", "--merged", tag],
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        return ""
    tags = [t.strip() for t in r.stdout.splitlines() if t.strip() and t.strip() != tag]
    target = _parse_version(tag)
    best = ""
    best_ver: tuple[int, int, int] | None = None
    for t in tags:
        try:
            ver = _parse_version(t)
        except Exception:
            continue
        if ver < target and (best_ver is None or ver > best_ver):
            best = t
            best_ver = ver
    return best


def _git_log_changelog(repo_root: Path, tag: str, prev_tag: str) -> str:
    """Commit subject list between prev_tag and tag.

    This is the key part for this project: commits are pushed directly to
    main without PRs, so GitHub's own generated notes contain no commit list.
    """
    if prev_tag:
        args = ["git", "log", "--pretty=format:%s", f"{prev_tag}..{tag}"]
    else:
        args = ["git", "log", "--pretty=format:%s", tag]
    r = subprocess.run(
        args,
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        return ""
    lines = [
        line.strip()
        for line in r.stdout.splitlines()
        if line.strip() and not line.strip().startswith("Merge ")
    ]
    return "\n".join(f"- {line}" for line in lines)


def _release_title(tag: str) -> str:
    """Release title: strip a leading ``v`` so ``v1.5.1`` -> ``1.5.1``."""
    t = tag.strip()
    if len(t) > 1 and t[0] in "vV":
        return t[1:].strip() or t
    return t


def cmd_tag_release(repo_root: Path, tag: str) -> None:
    repo = _github_repository()
    if not tag:
        print("Tag is empty; set GITHUB_REF_NAME or pass --tag.", file=sys.stderr)
        raise SystemExit(1)

    exe = repo_root / "src-tauri" / "target" / "release" / "sts2-mod-manager.exe"
    assets = [str(exe)] if exe.is_file() else []
    if not assets:
        print(f"Release asset not found: {exe}", file=sys.stderr)
        raise SystemExit(1)

    sha = os.environ.get("GITHUB_SHA", "").strip()
    tag_note = _read_tag_annotation(repo_root, tag)
    prev_tag = _previous_tag(repo_root, tag)
    changelog = _git_log_changelog(repo_root, tag, prev_tag)
    generated = _generate_release_notes(tag, repo, sha)

    sections: list[str] = []
    if tag_note:
        sections.append(tag_note)
    if changelog:
        sections.append(changelog)
    if generated and generated not in sections:
        sections.append(generated)
    final_notes = "\n\n---\n\n".join(sections).strip() or f"Release {tag}"

    title = _release_title(tag)
    if _release_exists(tag, repo):
        _clear_release_assets(tag, repo)
        _gh(["release", "upload", tag, *assets, "--repo", repo])
        _gh(
            [
                "release",
                "edit",
                tag,
                "--title",
                title,
                "--notes",
                final_notes,
                "--latest",
                "--repo",
                repo,
            ]
        )
    else:
        _gh(
            [
                "release",
                "create",
                tag,
                *assets,
                "--repo",
                repo,
                "--title",
                title,
                "--notes",
                final_notes,
                "--verify-tag",
            ]
        )
    print(f"Release {tag} published successfully.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="GitHub Release helper for sts2-mod-manager CI.")
    p.add_argument("--repo-root", type=Path, default=Path("."))
    sub = p.add_subparsers(dest="command", required=True)

    p_tag = sub.add_parser("tag-release", help="Create or update GitHub Release for a version tag.")
    p_tag.add_argument(
        "--tag",
        default=os.environ.get("GITHUB_REF_NAME", "").strip(),
        help="Release tag (default: GITHUB_REF_NAME from Actions)",
    )

    args = p.parse_args(argv)
    root = args.repo_root.resolve()
    if args.command == "tag-release":
        cmd_tag_release(root, args.tag.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())