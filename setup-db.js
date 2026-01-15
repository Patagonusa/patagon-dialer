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

    // Check existing tables
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Existing tables:', tables.rows.map(r => r.table_name));

    // Drop ALL tables
    console.log('Dropping all tables...');
    await client.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `);

    // Create fresh Patagon Dialer tables
    console.log('Creating new tables...');
    await client.query(`
      CREATE TABLE leads (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        phone VARCHAR(20),
        phone2 VARCHAR(20),
        phone3 VARCHAR(20),
        job_group VARCHAR(200),
        lead_date DATE,
        source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE conversations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        direction VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        phone VARCHAR(20),
        twilio_sid VARCHAR(50),
        status VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE dispositions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        disposition_type VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE salespeople (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(200),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE appointments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        salesperson_id UUID REFERENCES salespeople(id),
        appointment_date DATE NOT NULL,
        appointment_time TIME,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'scheduled',
        dispatched_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_leads_phone ON leads(phone);
      CREATE INDEX idx_leads_status ON leads(status);
      CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
      CREATE INDEX idx_appointments_lead_id ON appointments(lead_id);
    `);

    // Verify
    const newTables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('New tables created:', newTables.rows.map(r => r.table_name));

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

setup();
