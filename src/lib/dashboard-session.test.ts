import assert from "node:assert/strict";
import test from "node:test";
import { resetDashboard, useDashboardStore } from "../stores/dashboard";
import { api } from "./api";

test("a completed request from a signed-out account cannot repopulate dashboard credentials", async (t) => {
	const { promise, resolve } =
		Promise.withResolvers<Awaited<ReturnType<typeof api.getMCPTokens>>>();
	t.mock.method(api, "getMCPTokens", () => promise);
	const old = useDashboardStore.getState().fetchMCPTokens();
	resetDashboard();
	resolve({ success: true, data: [{ id: "old", name: "Old device" }] });
	assert.equal(await old, false);
	assert.deepEqual(useDashboardStore.getState().mcpTokens, []);
});
