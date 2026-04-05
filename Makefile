.PHONY: dev build lint format test clean install

# ── Development ──
dev:
	npm run dev

dev-backend:
	npm run dev:backend

dev-frontend:
	npm run dev:frontend

# ── Build ──
build:
	npm run build

build-backend:
	npm run build:backend

build-frontend:
	npm run build:frontend

# ── Quality ──
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

typecheck:
	npm run typecheck

test:
	npm run test

validate:
	npm run validate

# ── Setup ──
install:
	npm run install:all

clean:
	npm run clean
