require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
      limit = 50
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

    const { data, error } = await supabase
      .from('leads')
      .insert(validLeads)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    res.json({
      message: `Successfully imported ${data.length} leads`,
      count: data.length,
      skipped: leads.length - validLeads.length
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
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

// Twilio webhook for call status (recording)
app.post('/api/webhook/call-status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl,
      RecordingSid,
      From,
      To,
      Direction
    } = req.body;

    console.log('Call status webhook:', { CallSid, CallStatus, CallDuration, RecordingUrl });

    // Update call record with recording URL and duration
    if (CallSid) {
      const { error } = await supabase
        .from('calls')
        .update({
          duration: parseInt(CallDuration) || 0,
          recording_url: RecordingUrl ? `${RecordingUrl}.mp3` : null,
          recording_sid: RecordingSid,
          status: CallStatus,
          updated_at: new Date().toISOString()
        })
        .eq('twilio_sid', CallSid);

      if (error) console.error('Error updating call:', error);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing call status:', error);
    res.status(200).send('OK');
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
      twiml.say({ language: 'es-MX' }, 'Lo sentimos, no hay agentes disponibles en este momento. Por favor deje un mensaje después del tono.');
      twiml.record({
        maxLength: 120,
        transcribe: false,
        recordingStatusCallback: '/api/webhook/call-status'
      });
    } else {
      twiml.say({ language: 'es-MX' }, 'Por favor espere mientras lo conectamos.');

      // Dial all connected browser clients
      const dial = twiml.dial({
        timeout: 30,
        record: 'record-from-answer',
        recordingStatusCallback: '/api/webhook/call-status'
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
    twiml.say({ language: 'es-MX' }, 'Lo sentimos, ocurrió un error. Por favor intente más tarde.');
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
    const { disposition_type, notes } = req.body;

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

    // Update lead status based on disposition
    const statusMap = {
      'appointment_set': 'appointment',
      'not_interested': 'closed',
      'callback': 'callback',
      'no_answer': 'no_answer',
      'wrong_number': 'invalid',
      'voicemail': 'voicemail'
    };

    if (statusMap[disposition_type]) {
      await supabase
        .from('leads')
        .update({ status: statusMap[disposition_type], updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    res.json(data);
  } catch (error) {
    console.error('Error adding disposition:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== APPOINTMENTS ENDPOINTS ====================

// Get all appointments
app.get('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        leads (first_name, last_name, phone, address, city, state, zip, job_group)
      `)
      .order('appointment_date', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching appointments:', error);
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
app.post('/api/voice/outbound', express.urlencoded({ extended: true }), (req, res) => {
  const { To, leadId } = req.body;

  console.log('Outbound call request:', { To, leadId });

  const twiml = new twilio.twiml.VoiceResponse();

  // Dial the number
  const dial = twiml.dial({
    callerId: TWILIO_PHONE,
    record: 'record-from-answer',
    recordingStatusCallback: '/api/webhook/call-status',
    recordingStatusCallbackEvent: 'completed'
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
