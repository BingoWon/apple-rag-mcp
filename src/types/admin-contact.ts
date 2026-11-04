import type { AdminUserIdentity } from "../../worker/shared/admin-user";
export interface AdminContactMessage {
	id: string;
	user: AdminUserIdentity;
	can_reply: boolean;
	has_email: boolean;
	message: string;
	ip_address: string | null;
	admin_reply: string | null;
	replied_at: string | null;
	user_read_at: string | null;
	created_at: string;
}
