const { Client } = require('pg');
const crypto = require('crypto');

// Hash password with salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

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

    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        password_salt VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);

    // Create inbound_alerts table for SMS follow-up tracking
    console.log('Creating inbound_alerts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbound_alerts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        message TEXT,
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'unread',
        assigned_to UUID REFERENCES users(id),
        follow_up_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        read_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_inbound_alerts_status ON inbound_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_inbound_alerts_assigned ON inbound_alerts(assigned_to);
    `);

    // Create admin user
    console.log('Creating admin user...');
    const { salt, hash } = hashPassword('Solar2025$');

    await client.query(`
      INSERT INTO users (email, password_hash, password_salt, first_name, last_name, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = $2,
        password_salt = $3,
        role = $6,
        status = $7,
        updated_at = NOW()
    `, ['felipe@patagonusa.com', hash, salt, 'Felipe', 'Admin', 'admin', 'approved']);

    console.log('Admin user created: felipe@patagonusa.com');

    // Verify tables
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('All tables:', tables.rows.map(r => r.table_name));

    console.log('Auth setup complete!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

setup();
