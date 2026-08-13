#!/bin/bash
set -e

# Add one entry per service as it gets its own database.
DATABASES=(
  "users_db"
  "products_db"
  "cart_db"
  "orders_db"
  "inventory_db"
  "notifications_db"
)

for db in "${DATABASES[@]}"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done
