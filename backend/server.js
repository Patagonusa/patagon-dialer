require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'patagon-dialer-secret-key-2025';

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Twilio credentials
const TWILIO_ACCOUNT_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY || TWILIO_ACCOUNT_SID;
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET || TWILIO_AUTH_TOKEN;
const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID || '';
const TWILIO_PHONE = process.env.TWILIO_PHONE;

// Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Track online clients (in-memory store)
const onlineClients = new Map(); // identity -> { userId, lastSeen }

// Multer for file uploads (limit to 10MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==================== AUTH HELPERS ====================

function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, hash, salt) {
  const { hash: newHash } = hashPassword(password, salt);
  return hash === newHash;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin middleware
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ==================== AUTH ENDPOINTS ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact administrator.' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    if (!verifyPassword(password, user.password_hash, user.password_salt)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register (requires admin approval)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const { salt, hash } = hashPassword(password);

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: hash,
        password_salt: salt,
        first_name,
        last_name,
        role: 'user',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Registration successful. Please wait for admin approval.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USER MANAGEMENT (Admin Only) ====================

// Get all users
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve user
app.post('/api/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'User approved', user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject/Disable user
app.post('/api/users/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'User rejected', user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user role
app.put('/api/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend user (remove access)
app.post('/api/users/:id/suspend', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow suspending yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot suspend yourself' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'User suspended', user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate user (restore access)
app.post('/api/users/:id/reactivate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'User reactivated', user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== INBOUND ALERTS ENDPOINTS ====================

// Get all inbound alerts (unread messages)
app.get('/api/inbound-alerts', authMiddleware, async (req, res) => {
  try {
    const { status = 'unread' } = req.query;

    let query = supabase
      .from('inbound_alerts')
      .select(`
        *,
        leads (id, first_name, last_name, phone, status)
      `)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark alert as read
app.post('/api/inbound-alerts/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('inbound_alerts')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
        assigned_to: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set follow-up time for alert
app.post('/api/inbound-alerts/:id/follow-up', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { follow_up_at } = req.body;

    const { data, error } = await supabase
      .from('inbound_alerts')
      .update({
        follow_up_at,
        status: 'follow_up',
        assigned_to: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get count of unread alerts
app.get('/api/inbound-alerts/count', authMiddleware, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('inbound_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');

    if (error) throw error;

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== LEADS ENDPOINTS ====================

// Get all leads with optional filters
app.get('/api/leads', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      disposition,
      search,
      date,
      sort = 'created_at',
      order = 'desc',
      page = 1,
      limit = 25
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Disposition filter (last disposition)
    if (disposition && disposition !== 'all') {
      query = query.eq('last_disposition', disposition);
    }

    // Date filter (lead_date)
    if (date) {
      query = query.eq('lead_date', date);
    }

    // Search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      leads: data,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search leads by phone number
app.get('/api/leads/search', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone || phone.length < 7) {
      return res.json([]);
    }

    // Normalize: get last 10 digits
    const normalized = phone.replace(/\D/g, '').slice(-10);

    // Search in phone, phone2, phone3 fields
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.ilike.%${normalized}%,phone2.ilike.%${normalized}%,phone3.ilike.%${normalized}%`)
      .limit(5);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error searching leads by phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single lead by ID
app.get('/api/leads/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create lead manually
app.post('/api/leads', authMiddleware, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone,
      phone2,
      phone3,
      address,
      city,
      state,
      zip,
      job_group,
      source,
      lead_date
    } = req.body;

    if (!first_name || !phone) {
      return res.status(400).json({ error: 'First name and phone are required' });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        first_name,
        last_name: last_name || '',
        phone,
        phone2: phone2 || null,
        phone3: phone3 || null,
        address: address || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        job_group: job_group || '',
        source: source || 'Manual',
        lead_date: lead_date || new Date().toISOString().split('T')[0],
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update lead
app.put('/api/leads/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete lead (Admin only)
app.delete('/api/leads/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete leads' });
    }

    // Delete related records first (appointments, dispositions, etc.)
    await supabase.from('appointments').delete().eq('lead_id', id);
    await supabase.from('lead_vendor_dispatches').delete().eq('lead_id', id);

    // Delete the lead
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add note to lead
app.post('/api/leads/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    // Get current notes
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('notes')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const timestamp = new Date().toISOString();
    const userName = `${req.user.email}`;
    const newNote = `[${timestamp} - ${userName}] ${note}`;
    const updatedNotes = lead.notes ? `${lead.notes}\n${newNote}` : newNote;

    const { data, error } = await supabase
      .from('leads')
      .update({ notes: updatedNotes, updated_at: timestamp })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to find column value with flexible naming
function getColumnValue(row, possibleNames) {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined) return row[name];
    // Try case-insensitive match
    const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
    if (key) return row[key];
  }
  return '';
}

// Convert Excel serial date to JS Date
function parseExcelDate(value) {
  if (!value) return null;

  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    // Excel serial date: days since 1900-01-01 (with a bug for 1900 leap year)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  // If it's already a string date, try to parse it
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return value; // Return as-is if can't parse
  }

  return null;
}

// Upload Excel/CSV file (Admin Only)
app.post('/api/leads/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Uploading file:', req.file.originalname, 'Size:', req.file.size);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Parsed rows:', jsonData.length);
    if (jsonData.length > 0) {
      console.log('Column headers:', Object.keys(jsonData[0]));
    }

    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    const leads = jsonData.map((row, index) => {
      // Flexible column name matching
      const name = getColumnValue(row, ['Name', 'Nombre', 'Full Name', 'FullName', 'Customer Name', 'Lead Name']);
      const firstName = getColumnValue(row, ['First Name', 'FirstName', 'First', 'Nombre']);
      const lastName = getColumnValue(row, ['Last Name', 'LastName', 'Last', 'Apellido']);

      // If we have a full name but not separate first/last, split it
      let finalFirstName = firstName;
      let finalLastName = lastName;
      if (name && !firstName && !lastName) {
        const nameParts = String(name).trim().split(' ');
        finalFirstName = nameParts[0] || '';
        finalLastName = nameParts.slice(1).join(' ') || '';
      }

      return {
        first_name: String(finalFirstName || '').substring(0, 100),
        last_name: String(finalLastName || '').substring(0, 100),
        address: String(getColumnValue(row, ['Address', 'Direccion', 'Street', 'Street Address']) || '').substring(0, 255),
        city: String(getColumnValue(row, ['City', 'Ciudad']) || '').substring(0, 100),
        state: String(getColumnValue(row, ['State', 'Estado', 'ST']) || '').substring(0, 50),
        zip: String(getColumnValue(row, ['Zip', 'ZIP', 'Zip Code', 'ZipCode', 'Postal', 'Postal Code', 'CP', 'Codigo Postal']) || '').substring(0, 20),
        phone: formatPhone(String(getColumnValue(row, ['Phone', 'Phone1', 'Phone 1', 'Telefono', 'Tel', 'Mobile', 'Cell']) || '')),
        phone2: formatPhone(String(getColumnValue(row, ['Phone2', 'Phone 2', 'Telefono2', 'Alt Phone', 'Secondary Phone']) || '')),
        phone3: formatPhone(String(getColumnValue(row, ['Phone3', 'Phone 3', 'Telefono3', 'Third Phone']) || '')),
        job_group: String(getColumnValue(row, ['Job Group', 'JobGroup', 'Group', 'Grupo', 'Category', 'Type']) || '').substring(0, 100),
        lead_date: parseExcelDate(getColumnValue(row, ['Date', 'Lead Date', 'Fecha', 'Created', 'Created Date'])),
        source: String(getColumnValue(row, ['Source', 'Fuente', 'Lead Source', 'Origin', 'Campaign']) || '').substring(0, 100),
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Filter out leads with no phone (require at least one phone number)
    const validLeads = leads.filter(lead => lead.phone || lead.phone2 || lead.phone3);

    console.log('Valid leads to insert:', validLeads.length);

    if (validLeads.length === 0) {
      return res.status(400).json({ error: 'No valid leads found. Each lead must have at least one phone number.' });
    }

    // Insert in batches to avoid timeout and memory issues
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < validLeads.length; i += batchSize) {
      const batch = validLeads.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(validLeads.length/batchSize)} (${batch.length} records)`);

      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Failed batch sample:', JSON.stringify(batch[0], null, 2));
        throw new Error(`Database error: ${error.message || error.code || 'Unknown error'}`);
      }

      totalInserted += data.length;
    }

    res.json({
      message: `Successfully imported ${totalInserted} leads`,
      count: totalInserted,
      skipped: leads.length - validLeads.length
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Unknown error occurred' });
  }
});

// ==================== CALLS ENDPOINTS ====================

// Get call history for a lead
app.get('/api/leads/:id/calls', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.json([]); // Return empty array if table doesn't exist yet
  }
});

// Twilio webhook for call status
app.post('/api/webhook/call-status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log('Call status webhook:', req.body);

    if (CallSid && CallStatus) {
      const { error } = await supabase
        .from('calls')
        .update({
          duration: parseInt(CallDuration) || 0,
          status: CallStatus,
          updated_at: new Date().toISOString()
        })
        .eq('twilio_sid', CallSid);

      if (error) console.error('Error updating call status:', error);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing call status:', error);
    res.status(200).send('OK');
  }
});

// Twilio webhook for recording completed
app.post('/api/webhook/recording', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration, RecordingStatus } = req.body;
    console.log('Recording webhook:', { CallSid, RecordingUrl, RecordingSid, RecordingDuration, RecordingStatus });

    if (CallSid && RecordingSid) {
      // Use our proxy URL so users don't need Twilio auth
      const proxyRecordingUrl = `https://patagon-dialer-api.onrender.com/api/recordings/${RecordingSid}`;

      const { error } = await supabase
        .from('calls')
        .update({
          recording_url: proxyRecordingUrl,
          recording_sid: RecordingSid,
          recording_duration: parseInt(RecordingDuration) || 0,
          updated_at: new Date().toISOString()
        })
        .eq('twilio_sid', CallSid);

      if (error) console.error('Error updating recording:', error);
      else console.log('Recording saved for call:', CallSid, 'URL:', proxyRecordingUrl);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing recording:', error);
    res.status(200).send('OK');
  }
});

// Twilio webhook for call complete (action URL)
app.post('/api/webhook/call-complete', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration } = req.body;
    console.log('Call complete webhook:', { CallSid, DialCallStatus, DialCallDuration });

    if (CallSid) {
      const { error } = await supabase
        .from('calls')
        .update({
          status: DialCallStatus || 'completed',
          duration: parseInt(DialCallDuration) || 0,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('twilio_sid', CallSid);

      if (error) console.error('Error updating call complete:', error);
    }

    // Return empty TwiML to end the call cleanly
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error processing call complete:', error);
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Twilio webhook for incoming calls
app.post('/api/webhook/call-incoming', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { From, To, CallSid } = req.body;

    console.log('Incoming call:', { From, To, CallSid });
    console.log('Online clients:', Array.from(onlineClients.keys()));

    // Find lead by phone number
    const { data: lead } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .or(`phone.eq.${From},phone2.eq.${From},phone3.eq.${From}`)
      .single();

    // Create call record
    await supabase.from('calls').insert({
      lead_id: lead?.id || null,
      direction: 'inbound',
      from_number: From,
      to_number: To,
      twilio_sid: CallSid,
      status: 'ringing',
      created_at: new Date().toISOString()
    });

    // Create inbound alert
    await supabase.from('inbound_alerts').insert({
      lead_id: lead?.id || null,
      phone: From,
      message: lead ? `Llamada entrante de ${lead.first_name} ${lead.last_name}` : `Llamada entrante de ${From}`,
      status: 'unread',
      created_at: new Date().toISOString()
    });

    // TwiML response - ring all connected browser clients
    const twiml = new twilio.twiml.VoiceResponse();

    // Get all online client identities
    const clientIdentities = Array.from(onlineClients.keys());

    if (clientIdentities.length === 0) {
      // No agents online - leave a message
      twiml.say({ language: 'en-US' }, 'Thank you for calling. No agents are available at the moment. Please leave a message after the tone.');
      twiml.record({
        maxLength: 120,
        transcribe: false,
        recordingStatusCallback: 'https://patagon-dialer-api.onrender.com/api/webhook/recording'
      });
    } else {
      twiml.say({ language: 'en-US' }, 'Thank you for calling. Please hold while we transfer your call.');

      // Dial all connected browser clients
      const dial = twiml.dial({
        timeout: 30,
        record: 'record-from-answer',
        recordingStatusCallback: 'https://patagon-dialer-api.onrender.com/api/webhook/recording',
        recordingStatusCallbackEvent: 'completed',
        action: 'https://patagon-dialer-api.onrender.com/api/webhook/call-complete'
      });

      // Ring all online browser clients
      for (const identity of clientIdentities) {
        dial.client(identity);
        console.log('Dialing client:', identity);
      }
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling incoming call:', error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ language: 'en-US' }, 'We apologize, an error has occurred. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// ==================== CONVERSATIONS ENDPOINTS ====================

// Get conversations for a lead
app.get('/api/leads/:id/conversations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send SMS
app.post('/api/leads/:id/sms', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, to_phone } = req.body;

    // Send via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: to_phone
    });

    // Save to conversations
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        lead_id: id,
        direction: 'outbound',
        message: message,
        phone: to_phone,
        twilio_sid: twilioMessage.sid,
        status: twilioMessage.status,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, conversation: data });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send SMS to any number (Quick SMS)
app.post('/api/sms/send', authMiddleware, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    // Format phone number
    let formattedPhone = to.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
      formattedPhone = `+${formattedPhone}`;
    } else if (!to.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    } else {
      formattedPhone = to;
    }

    // Send via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: formattedPhone
    });

    res.json({ success: true, sid: twilioMessage.sid });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Twilio webhook for incoming SMS
app.post('/api/webhook/sms', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    console.log('Incoming SMS:', { From, Body, MessageSid });

    // Normalize phone number for comparison (remove + and any non-digits)
    const normalizedFrom = From.replace(/\D/g, '');
    const fromWithPlus = From.startsWith('+') ? From : `+${normalizedFrom}`;
    const fromWithoutPlus = normalizedFrom;

    // Try to find lead by various phone formats
    const { data: lead } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .or(`phone.eq.${fromWithPlus},phone.eq.${fromWithoutPlus},phone.ilike.%${normalizedFrom.slice(-10)},phone2.eq.${fromWithPlus},phone2.eq.${fromWithoutPlus},phone2.ilike.%${normalizedFrom.slice(-10)},phone3.eq.${fromWithPlus},phone3.eq.${fromWithoutPlus},phone3.ilike.%${normalizedFrom.slice(-10)}`)
      .limit(1)
      .single();

    console.log('Lead found:', lead ? lead.id : 'none');

    // Save conversation (even if no lead found)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        lead_id: lead?.id || null,
        direction: 'inbound',
        message: Body,
        phone: From,
        twilio_sid: MessageSid,
        status: 'received',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (convError) {
      console.error('Error saving conversation:', convError);
    }

    // Create inbound alert for follow-up tracking
    const { error: alertError } = await supabase
      .from('inbound_alerts')
      .insert({
        lead_id: lead?.id || null,
        conversation_id: conversation?.id || null,
        message: Body,
        phone: From,
        status: 'unread',
        created_at: new Date().toISOString()
      });

    if (alertError) {
      console.error('Error saving alert:', alertError);
    }

    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    console.error('Error processing incoming SMS:', error);
    res.type('text/xml').send('<Response></Response>');
  }
});

// ==================== DISPOSITIONS ENDPOINTS ====================

// Get dispositions for a lead
app.get('/api/leads/:id/dispositions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dispositions')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching dispositions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add disposition
app.post('/api/leads/:id/dispositions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { disposition_type, notes, appointment_date, appointment_time, salesperson_id } = req.body;

    const { data, error } = await supabase
      .from('dispositions')
      .insert({
        lead_id: id,
        disposition_type,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead status and last_disposition based on disposition
    const statusMap = {
      'appointment_set': 'appointment',
      'not_interested': 'closed',
      'callback': 'callback',
      'no_answer': 'no_answer',
      'wrong_number': 'invalid',
      'voicemail': 'voicemail',
      'busy': 'busy',
      'disconnected': 'disconnected'
    };

    // Update lead status and last_disposition
    const updateData = {
      last_disposition: disposition_type,
      updated_at: new Date().toISOString()
    };
    if (statusMap[disposition_type]) {
      updateData.status = statusMap[disposition_type];
    }

    await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id);

    // If disposition is appointment_set, automatically create an appointment
    if (disposition_type === 'appointment_set') {
      const appointmentData = {
        lead_id: id,
        appointment_date: appointment_date || new Date().toISOString().split('T')[0],
        appointment_time: appointment_time || '10:00',
        notes: notes || 'Cita agendada desde disposición',
        status: 'scheduled',
        created_at: new Date().toISOString()
      };

      if (salesperson_id) {
        appointmentData.salesperson_id = salesperson_id;
      }

      const { data: appointmentResult, error: appointmentError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (appointmentError) {
        console.error('Error creating appointment from disposition:', appointmentError);
      } else {
        data.appointment = appointmentResult;
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error adding disposition:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== APPOINTMENTS ENDPOINTS ====================

// Get all appointments (with pagination)
app.get('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('appointments')
      .select(`
        *,
        leads (id, lead_number, first_name, last_name, phone, address, city, state, zip, job_group)
      `, { count: 'exact' })
      .order('appointment_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      appointments: data,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete appointment
app.delete('/api/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create appointment
app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const {
      lead_id,
      appointment_date,
      appointment_time,
      notes,
      salesperson_id
    } = req.body;

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        lead_id,
        appointment_date,
        appointment_time,
        notes,
        salesperson_id,
        status: 'scheduled',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead status
    await supabase
      .from('leads')
      .update({ status: 'appointment', updated_at: new Date().toISOString() })
      .eq('id', lead_id);

    res.json(data);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dispatch appointment (send to salesperson via SMS)
app.post('/api/appointments/:id/dispatch', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { salesperson_phone } = req.body;

    // Get appointment with lead info
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        leads (first_name, last_name, phone, address, city, state, zip, job_group)
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const lead = appointment.leads;
    const message = `NEW APPOINTMENT\n` +
      `Name: ${lead.first_name} ${lead.last_name}\n` +
      `Phone: ${lead.phone}\n` +
      `Address: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}\n` +
      `Job: ${lead.job_group}\n` +
      `Date: ${appointment.appointment_date}\n` +
      `Time: ${appointment.appointment_time}\n` +
      `Notes: ${appointment.notes || 'N/A'}`;

    // Send SMS to salesperson
    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: salesperson_phone
    });

    // Update appointment status
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, appointment: data });
  } catch (error) {
    console.error('Error dispatching appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SALESPEOPLE ENDPOINTS ====================

// Get all salespeople
app.get('/api/salespeople', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('salespeople')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching salespeople:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add salesperson (Admin Only)
app.post('/api/salespeople', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    const { data, error } = await supabase
      .from('salespeople')
      .insert({ name, phone, email, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error adding salesperson:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function formatPhone(phone) {
  if (!phone) return '';
  // Remove all non-numeric characters
  const cleaned = String(phone).replace(/\D/g, '');
  // Add +1 if it's a 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return cleaned;
}

// ==================== TWILIO VOICE CLIENT ENDPOINTS ====================

// Generate Twilio Access Token for browser client
app.get('/api/voice/token', authMiddleware, async (req, res) => {
  try {
    const identity = req.user.email.replace(/[^a-zA-Z0-9]/g, '_');

    const accessToken = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true
    });

    accessToken.addGrant(voiceGrant);

    // Register client as online
    onlineClients.set(identity, {
      userId: req.user.id,
      email: req.user.email,
      lastSeen: Date.now()
    });
    console.log('Client registered:', identity, 'Total online:', onlineClients.size);

    res.json({
      token: accessToken.toJwt(),
      identity
    });
  } catch (error) {
    console.error('Error generating voice token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Heartbeat to keep client online status updated
app.post('/api/voice/heartbeat', authMiddleware, (req, res) => {
  const identity = req.user.email.replace(/[^a-zA-Z0-9]/g, '_');
  if (onlineClients.has(identity)) {
    onlineClients.get(identity).lastSeen = Date.now();
  }
  res.json({ ok: true });
});

// Clean up stale clients (older than 5 minutes)
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 5 * 60 * 1000; // 5 minutes
  for (const [identity, data] of onlineClients.entries()) {
    if (now - data.lastSeen > staleTimeout) {
      onlineClients.delete(identity);
      console.log('Client removed (stale):', identity);
    }
  }
}, 60000); // Check every minute

// TwiML for outbound calls from browser
app.post('/api/voice/outbound', express.urlencoded({ extended: true }), async (req, res) => {
  const { To, leadId, CallSid, From, Caller } = req.body;

  console.log('Outbound call request:', { To, leadId, CallSid, From, Caller });

  // Save call record
  try {
    await supabase.from('calls').insert({
      lead_id: leadId || null,
      direction: 'outbound',
      from_number: TWILIO_PHONE,
      to_number: To,
      twilio_sid: CallSid,
      status: 'initiated',
      created_at: new Date().toISOString()
    });
    console.log('Call record saved:', CallSid);
  } catch (error) {
    console.error('Error saving call record:', error);
  }

  const twiml = new twilio.twiml.VoiceResponse();

  // Dial the number with recording
  const dial = twiml.dial({
    callerId: TWILIO_PHONE,
    record: 'record-from-answer',
    recordingStatusCallback: 'https://patagon-dialer-api.onrender.com/api/webhook/recording',
    recordingStatusCallbackEvent: 'completed',
    action: 'https://patagon-dialer-api.onrender.com/api/webhook/call-complete'
  });

  dial.number(To);

  res.type('text/xml');
  res.send(twiml.toString());
});

// Make outbound call (alternative to browser SDK)
app.post('/api/voice/call', authMiddleware, async (req, res) => {
  try {
    const { to, leadId } = req.body;

    const call = await twilioClient.calls.create({
      url: `https://patagon-dialer-api.onrender.com/api/voice/connect?leadId=${leadId}`,
      to: to,
      from: TWILIO_PHONE,
      record: true,
      recordingStatusCallback: 'https://patagon-dialer-api.onrender.com/api/webhook/call-status'
    });

    // Save call record
    await supabase.from('calls').insert({
      lead_id: leadId,
      direction: 'outbound',
      from_number: TWILIO_PHONE,
      to_number: to,
      call_sid: call.sid,
      status: 'initiated',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ error: error.message });
  }
});

// TwiML for connecting call
app.post('/api/voice/connect', express.urlencoded({ extended: true }), (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ language: 'es-MX' }, 'Conectando...');
  twiml.dial().conference('PatagonDialer');
  res.type('text/xml');
  res.send(twiml.toString());
});

// Proxy endpoint for Twilio recordings (so users don't need Twilio auth)
// Accepts auth via header OR query param (needed for <audio> element)
app.get('/api/recordings/:recordingSid', (req, res) => {
  const { recordingSid } = req.params;
  const { token } = req.query;

  // Check auth from header or query param
  const authToken = req.headers.authorization?.replace('Bearer ', '') || token;

  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Verify token
  try {
    jwt.verify(authToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Validate recording SID format
  if (!recordingSid || !recordingSid.startsWith('RE')) {
    return res.status(400).json({ error: 'Invalid recording ID' });
  }

  // Fetch recording from Twilio with authentication using https module
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    if (proxyRes.statusCode !== 200) {
      return res.status(proxyRes.statusCode).json({ error: 'Recording not found' });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `inline; filename="${recordingSid}.mp3"`,
      'Cache-Control': 'private, max-age=3600'
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: error.message });
  });

  proxyReq.end();
});

// ==================== VENDORS ENDPOINTS ====================

// Get all vendors
app.get('/api/vendors', authMiddleware, async (req, res) => {
  try {
    const { search, category, active = 'true' } = req.query;

    let query = supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true });

    if (active !== 'all') {
      query = query.eq('active', active === 'true');
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single vendor
app.get('/api/vendors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create vendor
app.post('/api/vendors', authMiddleware, async (req, res) => {
  try {
    const { name, company, phone, phone2, email, address, city, state, zip, category, notes } = req.body;

    const { data, error } = await supabase
      .from('vendors')
      .insert({
        name,
        company,
        phone,
        phone2,
        email,
        address,
        city,
        state,
        zip,
        category,
        notes,
        active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update vendor
app.put('/api/vendors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, phone, phone2, email, address, city, state, zip, category, notes, active } = req.body;

    const { data, error } = await supabase
      .from('vendors')
      .update({
        name,
        company,
        phone,
        phone2,
        email,
        address,
        city,
        state,
        zip,
        category,
        notes,
        active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete vendor (soft delete)
app.delete('/api/vendors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vendors')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send SMS to vendor
app.post('/api/vendors/:id/sms', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, phone } = req.body;

    // Get vendor if phone not provided
    let toPhone = phone;
    if (!toPhone) {
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('phone')
        .eq('id', id)
        .single();

      if (vendorError) throw vendorError;
      toPhone = vendor.phone;
    }

    if (!toPhone) {
      return res.status(400).json({ error: 'No phone number available' });
    }

    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: toPhone
    });

    // Save to vendor_messages
    const { data, error } = await supabase
      .from('vendor_messages')
      .insert({
        vendor_id: id,
        direction: 'outbound',
        message,
        phone: toPhone,
        twilio_sid: twilioMessage.sid,
        status: twilioMessage.status,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error sending SMS to vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vendor messages
app.get('/api/vendors/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vendor_messages')
      .select('*')
      .eq('vendor_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching vendor messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROJECTS ENDPOINTS ====================

// Get all projects
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = supabase
      .from('projects')
      .select(`
        *,
        leads (id, lead_number, first_name, last_name, phone, address, city, state, zip)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single project
app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        leads (id, lead_number, first_name, last_name, phone, address, city, state, zip, job_group),
        project_vendors (
          id,
          role,
          notes,
          vendors (id, vendor_number, name, company, phone, email, category)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create project (can be created from a lead)
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { lead_id, name, description, status, start_date, end_date, budget, notes } = req.body;

    // If lead_id provided and no name, generate name from lead
    let projectName = name;
    if (lead_id && !name) {
      const { data: lead } = await supabase
        .from('leads')
        .select('first_name, last_name, address')
        .eq('id', lead_id)
        .single();

      if (lead) {
        projectName = `${lead.first_name} ${lead.last_name} - ${lead.address || 'Project'}`;
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        lead_id,
        name: projectName || 'New Project',
        description,
        status: status || 'pending',
        start_date,
        end_date,
        budget,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // If created from lead, update lead status
    if (lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'project', updated_at: new Date().toISOString() })
        .eq('id', lead_id);
    }

    res.json(data);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project
app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, start_date, end_date, budget, actual_cost, notes } = req.body;

    const { data, error } = await supabase
      .from('projects')
      .update({
        name,
        description,
        status,
        start_date,
        end_date,
        budget,
        actual_cost,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add vendor to project
app.post('/api/projects/:id/vendors', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor_id, role, notes } = req.body;

    const { data, error } = await supabase
      .from('project_vendors')
      .insert({
        project_id: id,
        vendor_id,
        role,
        notes,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        vendors (id, vendor_number, name, company, phone, email, category)
      `)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error adding vendor to project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove vendor from project
app.delete('/api/projects/:projectId/vendors/:vendorId', authMiddleware, async (req, res) => {
  try {
    const { projectId, vendorId } = req.params;

    const { error } = await supabase
      .from('project_vendors')
      .delete()
      .eq('project_id', projectId)
      .eq('vendor_id', vendorId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing vendor from project:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== LEAD VENDOR DISPATCH ====================

// Dispatch lead info to vendor via SMS
app.post('/api/leads/:id/dispatch-vendor', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor_id, message } = req.body;

    // Get lead info
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError) throw leadError;

    // Get vendor info
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (vendorError) throw vendorError;

    if (!vendor.phone) {
      return res.status(400).json({ error: 'Vendor has no phone number' });
    }

    // Build dispatch message
    const dispatchMessage = message ||
      `Nuevo Lead #${lead.lead_number || lead.id.substring(0,8)}:\n` +
      `Nombre: ${lead.first_name} ${lead.last_name}\n` +
      `Dirección: ${lead.address || 'N/A'}, ${lead.city || ''} ${lead.state || ''} ${lead.zip || ''}\n` +
      `Teléfono: ${lead.phone}\n` +
      `Trabajo: ${lead.job_group || 'N/A'}`;

    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: dispatchMessage,
      from: TWILIO_PHONE,
      to: vendor.phone
    });

    // Save dispatch record
    const { data, error } = await supabase
      .from('lead_vendor_dispatches')
      .insert({
        lead_id: id,
        vendor_id,
        message: dispatchMessage,
        twilio_sid: twilioMessage.sid,
        status: twilioMessage.status,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, dispatch: data, message: twilioMessage });
  } catch (error) {
    console.error('Error dispatching lead to vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get lead dispatches
app.get('/api/leads/:id/dispatches', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('lead_vendor_dispatches')
      .select(`
        *,
        vendors (id, vendor_number, name, company, phone)
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching lead dispatches:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== OPEN DIALER (Call/Text any number) ====================

// Call any phone number (open dialer)
app.post('/api/dialer/call', authMiddleware, async (req, res) => {
  try {
    const { to, from } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Phone number (to) is required' });
    }

    // Generate TwiML for the call
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial({
      callerId: from || TWILIO_PHONE
    }).number(to);

    res.json({
      success: true,
      to,
      from: from || TWILIO_PHONE,
      message: 'Use Twilio Voice SDK to make the call'
    });
  } catch (error) {
    console.error('Error initiating open dialer call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send SMS to any phone number (open dialer)
app.post('/api/dialer/sms', authMiddleware, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number (to) and message are required' });
    }

    // Send SMS via Twilio
    const twilioMessage = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to
    });

    res.json({
      success: true,
      sid: twilioMessage.sid,
      status: twilioMessage.status,
      to,
      message
    });
  } catch (error) {
    console.error('Error sending SMS via open dialer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
