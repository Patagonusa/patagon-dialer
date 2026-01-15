require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE = process.env.TWILIO_PHONE;

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==================== LEADS ENDPOINTS ====================

// Get all leads with optional filters
app.get('/api/leads', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
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
app.get('/api/leads/:id', async (req, res) => {
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

// Update lead
app.put('/api/leads/:id', async (req, res) => {
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
app.post('/api/leads/:id/notes', async (req, res) => {
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
    const newNote = `[${timestamp}] ${note}`;
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

// Upload Excel file
app.post('/api/leads/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const leads = jsonData.map(row => {
      // Parse name into first and last name
      const nameParts = (row.Name || '').trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        first_name: firstName,
        last_name: lastName,
        address: row.Address || '',
        city: row.City || '',
        state: row.State || '',
        zip: row.Zip || '',
        phone: formatPhone(row.Phone || ''),
        phone2: formatPhone(row['Phone 2'] || ''),
        phone3: formatPhone(row['Phone 3'] || ''),
        job_group: row['Job Group'] || '',
        lead_date: row.Date || null,
        source: row.Source || '',
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const { data, error } = await supabase
      .from('leads')
      .insert(leads)
      .select();

    if (error) throw error;

    res.json({
      message: `Successfully imported ${data.length} leads`,
      count: data.length
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONVERSATIONS ENDPOINTS ====================

// Get conversations for a lead
app.get('/api/leads/:id/conversations', async (req, res) => {
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
app.post('/api/leads/:id/sms', async (req, res) => {
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

// Twilio webhook for incoming SMS
app.post('/api/webhook/sms', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    // Find lead by phone number
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .or(`phone.eq.${From},phone2.eq.${From},phone3.eq.${From}`)
      .single();

    if (lead) {
      await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          direction: 'inbound',
          message: Body,
          phone: From,
          twilio_sid: MessageSid,
          status: 'received',
          created_at: new Date().toISOString()
        });
    }

    res.type('text/xml').send('<Response></Response>');
  } catch (error) {
    console.error('Error processing incoming SMS:', error);
    res.type('text/xml').send('<Response></Response>');
  }
});

// ==================== DISPOSITIONS ENDPOINTS ====================

// Get dispositions for a lead
app.get('/api/leads/:id/dispositions', async (req, res) => {
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
app.post('/api/leads/:id/dispositions', async (req, res) => {
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
app.get('/api/appointments', async (req, res) => {
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
app.post('/api/appointments', async (req, res) => {
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
app.post('/api/appointments/:id/dispatch', async (req, res) => {
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
app.get('/api/salespeople', async (req, res) => {
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

// Add salesperson
app.post('/api/salespeople', async (req, res) => {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
