#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" != "false" ]; then
  alembic upgrade head
fi

if [ "$RUN_SEED" = "true" ]; then
  python -m scripts.seed
fi

exec "$@"
