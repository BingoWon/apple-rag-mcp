"""Integration test using an isolated PostgreSQL schema; requires TEST_DATABASE_URL."""

import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch
import uuid

import publish_catalog as catalog


class CatalogPublication(unittest.TestCase):
    def test_refresh_reachability_cache_and_transactional_rollback(self):
        schema = "catalog_test_" + uuid.uuid4().hex
        container = os.getenv("CATALOG_TEST_CONTAINER")
        connection = (
            [
                "docker",
                "exec",
                "-i",
                container,
                "psql",
                "-U",
                "postgres",
                "-d",
                "apple_rag_test",
            ]
            if container
            else ["psql", os.environ["TEST_DATABASE_URL"]]
        )
        connection += ["-XqAt", "-v", "ON_ERROR_STOP=1"]
        subprocess.run(connection + ["-c", "CREATE SCHEMA " + schema], check=True)
        self.addCleanup(
            subprocess.run,
            connection + ["-c", "DROP SCHEMA " + schema + " CASCADE"],
            check=True,
        )
        env = dict(os.environ, PGOPTIONS="-c search_path=" + schema)
        client = (
            [
                "docker",
                "exec",
                "-i",
                "-e",
                "PGOPTIONS=" + env["PGOPTIONS"],
                *connection[3:],
            ]
            if container
            else connection
        )

        def sql(statement):
            return subprocess.check_output(
                client, input=statement, text=True, env=env
            ).strip()

        def literal(value):
            return "'" + value.replace("'", "''") + "'"

        root = catalog.ROOT
        module = root.rsplit("/", 1)[0] + "/swiftui"
        kit = module.replace("swiftui", "uikit")
        a, b, c = (module + "/" + x for x in ("a", "b", "c"))

        def doc(links):
            return {
                "kind": "symbol",
                "metadata": {"title": "Test"},
                "topicSections": [{"anchor": "A group", "identifiers": links}],
                "references": {u: {"url": u} for u in links},
            }

        technology = {
            "kind": "technologies",
            "metadata": {},
            "sections": [
                {
                    "kind": "technologies",
                    "groups": [
                        {
                            "name": "App Frameworks",
                            "technologies": [
                                {"destination": {"identifier": u}}
                                for u in (module, kit)
                            ],
                        }
                    ],
                }
            ],
            "references": {u: {"url": u} for u in (module, kit)},
        }
        ddl = (
            Path(__file__)
            .with_name("postgresql_catalog.sql")
            .read_text()
            .split("GRANT SELECT")[0]
            + "COMMIT;"
        )
        sql(
            ddl
            + " CREATE TABLE pages(url text PRIMARY KEY,id uuid DEFAULT gen_random_uuid(),content text,raw_json jsonb,updated_at timestamptz DEFAULT now());"
        )
        for url, body, raw in [
            (module, "text", json.dumps(doc([a, b, c, a]))),
            (kit, "text", None),
            (a, "text", doc([])),
            (b, "", doc([a])),
            (c, "", doc([c])),
        ]:
            sql(
                "INSERT INTO pages(url,content,raw_json) VALUES ("
                + ",".join(
                    [
                        literal(url),
                        literal(body),
                        literal(json.dumps(raw)) + "::jsonb"
                        if raw is not None
                        else "NULL",
                    ]
                )
                + ");"
            )

        def children():
            return json.loads(
                sql(
                    "SELECT to_json(members) FROM catalog_nodes WHERE url="
                    + literal(module + "#A%20group")
                )
            )

        with (
            patch.dict(os.environ, env),
            patch.object(catalog, "PSQL", client),
            patch.object(
                catalog.urllib.request,
                "urlopen",
                side_effect=lambda *a, **k: io.BytesIO(json.dumps(technology).encode()),
            ),
        ):
            catalog.publish()
            self.assertEqual(children(), [a, b])
            self.assertEqual(
                sql(
                    "SELECT readable,child_count FROM catalog_nodes WHERE url="
                    + literal(b)
                ),
                "f|1",
            )
            self.assertEqual(
                sql(
                    "SELECT child_count IS NULL FROM catalog_nodes WHERE url="
                    + literal(kit)
                ),
                "t",
            )
            self.assertEqual(
                sql("SELECT count(*) FROM catalog_nodes WHERE url=" + literal(c)), "0"
            )
            with patch.object(
                catalog.urllib.request, "urlopen", side_effect=OSError("offline")
            ):
                sql(
                    "UPDATE pages SET raw_json="
                    + literal(json.dumps(doc([b, a])))
                    + ",updated_at=now() WHERE url="
                    + literal(module)
                )
                catalog.publish()
                self.assertEqual(children(), [b, a])
            sql("DELETE FROM pages WHERE url=" + literal(a))
            catalog.publish()
            self.assertEqual(
                sql(
                    "SELECT child_count FROM catalog_nodes WHERE url=" + literal(module)
                ),
                "0",
            )
            sql("DELETE FROM pages WHERE url=" + literal(kit))
            with self.assertRaises(RuntimeError):
                catalog.publish()
            self.assertEqual(
                sql("SELECT count(*) FROM catalog_nodes WHERE url=" + literal(kit)), "1"
            )


if __name__ == "__main__":
    unittest.main()
