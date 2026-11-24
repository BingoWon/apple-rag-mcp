import assert from "node:assert/strict";
import test from "node:test";
import { parseUTCDate } from "../../shared/datetime.js";
import { formatAdminDateTime, formatAdminResponseTime } from "../lib/admin-utils.js";

test("admin timestamps normalize historical D1 and ISO dates into the same UTC+8 display", () => {
	for (const value of [
		"2026-11-03T02:10:20.093Z",
		"2026-11-03 02:10:20.093Z",
		"2026-11-03 02:10:20.093",
		"2026-11-03T10:10:20.093+08:00",
	]) {
		assert.equal(formatAdminDateTime(value), "2026-11-03 10:10:20");
	}
	for (const value of [null, undefined, "", "ZA", "broken"]) {
		assert.equal(formatAdminDateTime(value), "—");
	}
	assert.equal(formatAdminResponseTime(0), "0.0s");
	assert.equal(formatAdminResponseTime(null), "—");
	assert.equal(parseUTCDate(0)?.toISOString(), "1970-01-01T00:00:00.000Z");
	assert.equal(parseUTCDate({}), null);
});
