export interface Env {
	// Cloudflare Bindings
	DB: D1Database;
	ASSETS: Fetcher;

	// Environment
	ENVIRONMENT: "development" | "production";

	// API: Authentication secrets
	JWT_SECRET: string;
	ADMIN_PASSWORD: string;

	// API: Stripe Configuration
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	STRIPE_PRICE_ID_PRO_WEEKLY: string;
	STRIPE_PRICE_ID_PRO_MONTHLY: string;
	STRIPE_PRICE_ID_PRO_SEMIANNUAL: string;
	STRIPE_PRICE_ID_PRO_ANNUAL: string;
	STRIPE_PRICE_ID_PRO_ONETIME_WEEKLY: string;
	STRIPE_PRICE_ID_PRO_ONETIME_MONTHLY: string;
	STRIPE_PRICE_ID_PRO_ONETIME_SEMIANNUAL: string;
	STRIPE_PRICE_ID_PRO_ONETIME_ANNUAL: string;

	// API: OAuth
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;

	// API: Email (Resend)
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;

	// RAG Database (PostgreSQL - shared by MCP + Collector)
	RAG_DB_HOST: string;
	RAG_DB_PORT: string;
	RAG_DB_DATABASE: string;
	RAG_DB_USER: string;
	RAG_DB_PASSWORD: string;
	RAG_DB_SSLMODE: string;

	// DeepInfra (shared by MCP + Collector)
	DEEPINFRA_API_KEY: string;

	// Collector Configuration
	BATCH_SIZE?: string;
	BATCH_COUNT?: string;
	FORCE_UPDATE_ALL?: string;

	// Telegram Notifications
	TELEGRAM_DEFAULT_BOT_URL?: string;
	TELEGRAM_ALERT_BOT_URL?: string;
	TELEGRAM_STATS_BOT_URL?: string;
}

export interface AppEnv {
	Bindings: Env;
	Variables: {
		user: {
			id: string;
			email: string;
			name?: string;
		};
		userId: string;
		permissions: string[];
		plan_type: string;
		mcpToken: string;
	};
}
