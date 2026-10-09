import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { AppleAPIClient } from "../../worker/collector/AppleAPIClient.ts";
import { ContentProcessor } from "../../worker/collector/ContentProcessor.ts";

const output = new URL("../server/data/collector-2026-10-09/socket-probe/", import.meta.url);
mkdirSync(output, { recursive: true, mode: 0o700 });
const command =
	"docker exec -i postgres_db psql -XAtq -v ON_ERROR_STOP=1 -U apple_rag_local_admin -d apple_rag_db";
const rows = JSON.parse(
	execFileSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "apple-rag", command], {
		input: `BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT coalesce(json_agg(item),'[]'::json) FROM (
  SELECT p.id,p.url,p.collect_count,p.created_at,p.updated_at,c.created_at AS chunk_transaction,
         jsonb_typeof(p.raw_json) AS stored_json_type
  FROM chunks c JOIN pages p ON p.url=c.url
  WHERE (c.created_at>='2026-10-09 12:05:00+00' AND c.created_at<'2026-10-09 12:06:10+00')
     OR (c.created_at>='2026-10-09 12:20:00+00' AND c.created_at<'2026-10-09 12:21:15+00')
  ORDER BY c.created_at,p.url
) item;
ROLLBACK;`,
		encoding: "utf8",
		timeout: 20000,
		maxBuffer: 4 * 1024 * 1024,
	}),
);
const api = new AppleAPIClient();
const processor = new ContentProcessor();
const records = [];
for (let offset = 0; offset < rows.length; offset += 4) {
	const batch = rows.slice(offset, offset + 4);
	const fetched = await api.fetchDocuments(batch.map((row) => row.url));
	if (fetched.some((item) => !item.data))
		throw new Error("Could not reconstruct every page response");
	const processed = await processor.processDocuments(fetched);
	for (const row of batch) {
		const source = fetched.find((item) => item.url === row.url);
		const parsed = processed.find((item) => item.url === row.url);
		if (!parsed?.data) throw new Error(`Content processing failed for ${row.url}`);
		const rawJson = JSON.stringify(source.data);
		const record = {
			...row,
			raw_json: rawJson,
			title: parsed.data.title,
			content: parsed.data.content,
			updated_at: new Date().toISOString(),
			raw_json_bytes: Buffer.byteLength(rawJson),
			jsonb_parameter_bytes: Buffer.byteLength(JSON.stringify(rawJson)),
			title_bytes: Buffer.byteLength(parsed.data.title || ""),
			content_bytes: Buffer.byteLength(parsed.data.content),
		};
		records.push(record);
		console.log(
			JSON.stringify({
				url: record.url,
				raw_json_bytes: record.raw_json_bytes,
				jsonb_parameter_bytes: record.jsonb_parameter_bytes,
				title_bytes: record.title_bytes,
				content_bytes: record.content_bytes,
			}),
		);
	}
}
writeFileSync(
	new URL("records.json", output),
	`${JSON.stringify(
		{
			reconstructed_at: new Date().toISOString(),
			note: "Fresh API responses for incident URLs; not an archived copy of the original failed packets.",
			records,
		},
		null,
		2,
	)}\n`,
	{ mode: 0o600 },
);
