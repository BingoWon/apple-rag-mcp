import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { getStripe } from "@/lib/stripe";
import type { PricingPlan } from "@/types";

interface CheckoutFormProps {
	plan: PricingPlan;
	clientSecret: string;
	onSuccess?: () => void;
}

function CheckoutFormInner({ plan, onSuccess }: Omit<CheckoutFormProps, "clientSecret">) {
	const stripe = useStripe();
	const elements = useElements();
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!stripe || !elements) {
			return;
		}

		setIsLoading(true);

		try {
			const { error } = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${window.location.origin}/billing?success=true`,
				},
			});

			if (error) {
				toast.error(`Payment failed\n${error.message || "An error occurred during payment"}`);
			} else {
				onSuccess?.();
			}
		} catch (_error) {
			toast.error("Payment failed\nAn unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="bg-gray-50 rounded-lg p-4">
				<h3 className="font-medium text-gray-900">{plan.name} Plan</h3>
				<p className="text-sm text-gray-600 mt-1">{plan.description}</p>
				<div className="mt-2">
					<span className="text-2xl font-bold text-gray-900">${plan.price}</span>
					<span className="text-gray-600">/{plan.interval}</span>
				</div>
			</div>

			<PaymentElement />

			<Button type="submit" disabled={!stripe || isLoading} loading={isLoading} className="w-full">
				{isLoading ? "Processing..." : `Subscribe to ${plan.name}`}
			</Button>

			<p className="text-xs text-gray-500 text-center">
				By subscribing, you agree to our Terms of Service and Privacy Policy. You can cancel your
				subscription at any time.
			</p>
		</form>
	);
}

export function CheckoutForm({ plan, clientSecret, onSuccess }: CheckoutFormProps) {
	const stripePromise = getStripe();

	const options = {
		clientSecret,
		appearance: {
			theme: "stripe" as const,
			variables: {
				colorPrimary: "rgb(from var(--color-brand-secondary) r g b)",
				colorBackground: "#ffffff",
				colorText: "#1f2937",
				colorDanger: "#ef4444",
				fontFamily: '"Inter", "Noto Sans SC", system-ui, sans-serif',
				spacingUnit: "4px",
				borderRadius: "6px",
			},
		},
	};

	return (
		<Elements stripe={stripePromise} options={options}>
			<CheckoutFormInner plan={plan} onSuccess={onSuccess} />
		</Elements>
	);
}
