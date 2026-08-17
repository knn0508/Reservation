# Graph Report - Reservation  (2026-08-17)

## Corpus Check
- Corpus is ~10,849 words - fits in a single context window. You may not need a graph.

## Summary
- 441 nodes · 853 edges · 29 communities (27 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Booking Flow UI
- Reservation API & Service
- Frontend Dependencies
- Data Models & Schema
- Inventory & Worker Tests
- Realtime Holds & WS
- Backend Infra & Deps
- Availability & Holds API
- TS App Config
- TS Node Config
- Frontend Entry & Docs
- UI Icon Sprite
- Oxlint Config
- AI Notes Extraction
- Favicon Branding
- Vite Logo Asset
- Hero Illustration
- React Logo Asset
- TS Project References
- Reservation State Transitions

## God Nodes (most connected - your core abstractions)
1. `Reservation` - 23 edges
2. `TableCategory` - 21 edges
3. `compilerOptions` - 18 edges
4. `create_reservation()` - 15 edges
5. `compilerOptions` - 15 edges
6. `ReservationStatus` - 14 edges
7. `delay_reservation()` - 14 edges
8. `Base` - 13 edges
9. `complete_early()` - 12 edges
10. `seed_day()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `extract_notes()` --implements--> `Google Gemini Structured Note Extraction`  [EXTRACTED]
  backend/app/api/routes/ai.py → README.md
- `FastAPI Backend` --shares_data_with--> `fastapi==0.115.0`  [INFERRED]
  README.md → backend/requirements.txt
- `Redis (soft holds TTL + Celery broker/result backend)` --shares_data_with--> `redis service (redis:7)`  [INFERRED]
  README.md → backend/docker-compose.yml
- `Redis (soft holds TTL + Celery broker/result backend)` --shares_data_with--> `redis==5.0.8`  [INFERRED]
  README.md → backend/requirements.txt
- `React + Vite Frontend` --conceptually_related_to--> `React + TypeScript + Vite Template`  [INFERRED]
  README.md → frontend/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Atomic Concurrency-Safe Booking Engine** — readme_inventory_bucket_design, readme_atomic_ranged_update, backend_tests_test_concurrency, backend_app_api_routes_reservations_post [EXTRACTED 1.00]
- **Guest Booking Flow** — backend_app_api_routes_availability, backend_app_ws_availability, backend_app_api_routes_holds, backend_app_api_routes_reservations_post [EXTRACTED 1.00]
- **Local Dev Infrastructure (Postgres + Redis via Docker Compose)** — backend_docker_compose_yml, backend_docker_compose_postgres_service, backend_docker_compose_redis_service, readme_sqlalchemy_postgresql, readme_redis_soft_holds [EXTRACTED 1.00]

## Communities (29 total, 2 thin omitted)

### Community 0 - "Booking Flow UI"
Cohesion: 0.06
Nodes (56): App(), BookingWizard(), goTo(), handleSubmit(), Step, STEP_ORDER, variants, ConfirmationCard() (+48 more)

### Community 1 - "Reservation API & Service"
Cohesion: 0.13
Nodes (42): cancel_reservation(), complete_reservation(), create_reservation(), delay_reservation(), get_reservation(), no_show_reservation(), AsyncSession, datetime (+34 more)

### Community 2 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (41): framer-motion, dependencies, framer-motion, @phosphor-icons/react, react, react-dom, react-router-dom, @tanstack/react-query (+33 more)

### Community 3 - "Data Models & Schema"
Cohesion: 0.12
Nodes (25): do_run_migrations(), run_migrations_online(), get_reservation_or_404(), AsyncSession, Reservation, UUID, list_reservations_for_day(), list_tables() (+17 more)

### Community 4 - "Inventory & Worker Tests"
Cohesion: 0.10
Nodes (28): async_sessionmaker, Settings, decrement_range(), get_slots(), increment_range(), AsyncSession, date, datetime (+20 more)

### Community 5 - "Realtime Holds & WS"
Cohesion: 0.12
Nodes (24): availability_ws(), _ensure_listener(), date, websocket, get_redis(), count_active_holds(), create_hold(), _hold_key() (+16 more)

### Community 6 - "Backend Infra & Deps"
Cohesion: 0.09
Nodes (29): postgres service (postgres:16), redis service (redis:7), alembic==1.13.3, asyncpg==0.30.0, celery==5.4.0, email-validator==2.2.0, fastapi==0.115.0, google-generativeai==0.8.3 (+21 more)

### Community 7 - "Availability & Holds API"
Cohesion: 0.11
Nodes (22): get_availability(), AsyncSession, date, get, create_hold(), post, release_hold(), POST /api/reservations (+14 more)

### Community 8 - "TS App Config"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 9 - "TS Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 10 - "Frontend Entry & Docs"
Cohesion: 0.14
Nodes (14): Google Fonts (Fraunces, Outfit, JetBrains Mono), #root div mount point, Muğam Masası — Reservations (page title), Oxlint Configuration (type-aware, oxlint-tsgolint), React Compiler, React + TypeScript + Vite Template, @vitejs/plugin-react (Oxc), @vitejs/plugin-react-swc (SWC) (+6 more)

### Community 11 - "UI Icon Sprite"
Cohesion: 0.36
Nodes (9): Frontend UI iconography, Social media / external links concept, icons.svg (icon sprite sheet), bluesky-icon symbol, discord-icon symbol, documentation-icon symbol, github-icon symbol, social-icon symbol (people/network icon) (+1 more)

### Community 12 - "Oxlint Config"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 13 - "AI Notes Extraction"
Cohesion: 0.43
Nodes (6): extract_notes(), NotesExtractRequest, NotesExtractResponse, BaseModel, post, Turns a guest's free-text special request into structured booking fields via…

### Community 14 - "Favicon Branding"
Cohesion: 0.40
Nodes (5): frontend/public static assets directory, Faceted downward-right arrow/bolt glyph (purple, #863bff), Brand color palette: purple #863bff/#7e14ff, light lavender #ede6ff, cyan-blue #47bfff, Blurred purple/blue gradient blob texture masked inside glyph, favicon.svg (site favicon icon)

### Community 16 - "Vite Logo Asset"
Cohesion: 1.00
Nodes (3): frontend (project/app), Vite (build tool), Vite Logo (vite.svg)

### Community 17 - "Hero Illustration"
Cohesion: 0.67
Nodes (3): Brand purple gradient/texture color palette, Hero banner image (isometric card/device graphic), Frontend hero/landing section UI

### Community 18 - "React Logo Asset"
Cohesion: 0.67
Nodes (3): React (JavaScript library), react.svg (React logo asset), Vite React scaffold

## Knowledge Gaps
- **104 isolated node(s):** `Config`, `$schema`, `typescript`, `oxc`, `react/rules-of-hooks` (+99 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `React + Vite Frontend` connect `Frontend Entry & Docs` to `Backend Infra & Deps`, `Availability & Holds API`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `pytest / pytest-asyncio Concurrency Proof Test` connect `Backend Infra & Deps` to `Inventory & Worker Tests`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `TableCategory` connect `Data Models & Schema` to `Reservation API & Service`, `Inventory & Worker Tests`, `Realtime Holds & WS`, `Availability & Holds API`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `Reservation` (e.g. with `get_reservation_or_404()` and `list_reservations_for_day()`) actually correct?**
  _`Reservation` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `TableCategory` (e.g. with `DiningTable` and `Reservation`) actually correct?**
  _`TableCategory` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `create_reservation()` (e.g. with `ReservationEventType` and `ReservationStatus`) actually correct?**
  _`create_reservation()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Config`, `$schema`, `typescript` to the rest of the system?**
  _104 weakly-connected nodes found - possible documentation gaps or missing edges._