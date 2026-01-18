-- Patagon Dialer Database Migration v2
-- Run this in Supabase SQL Editor

-- 1. Add lead_number (user-friendly sequential number) to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_number SERIAL;

-- Create unique index for lead_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_number ON leads(lead_number);

-- 2. Create vendors table (for material suppliers)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_number SERIAL UNIQUE,
  name VARCHAR(200) NOT NULL,
  company VARCHAR(200),
  phone VARCHAR(20),
  phone2 VARCHAR(20),
  email VARCHAR(200),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  category VARCHAR(100), -- e.g., 'roofing', 'materials', 'electrical'
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);

-- 3. Create projects table (linked to leads)
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number SERIAL UNIQUE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_number ON projects(project_number);

-- 4. Create project_vendors junction table (vendors assigned to projects)
CREATE TABLE IF NOT EXISTS project_vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  role VARCHAR(100), -- e.g., 'material supplier', 'subcontractor'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_project_vendors_project_id ON project_vendors(project_id);
CREATE INDEX IF NOT EXISTS idx_project_vendors_vendor_id ON project_vendors(vendor_id);

-- 5. Create vendor_messages table (SMS history with vendors)
CREATE TABLE IF NOT EXISTS vendor_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
  message TEXT NOT NULL,
  phone VARCHAR(20),
  twilio_sid VARCHAR(50),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_messages_vendor_id ON vendor_messages(vendor_id);

-- 6. Add last_disposition column to leads for faster filtering
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_disposition VARCHAR(50);

-- 7. Create lead_vendor_dispatch table (track dispatches to vendors from leads)
CREATE TABLE IF NOT EXISTS lead_vendor_dispatches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  message TEXT,
  twilio_sid VARCHAR(50),
  status VARCHAR(50) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_vendor_dispatches_lead_id ON lead_vendor_dispatches(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_vendor_dispatches_vendor_id ON lead_vendor_dispatches(vendor_id);

-- Update existing leads to have lead_numbers (backfill)
-- This will automatically assign sequential numbers based on created_at order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM leads
  WHERE lead_number IS NULL OR lead_number = 0
)
UPDATE leads SET lead_number = numbered.rn
FROM numbered WHERE leads.id = numbered.id;

-- Reset sequence to max value + 1
SELECT setval('leads_lead_number_seq', COALESCE((SELECT MAX(lead_number) FROM leads), 0) + 1, false);
SELECT setval('vendors_vendor_number_seq', COALESCE((SELECT MAX(vendor_number) FROM vendors), 0) + 1, false);
SELECT setval('projects_project_number_seq', COALESCE((SELECT MAX(project_number) FROM projects), 0) + 1, false);
