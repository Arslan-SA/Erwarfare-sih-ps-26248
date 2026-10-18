# Makefile for SIH26248 Immersive Multi-Domain Decision-Making Trainer

.PHONY: help install run-demo test test-backend test-frontend build lint docker-up docker-down clean

help:
	@echo "Available commands for SIH-26248 Tactical Simulation Platform:"
	@echo "  make install       - Install Python and Node dependencies"
	@echo "  make run-demo      - Start complete stack (FastAPI Backend + Vite Frontend) locally"
	@echo "  make test          - Run full end-to-end and unit test suites"
	@echo "  make build         - Compile and bundle frontend & backend artifacts"
	@echo "  make lint          - Run static analyzers (oxlint, ruff/flake8, mypy)"
	@echo "  make docker-up     - Launch containerized platform via Docker Compose"
	@echo "  make docker-down   - Terminate and clean Docker Compose containers"
	@echo "  make clean         - Clear temporary caches, pycache, dist folders"

install:
	@echo "Installing backend dependencies..."
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -e .
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

run-demo:
	@echo "====================================================================="
	@echo "   SIH26248 IMMERSIVE MULTI-DOMAIN DECISION-MAKING TRAINER (DEMO)   "
	@echo "====================================================================="
	@echo "Starting FastAPI authoritative backend on http://localhost:8000"
	@echo "Starting React tactical HUD frontend on http://localhost:5173"
	@echo "Press Ctrl+C to stop both servers."
	@echo "====================================================================="
	@trap 'kill 0' EXIT; \
	(cd backend && . .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) & \
	(cd frontend && npm run dev) & \
	wait

test: test-backend test-frontend
	@echo "All tests passed successfully!"

test-backend:
	@echo "Running backend test suite (unit, EW degradation, clock, AAR, E2E)..."
	cd backend && . .venv/bin/activate && pytest -v

test-frontend:
	@echo "Running frontend typecheck & build validation..."
	cd frontend && npm run build
	@echo "Running frontend linter..."
	cd frontend && npm run lint

build:
	@echo "Building production frontend bundle..."
	cd frontend && npm run build

lint:
	cd frontend && npm run lint

docker-up:
	docker compose up --build -d
	@echo "Platform running! Frontend: http://localhost:5173 | Backend: http://localhost:8000/docs"

docker-down:
	docker compose down -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	rm -rf frontend/dist
