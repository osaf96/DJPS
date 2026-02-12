const express = require("express")
const { Pool } = require("pg")
const { z } = require("zod")
const { v4: uuidv4 } = require("uuid")


const app = express();
app.use(express.json())

const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "djps",
    password: process.env.PGPASSWORD || "djps",
    database: process.env.PGDATABASE || "djps"
})

const CreateJobSchema = z.object({
    type: z.string().min(1),
    payload: z.unknown(),
    runAt: z.iso.datetime().optional(),
    priority: z.number().int().optional(),
    maxAttempts: z.number().int().min(1).max(100).optional(),
    dempotencyKey: z.string().min(1).optional(),
})

app.get("/health", async (_req, res) => {
    const r = await pool.query("SELECT 1 as ok");
    res.json({ ok: r.rows[0].ok === 1 });
});

// Create a job (idempotent if idempotencyKey is provided)

app.post("/jobs", async (req, res) => {
    const parsed = CreateJobSchema.safeParse(req.body)
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
    }
    console.log('PARSED',parsed)
    const { type, payload, runAt, priority, maxAttempts, idempotencyKey } =
        parsed.data;
    const id = uuidv4()

    try {

        const insertSql = ` INSERT INTO jobs (
        id, type, payload, run_at, priority, max_attempts, idempotency_key
      )
      VALUES (
        $1, $2, $3::jsonb,
        COALESCE($4::timestamptz, now()),
        COALESCE($5, 0),
        COALESCE($6, 5),
        $7
      )
      RETURNING *;
        `;
        const result = await pool.query(insertSql, [
            id,
            type,
            JSON.stringify(payload),
            runAt || null,
            priority ?? null,
            maxAttempts ?? null,
            idempotencyKey || null,
        ]);
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        // Postgres unique_violation = 23505
        // If idempotencyKey was provided and the unique index fired,
        // return the existing job instead of creating a duplicate.
        if (err.code === "23505" && idempotencyKey) {
            const existing = await pool.query(
                `SELECT * FROM jobs WHERE type = $1 AND idempotency_key = $2 LIMIT 1`,
                [type, idempotencyKey]
            );
            if (existing.rowCount === 1) {
                return res.status(200).json(existing.rows[0]);
            }
        }

        console.error(err);
        return res.status(500).json({ error: "internal_error" });
    }
});

app.get("/jobs/:id", async (req, res) => {
    const id = req.params;
    const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
        return res.status(404).json({ error: "not_found" })
    }
    return res.json(result.rows[0])
});


const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
})
