#!/usr/bin/env bash
# Applies every migration in supabase/migrations to a throwaway local Postgres
# and runs supabase/tests/rls_test.sql against it. Needs Postgres 15+ installed
# (initdb, pg_ctl, psql); it never touches your real Supabase project.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v initdb >/dev/null 2>&1; then
  pgbin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$pgbin" ] && export PATH="$pgbin:$PATH"
fi
command -v initdb >/dev/null || { echo "Postgres binaries not found (initdb). Install Postgres 15+."; exit 1; }
bin="$(dirname "$(command -v initdb)")"

workdir="$(mktemp -d)"
port=$(( 20000 + RANDOM % 20000 ))
cleanup() { run "$bin/pg_ctl -D '$workdir/data' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$workdir"; }
trap cleanup EXIT

# Postgres refuses to run as root, so drop to the "postgres" user when needed.
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown -R postgres "$workdir"

run "$bin/initdb -D '$workdir/data' -U postgres --auth=trust >/dev/null"
run "$bin/pg_ctl -D '$workdir/data' -o '-p $port -k $workdir -c listen_addresses=' -l '$workdir/log' -w start >/dev/null"

psql_run() { run "$bin/psql -X -q -v ON_ERROR_STOP=1 -h '$workdir' -p $port -U postgres -d postgres -f '$1'"; }

psql_run "$root/supabase/tests/auth_stub.sql"
for f in "$root"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  psql_run "$f"
done
psql_run "$root/supabase/tests/rls_test.sql"
