export interface User {
	id: string;
	email: string;
	name?: string;
	avatar?: string;
	password_hash?: string;
	provider: string;
	provider_id?: string;
	oauth_provider?: string;
	oauth_id?: string;
	stripe_customer_id?: string;
	reset_token?: string;
	reset_token_expires_at?: string;
	last_login?: string;
	created_at: string;
	updated_at: string;
}
