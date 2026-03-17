/**
 * Modern Type-Safe Configuration Interface
 * Immutable configuration for high-performance MCP server
 */
export interface AppConfig {
	// Server Configuration
	readonly PORT: number;
	readonly NODE_ENV: "development" | "production";

	// Cloudflare D1 Configuration (for token validation)
	readonly CLOUDFLARE_ACCOUNT_ID: string;
	readonly CLOUDFLARE_API_TOKEN: string;
	readonly CLOUDFLARE_D1_DATABASE_ID: string;

	// Database Configuration (for embeddings only)
	readonly EMBEDDING_DB_HOST: string;
	readonly EMBEDDING_DB_PORT: number;
	readonly EMBEDDING_DB_DATABASE: string;
	readonly EMBEDDING_DB_USER: string;
	readonly EMBEDDING_DB_PASSWORD: string;
	readonly EMBEDDING_DB_SSLMODE: "disable" | "require";
}
