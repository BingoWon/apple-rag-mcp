export interface AdminUserIdentity {
	name: string | null;
	kind: "registered" | "anonymous" | "deleted";
	ip_suffix: string | null;
}
