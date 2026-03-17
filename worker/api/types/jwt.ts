/**
 * JWT related types and interfaces
 */

export interface JWTPayload {
	sub: string; // user_id
	email: string; // user email
	name?: string; // user name
	avatar?: string; // user avatar
	created_at?: string; // user creation date
	plan_type: string; // subscription plan (hobby/pro/enterprise)
	permissions: string[]; // permissions list
	iat: number; // issued at
	exp: number; // expires at
	jti: string; // JWT ID (session ID)
}

export interface TokenPair {
	access_token: string;
	refresh_token?: string;
	expires_at: string;
	token_type: "Bearer";
}

export interface RefreshTokenPayload {
	sub: string; // user_id
	jti: string; // session_id
	type: "refresh";
	iat: number;
	exp: number;
}
