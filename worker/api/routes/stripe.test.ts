import assert from "node:assert/strict";
import test from "node:test";
import { mapStripeStatus } from "./stripe.js";

test("maps Stripe subscription statuses to valid local values", () => {
	assert.equal(mapStripeStatus("active"), "active");
	assert.equal(mapStripeStatus("trialing"), "active");
	assert.equal(mapStripeStatus("canceled"), "canceled");
	assert.equal(mapStripeStatus("paused"), "canceled");
	assert.equal(mapStripeStatus("unpaid"), "past_due");
	assert.equal(mapStripeStatus("incomplete"), "inactive");
});
