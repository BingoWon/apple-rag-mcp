import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
	if (!stripePromise) {
		stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);
	}
	return stripePromise;
};

export const stripeConfig = {
	publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!,
	isProduction: process.env.NODE_ENV === "production",
} as const;
