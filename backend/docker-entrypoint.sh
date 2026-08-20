#!/bin/sh
set -e

echo "Aplicando migrations pendentes..."
npx prisma migrate deploy

exec "$@"
