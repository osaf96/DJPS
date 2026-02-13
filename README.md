# Distributed Job Processing System (DJPS)

A durable, idempotent, Postgres-backed distributed job processing system built with Node.js.

This project explores core distributed systems concepts including:

- Idempotent job submission
- Durable state machines
- Transactional concurrency control
- Worker coordination via database locking
- Retry and failure semantics (upcoming)

---

## 🏗 Architecture Overview

Current architecture:

![alt text](https://github.com/osaf96/DJPS/blob/main/docs/architecture.png?raw=true)
```
Client
   ↓
API (Node.js, stateless)
   ↓
Postgres (durable job state machine)
```

Design principles:

- The API is stateless.
- Postgres is the single source of truth.
- Jobs are durable and survive crashes.
- Duplicate submissions are prevented via idempotency.

---

## 🚀 Features (Implemented)

- Dockerized PostgreSQL (Infrastructure as Code)
- Versioned SQL migrations
- Durable job storage
- Idempotent job creation using unique constraints
- JSONB-based flexible payload storage
- Input validation with Zod
- Health endpoint
- UUID-based distributed-safe job identifiers

---

## 📦 Tech Stack

- Node.js (Express)
- PostgreSQL 16
- Docker Compose
- Zod (request validation)
- UUID (unique identifiers)

---

## 📁 Project Structure

```
djps/
├── docker-compose.yml
├── db/
│   └── migrations/
│       └── 001_create_jobs.sql
├── packages/
│   └── api/
│       ├── index.js
│       └── package.json
└── docs/
```

---

## 🧠 Job Model

Each job represents a durable state machine.

### States

- queued
- running
- succeeded
- failed
- canceled
- dead

### Core Fields

- `id` (UUID)
- `type`
- `payload` (JSONB)
- `status`
- `run_at` (scheduling support)
- `attempts`
- `max_attempts`
- `idempotency_key`

---

## 🔁 Idempotency

Job creation supports idempotency via:

```sql
UNIQUE(type, idempotency_key)
```

This guarantees:

- Safe client retries
- No duplicate job creation
- Deterministic behavior under network failure

If the same `idempotencyKey` is submitted again for the same job type, the existing job is returned instead of creating a new one.

---

## 🐳 Running the Project

### 1️⃣ Start Postgres

```bash
docker compose up -d
```

### 2️⃣ Apply Migration

```bash
docker compose exec -T postgres psql -U djps -d djps < db/migrations/001_create_jobs.sql
```

### 3️⃣ Start API

```bash
cd packages/api
npm install
npm run dev
```

API runs at:

```
http://localhost:3000
```

---

## 🧪 Testing the API

### Health Check

```bash
curl http://localhost:3000/health
```

### Create Job (PowerShell)

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/jobs" `
  -ContentType "application/json" `
  -Body '{"type":"email_send","payload":{"to":"a@b.com"},"idempotencyKey":"abc-123"}'
```

Repeat the same request to verify idempotency.

### Fetch Job by ID

```bash
curl http://localhost:3000/jobs/<JOB_ID>
```

---

## 🧩 Why PostgreSQL?

Postgres acts as both:

- Durable job storage
- Distributed coordination mechanism

It provides:

- ACID guarantees
- Row-level locking
- Transactional consistency
- Crash recovery
- Unique constraints for idempotency

This makes it well-suited for correctness-first job processing systems.

---

## 📈 Next Steps

Planned enhancements:

- Worker implementation
- Atomic job claiming using:

```sql
FOR UPDATE SKIP LOCKED
```

- Retry logic with exponential backoff
- Lease / heartbeat mechanism
- Dead-letter queue
- Multi-worker concurrency testing
- Metrics & observability

---

## 🎯 Project Goals

This project focuses on understanding:

- Distributed coordination
- Concurrency control
- Idempotency patterns
- Transaction boundaries
- Reliable background processing
- Production-grade system design

It intentionally avoids heavy ORM abstractions to maintain full control over SQL and locking semantics.

---

## License

MIT
