export interface User {
	id: string;
	email: string;
	name?: string;
	avatar?: string;
	password_hash?: string;
	provider?: string;
	tier?: string;
	created_at: string;
	updated_at?: string;
	reset_token?: string;
	reset_token_expires_at?: string;
}
