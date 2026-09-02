import Stripe from "stripe";

export const STRIPE_API_VERSION = "2025-08-27.basil" as const;

export function createStripeClient(secretKey: string): Stripe {
	if (!secretKey) {
		throw new Error("STRIPE_SECRET_KEY is required");
	}
	return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}
