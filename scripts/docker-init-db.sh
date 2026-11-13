#!/bin/sh
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_password="$POSTGRES_APP_PASSWORD" \
  --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" <<'SQL'
CREATE ROLE suivi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
CREATE ROLE suivi_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migration_password';
ALTER DATABASE suivi_dev OWNER TO suivi_migrator;
GRANT CONNECT ON DATABASE suivi_dev TO suivi_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO suivi_app;
ALTER ROLE suivi_bootstrap NOLOGIN;
SQL
