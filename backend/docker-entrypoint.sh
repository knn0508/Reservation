#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" != "false" ]; then
  alembic upgrade head
fi

if [ "$RUN_SEED" = "true" ]; then
  python -m scripts.seed
  python -m scripts.seed_menu
  python -m scripts.seed_sales
fi

exec "$@"
