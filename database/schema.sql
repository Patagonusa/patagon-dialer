-- Patagon Dialer Database Schema
-- Run this in Supabase SQL Editor

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
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

-- Create index on phone numbers for quick lookup
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_phone2 ON leads(phone2);
CREATE INDEX IF NOT EXISTS idx_leads_phone3 ON leads(phone3);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- Conversations table (SMS history)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
  message TEXT NOT NULL,
  phone VARCHAR(20),
  twilio_sid VARCHAR(50),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- Dispositions table
CREATE TABLE IF NOT EXISTS dispositions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  disposition_type VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispositions_lead_id ON dispositions(lead_id);

-- Salespeople table
CREATE TABLE IF NOT EXISTS salespeople (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(200),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
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

CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_salesperson_id ON appointments(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Enable Row Level Security (RLS) - optional, can be configured later
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE salespeople ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Insert some default disposition types as reference (you can customize these)
-- Common dispositions:
-- 'appointment_set' - Appointment was scheduled
-- 'not_interested' - Customer not interested
-- 'callback' - Customer requested callback
-- 'no_answer' - No answer
-- 'wrong_number' - Wrong number
-- 'voicemail' - Left voicemail
-- 'busy' - Line was busy
-- 'disconnected' - Number disconnected
