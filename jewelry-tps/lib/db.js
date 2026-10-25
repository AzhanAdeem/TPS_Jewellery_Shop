import { Pool } from 'pg';

// Connection Pool: Database ke sath telephone lines ka set
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;