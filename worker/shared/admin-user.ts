export interface AdminUserIdentity {
	name: string | null;
	kind: "registered" | "anonymous" | "deleted";
	alias: string;
}
