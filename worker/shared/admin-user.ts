export interface AdminSubscription {
	plan: "hobby" | "pro" | "enterprise";
	billing_interval: string | null;
	payment_type: string | null;
}
export interface AdminUserIdentity {
	name: string | null;
	kind: "registered" | "anonymous" | "deleted";
	ip_suffix: string | null;
	subscription: AdminSubscription;
}
