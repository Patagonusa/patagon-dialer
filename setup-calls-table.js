const { Client } = require('pg');

async function setup() {
  const client = new Client({
    host: 'db.xyyxdqddfdrmvgzyrvba.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '121812754_2025#',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create calls table for call history
    console.log('Creating calls table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
        from_number VARCHAR(20),
        to_number VARCHAR(20),
        status VARCHAR(50),
        duration INTEGER DEFAULT 0,
        recording_url TEXT,
        recording_sid VARCHAR(100),
        call_sid VARCHAR(100) UNIQUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ended_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
      CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
      CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
      CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
      CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    `);

    console.log('Calls table created successfully!');

    // Verify tables
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('All tables:', tables.rows.map(r => r.table_name));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

setup();
