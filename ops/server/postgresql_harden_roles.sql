\set ON_ERROR_STOP on

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apple_rag_local_admin') THEN
		EXECUTE
			'CREATE ROLE apple_rag_local_admin '
			'LOGIN SUPERUSER CREATEDB CREATEROLE '
			'NOINHERIT NOREPLICATION NOBYPASSRLS';
	END IF;
END
$$;

ALTER ROLE apple_rag_local_admin PASSWORD NULL;

DO $$
DECLARE
	app_password text;
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_roles
		WHERE rolname = 'apple_rag_user'
			AND rolsuper
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_roles
		WHERE rolname = 'apple_rag_owner'
	) THEN
		SELECT rolpassword
		INTO STRICT app_password
		FROM pg_authid
		WHERE rolname = 'apple_rag_user';

		EXECUTE 'ALTER ROLE apple_rag_user RENAME TO apple_rag_owner';
		EXECUTE format(
			'CREATE ROLE apple_rag_user LOGIN NOSUPERUSER NOCREATEDB '
			'NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
			app_password
		);
	END IF;
END
$$;

ALTER ROLE apple_rag_owner NOLOGIN PASSWORD NULL;
ALTER ROLE apple_rag_user
	NOSUPERUSER
	NOCREATEDB
	NOCREATEROLE
	NOREPLICATION
	NOBYPASSRLS;

GRANT CONNECT ON DATABASE apple_rag_db TO apple_rag_user;
GRANT USAGE ON SCHEMA public TO apple_rag_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO apple_rag_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO apple_rag_user;

ALTER DEFAULT PRIVILEGES FOR ROLE apple_rag_owner IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO apple_rag_user;
ALTER DEFAULT PRIVILEGES FOR ROLE apple_rag_owner IN SCHEMA public
	GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO apple_rag_user;
