// seed.js
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "djps",
    password: process.env.PGPASSWORD || "djps",
    database: process.env.PGDATABASE || "djps",
});

async function main() {
    const N = Number(process.argv[2] || 200);
    const JOB_TYPE = process.argv[3] || "test";
    const values = [];
    const params = [];
    let p = 1;

    for (let i = 0; i < N; i++) {
        const id = uuidv4();
        const payload = JSON.stringify({ index: i });

        values.push( `($${p++}::uuid, $${p++}::text, $${p++}::jsonb, 'queued', now(), 0, 25, now(), now())`);

        params.push(id, JOB_TYPE, payload);
    }

    await pool.query(
        `
        INSERT INTO jobs (id,type, payload, status, run_at, attempts, max_attempts, created_at, updated_at)
        VALUES ${values.join(",")}
    `,
        params
    );

    console.log(`Inserted ${N} jobs`);
    await pool.end()
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
