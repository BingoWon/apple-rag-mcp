const API_BASE_URL = "/api";

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
	if (typeof window === "undefined") return null;

	// Check direct localStorage token
	const directToken = localStorage.getItem("token");

	// Check auth-storage (Zustand persist)
	try {
		const authStorage = localStorage.getItem("auth-storage");
		if (authStorage) {
			const parsed = JSON.parse(authStorage);
			const zustandToken = parsed.state?.token;
			if (zustandToken) {
				return zustandToken;
			}
		}
	} catch (_error) {
		// Silently handle parsing errors
	}

	return directToken;
};

export const api = {
	stripe: {
		createCheckoutSession: async (priceId: string): Promise<{ url: string }> => {
			const token = getAuthToken();

			if (!token) {
				throw new Error("Authentication required. Please log in.");
			}

			const response = await fetch(`${API_BASE_URL}/stripe/checkout`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					priceId,
					cancelUrl: window.location.href,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error || `Failed to create checkout session (${response.status})`,
				);
			}

			return response.json();
		},

		getSubscription: async () => {
			const token = getAuthToken();

			if (!token) {
				throw new Error("Authentication required. Please log in.");
			}

			const response = await fetch(`${API_BASE_URL}/stripe/subscription`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `Failed to fetch subscription (${response.status})`);
			}

			return response.json();
		},

		createBillingPortalSession: async () => {
			const token = getAuthToken();

			if (!token) {
				throw new Error("Authentication required. Please log in.");
			}

			const response = await fetch(`${API_BASE_URL}/stripe/billing-portal`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error || `Failed to create billing portal session (${response.status})`,
				);
			}

			return response.json();
		},
	},
};
