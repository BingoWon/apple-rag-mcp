-- Apple RAG Database Schema
-- Cloudflare D1 (SQLite)
-- Last updated: 2025-11-26

-- ============================================================
-- USERS TABLE
-- Primary user authentication and profile table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT,
    avatar TEXT,
    provider TEXT NOT NULL DEFAULT 'email',
    provider_id TEXT,
    oauth_provider TEXT,
    oauth_id TEXT,
    stripe_customer_id TEXT,
    reset_token TEXT,
    reset_token_expires_at TEXT,
    last_login TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

-- ============================================================
-- MCP TOKENS TABLE
-- MCP token management for API access control
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mcp_token TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user_id ON mcp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_token ON mcp_tokens(mcp_token);

-- ============================================================
-- SEARCH LOGS TABLE
-- Tracks search operations for usage monitoring and rate limiting
-- ============================================================
CREATE TABLE IF NOT EXISTS search_logs (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT NOT NULL,
    mcp_token TEXT,
    requested_query TEXT NOT NULL,
    actual_query TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_code TEXT,
    ip_address TEXT,
    country_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_country ON search_logs(country_code);

-- ============================================================
-- FETCH LOGS TABLE
-- Tracks fetch operations for usage monitoring and rate limiting
-- ============================================================
CREATE TABLE IF NOT EXISTS fetch_logs (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT NOT NULL,
    mcp_token TEXT,
    requested_url TEXT NOT NULL,
    actual_url TEXT,
    page_id TEXT,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_code TEXT,
    ip_address TEXT,
    country_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fetch_logs_user_id ON fetch_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_created_at ON fetch_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_country ON fetch_logs(country_code);

-- ============================================================
-- USER SUBSCRIPTIONS TABLE
-- Stripe integration and subscription lifecycle tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_type TEXT DEFAULT 'hobby',
    status TEXT DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    price REAL DEFAULT 0,
    billing_interval TEXT DEFAULT 'month',
    stripe_price_id TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_price_id ON user_subscriptions(stripe_price_id);

-- ============================================================
-- USER AUTHORIZED IPS TABLE
-- IP-based authentication and access control
-- ============================================================
CREATE TABLE IF NOT EXISTS user_authorized_ips (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    name TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_authorized_ips_lookup ON user_authorized_ips(ip_address, user_id);
CREATE INDEX IF NOT EXISTS idx_user_authorized_ips_user_id ON user_authorized_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_authorized_ips_last_used ON user_authorized_ips(last_used_at);

-- ============================================================
-- CONTACT MESSAGES TABLE
-- Contact form submissions with bidirectional messaging support
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
    user_id TEXT,
    email TEXT,
    message TEXT NOT NULL,
    ip_address TEXT,
    admin_reply TEXT,
    replied_at TEXT,
    user_read_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_replied_at ON contact_messages(replied_at DESC);

