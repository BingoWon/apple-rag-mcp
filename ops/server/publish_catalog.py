#!/usr/bin/env python3
"""Publish the pilot navigation index. Only a completely built snapshot becomes visible."""

import argparse
import csv
import fcntl
import json
import os
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

ROOT = "https://developer.apple.com/documentation/technologies"
ORIGIN = "https://developer.apple.com"
MODULES = ("swiftui", "uikit")
PSQL = [
    "docker",
    "exec",
    "-i",
    "postgres_db",
    "sh",
    "-c",
    'exec psql -XqAt -v ON_ERROR_STOP=1 -U apple_rag_local_admin -d "$POSTGRES_DB" "$@"',
    "psql",
]


def target(value):
    if (
        not isinstance(value, str)
        or not value
        or any(ord(c) < 32 for c in value)
        or not value.startswith(("/", ORIGIN + "/"))
    ):
        return None
    u = urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN, value))
    if u.scheme != "https" or u.netloc != "developer.apple.com":
        return None
    path = u.path.lower().rstrip("/")
    if (
        len(path.split("/")) < 3
        or path.split("/")[:2] != ["", "documentation"]
        or path.split("/")[2] not in MODULES
    ):
        return None
    if any(c in path for c in ("\\", "\n", "\r", "\t", " ")) or any(
        urllib.parse.unquote(s) in (".", "..") for s in path.split("/")
    ):
        return None
    url = ORIGIN + urllib.parse.quote(path, safe="/%:@!$&'()*+,;=-._~[]^|").lower()
    return url if len(url.encode()) <= 2048 else None


def groups(raw, root=False):
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return None
    if (
        not isinstance(raw, dict)
        or not raw.get("kind")
        or not isinstance(raw.get("metadata"), dict)
    ):
        return None
    refs = raw.get("references", {})
    if root:
        sections = [
            (
                g["name"],
                [t.get("destination", {}).get("identifier") for t in g["technologies"]],
            )
            for section in raw["sections"]
            if section.get("kind") == "technologies"
            for g in section["groups"]
        ]
    else:
        sections = [
            (g.get("anchor"), g.get("identifiers", []))
            for g in raw.get("topicSections", [])
        ]
    result = {}
    for anchor, identifiers in sections:
        if not anchor or not isinstance(anchor, str):
            continue
        key = urllib.parse.quote(anchor, safe="-._~!'()*")
        links = result.setdefault(key, {})
        for identifier in identifiers:
            ref = refs.get(identifier, {})
            link = target(ref.get("url"))
            if link:
                links[link] = True
    return {a: list(links) for a, links in result.items() if links}


def publish(refresh=()):
    # The same serialization lock covers source reads, the root download and publication.
    with os.fdopen(
        os.open(
            "/tmp/apple-rag-publish-catalog.lock",
            os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW,
            0o600,
        ),
        "a",
    ) as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        build(refresh)


def build(refresh):
    root = None
    try:
        with urllib.request.urlopen(
            "https://developer.apple.com/tutorials/data/documentation/technologies.json",
            timeout=30,
        ) as r:
            blob = r.read(4 * 1024 * 1024 + 1)
            if len(blob) > 4 * 1024 * 1024:
                raise ValueError("root too large")
            root = groups(json.loads(blob), True)
    except (OSError, ValueError, KeyError, TypeError) as err:
        print("Using last good technology groups:", type(err).__name__, file=sys.stderr)
    if not root or not all(
        any(ORIGIN + "/documentation/" + m in links for links in root.values())
        for m in MODULES
    ):
        cached = subprocess.check_output(
            PSQL,
            input=(
                "SELECT groups FROM catalog_sources WHERE url='" + ROOT + "';"
            ).encode(),
        )
        if not cached.strip():
            raise RuntimeError(
                "No valid technology index; previous publication retained"
            )
        root = json.loads(cached)
    overrides = {}
    for url in refresh:
        if target(url) != url:
            raise ValueError("Refresh requires a canonical pilot URL")
        with urllib.request.urlopen(
            ORIGIN + "/tutorials/data" + urllib.parse.urlsplit(url).path + ".json",
            timeout=30,
        ) as response:
            blob = response.read(12 * 1024 * 1024 + 1)
        if len(blob) > 12 * 1024 * 1024:
            raise ValueError("Document too large")
        nav = groups(json.loads(blob))
        if nav is None:
            raise ValueError("No valid DocC metadata")
        overrides[url] = nav
    sources = {ROOT: root}
    readable = set()
    where = " OR ".join(
        "(p.url='"
        + ORIGIN
        + "/documentation/"
        + m
        + "' OR p.url LIKE '"
        + ORIGIN
        + "/documentation/"
        + m
        + "/%')"
        for m in MODULES
    )
    # Large raw documents only cross the local pipe for new or changed page versions.
    query = (
        """SELECT json_build_array(p.url,p.id,p.updated_at,coalesce(p.content ~ '[^[:space:]]',false),
        identical, CASE WHEN identical THEN c.groups END,CASE WHEN NOT identical THEN p.raw_json END)
        FROM pages p LEFT JOIN catalog_sources c USING(url)
        CROSS JOIN LATERAL (SELECT c.page_id IS NOT DISTINCT FROM p.id AND c.source_stamp IS NOT DISTINCT FROM p.updated_at AS identical) state
        WHERE octet_length(p.url)<=2048 AND ("""
        + where
        + ");"
    )
    with tempfile.TemporaryFile(mode="w+", encoding="utf8") as staged:
        staged.write(
            "BEGIN; SET LOCAL lock_timeout='4s'; CREATE TEMP TABLE src (LIKE catalog_sources) ON COMMIT DROP; COPY src FROM STDIN WITH (FORMAT csv, NULL '\\N');\n"
        )
        writer = csv.writer(staged, lineterminator="\n")
        writer.writerow([ROOT, r"\N", r"\N", json.dumps(root)])
        with subprocess.Popen(
            PSQL + ["-c", query], stdout=subprocess.PIPE, text=True
        ) as proc:
            for line in proc.stdout:
                url, pid, stamp, has_text, identical, cached, raw = json.loads(line)
                if target(url) != url:
                    continue
                nav = cached if identical else groups(raw)
                if url in overrides:
                    nav = overrides[url]
                    identical = False
                if nav is not None:
                    nav = {
                        key: links
                        for key, links in nav.items()
                        if len((url + "#" + key).encode()) <= 2048
                    }
                sources[url] = nav
                if has_text:
                    readable.add(url)
                if not identical:
                    writer.writerow(
                        [
                            url,
                            pid,
                            stamp or r"\N",
                            json.dumps(nav) if nav is not None else r"\N",
                        ]
                    )
            if proc.wait():
                raise RuntimeError("Catalog input read failed")
        staged.write(
            "\\.\nINSERT INTO catalog_sources SELECT * FROM src ON CONFLICT(url) DO UPDATE SET page_id=excluded.page_id,source_stamp=excluded.source_stamp,groups=excluded.groups;\n"
        )
        if set(overrides) - sources.keys():
            raise RuntimeError("Refresh target not in corpus")
        # Only retain structure-only intermediates if there is a path to readable content.
        visible = set(readable)
        while True:
            extra = {
                u
                for u, g in sources.items()
                if u not in visible
                and g
                and any(t in visible for ts in g.values() for t in ts)
            }
            if not extra:
                break
            visible.update(extra)
        if ROOT not in visible or any(
            ORIGIN + "/documentation/" + m not in visible for m in MODULES
        ):
            raise RuntimeError("Incomplete pilot; previous publication retained")
        staged.write(
            "CREATE TEMP TABLE nodes(url text PRIMARY KEY,readable boolean,known boolean,links jsonb,directory boolean) ON COMMIT DROP; COPY nodes FROM STDIN WITH (FORMAT csv);\n"
        )

        def emit(u, read, known, links):
            prefix = u.split("#")[0] + "/"
            directory = bool(links) and all(
                "#" not in t and t.startswith(prefix) for t in links
            )
            writer.writerow(
                [u, read, known, json.dumps(links, separators=(",", ":")), directory]
            )

        for u in sorted(visible):
            nav = sources[u]
            anchors = []
            for anchor, links in (nav or {}).items():
                k = u + "#" + anchor
                children = [v for v in links if v in visible]
                if children and len(k.encode()) <= 2048:
                    anchors.append(k)
                    emit(k, False, True, children)
            emit(u, u in readable, nav is not None, anchors)
        staged.write("""\\.
INSERT INTO catalog_nodes AS n SELECT url,readable,CASE WHEN known THEN jsonb_array_length(links) END,
 ARRAY(SELECT jsonb_array_elements_text(links)),md5(links::text),directory FROM nodes
 ON CONFLICT(url) DO UPDATE SET readable=excluded.readable,child_count=excluded.child_count,members=excluded.members,digest=excluded.digest,directory=excluded.directory
 WHERE (n.readable,n.child_count,n.digest,n.directory) IS DISTINCT FROM (excluded.readable,excluded.child_count,excluded.digest,excluded.directory);
DELETE FROM catalog_nodes n WHERE NOT EXISTS (SELECT FROM nodes s WHERE s.url=n.url);
DELETE FROM catalog_sources c WHERE NOT EXISTS (SELECT FROM pages p WHERE p.url=c.url AND p.id=c.page_id) AND c.page_id IS NOT NULL;
COMMIT;
""")
        staged.seek(0)
        subprocess.run(PSQL, stdin=staged, check=True)
    print(
        f"Published {len(visible)} document locations; {len(readable)} readable pilot pages."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-url",
        action="append",
        default=[],
        help="Refresh official navigation for this indexed pilot URL before publishing",
    )
    publish(parser.parse_args().refresh_url)
