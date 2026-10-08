import assert from "node:assert/strict";
import test from "node:test";
import packageJson from "../../package.json";
import serverJson from "../../server.json";

test("release and MCP registry versions stay in sync", () => {
	assert.equal(serverJson.version, packageJson.version);
});
