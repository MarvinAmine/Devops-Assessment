# app – Local Docker Dev Environment

This folder contains the Docker setup for the Express + TypeScript app.

The container is built with a multi-stage Dockerfile to keep the runtime image small and production-ready, while still being easy to run locally.

---

## Prerequisites

- Docker
- Docker Compose (v2: `docker compose`, or v1: `docker-compose`)

From the repo root, you should have:

- `package.json`, `tsconfig.json`, `src/`
- `app/Dockerfile`
- `app/docker-compose.yml`
- `.dockerignore`

---

## Build & Run Locally

From the `app/` folder:

```bash
cd app
docker compose up --build
