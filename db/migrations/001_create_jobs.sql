DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed','canceled','dead');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          job_status NOT NULL DEFAULT 'queued',

  priority        INT NOT NULL DEFAULT 0,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,

  idempotency_key TEXT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_type_idempotency_key_uq
  ON jobs(type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_status_runat_idx ON jobs(status, run_at);

CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at);
