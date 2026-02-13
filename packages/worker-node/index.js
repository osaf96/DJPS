const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const WORKER_ID = `worker-${uuidv4().slice(0, 8)}`;
const LEASE_SECONDS = 30;

const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "djps",
    password: process.env.PGPASSWORD || "djps",
    database: process.env.PGDATABASE || "djps",
});

async function claimJob(client) {
    await client.query("BEGIN");
    try {
        const result = await client.query(
            `
      SELECT *
      FROM jobs
      WHERE (
        status = 'queued'
        OR (status = 'running' AND lease_expires_at < now())
      )
      AND run_at <= now()
      ORDER BY run_at ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
      `
        );

        if (result.rowCount === 0) {
            await client.query("COMMIT");
            return null;
        }

        const job = result.rows[0];

        await client.query(
            `
      UPDATE jobs
      SET
        status = 'running',
        locked_by = $1,
        lease_expires_at = now() + ($2::int * interval '1 second'),
        attempts = attempts + 1,
        updated_at = now()
      WHERE id = $3
      `,
            [WORKER_ID, LEASE_SECONDS, job.id]
        );

        await client.query("COMMIT");
        return job;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
}

async function processJob(job) {
    console.log(`[${WORKER_ID}] Processing job ${job.id}`);

    // simulate work
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(`[${WORKER_ID}] Finished job ${job.id}`);
}

async function completeJob(jobId) {
    await pool.query(
        `
    UPDATE jobs
    SET
      status = 'succeeded',
      locked_by = NULL,
      lease_expires_at = NULL,
      updated_at = now()
    WHERE id = $1
    `,
        [jobId]
    );
}

async function workerLoop() {
    console.log(`${WORKER_ID} started`);

    while (true) {
        const client = await pool.connect();
        try {
            const job = await claimJob(client);

            if (!job) {
                client.release();
                await new Promise((r) => setTimeout(r, 1000));
                continue;
            }

            await processJob(job);
            await completeJob(job.id);
        } catch (err) {
            console.error("Worker Error:", err);
            throw err;
        } finally {
            try {
                client.release();
            } catch (_) { }
        }
    }
}

workerLoop();
