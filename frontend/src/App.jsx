import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

// Disposition types
const DISPOSITIONS = [
  { value: 'appointment_set', label: 'Appointment Set', color: '#4caf50' },
  { value: 'callback', label: 'Callback Requested', color: '#ff9800' },
  { value: 'not_interested', label: 'Not Interested', color: '#9e9e9e' },
  { value: 'no_answer', label: 'No Answer', color: '#f44336' },
  { value: 'voicemail', label: 'Left Voicemail', color: '#9c27b0' },
  { value: 'wrong_number', label: 'Wrong Number', color: '#795548' },
  { value: 'busy', label: 'Busy', color: '#ff5722' },
  { value: 'disconnected', label: 'Disconnected', color: '#607d8b' }
]

function App() {
  const [currentView, setCurrentView] = useState('leads')
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(-1)
  const [conversations, setConversations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [toast, setToast] = useState(null)

  // Modal states
  const [showDispositionModal, setShowDispositionModal] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch leads
  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page,
        limit: 50,
        status: statusFilter,
        search: searchTerm
      })
      const res = await axios.get(`${API_URL}/api/leads?${params}`)
      setLeads(res.data.leads)
      setPagination({
        page: res.data.page,
        totalPages: res.data.totalPages,
        total: res.data.total
      })
    } catch (error) {
      console.error('Error fetching leads:', error)
      showToast('Error loading leads', 'error')
    }
    setLoading(false)
  }, [statusFilter, searchTerm])

  // Fetch conversations for a lead
  const fetchConversations = async (leadId) => {
    try {
      const res = await axios.get(`${API_URL}/api/leads/${leadId}/conversations`)
      setConversations(res.data)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/appointments`)
      setAppointments(res.data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    }
  }

  // Fetch salespeople
  const fetchSalespeople = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/salespeople`)
      setSalespeople(res.data)
    } catch (error) {
      console.error('Error fetching salespeople:', error)
    }
  }

  useEffect(() => {
    fetchLeads()
    fetchSalespeople()
  }, [fetchLeads])

  useEffect(() => {
    if (currentView === 'appointments') {
      fetchAppointments()
    }
  }, [currentView])

  // Select a lead
  const selectLead = async (lead, index) => {
    setSelectedLead(lead)
    setSelectedLeadIndex(index)
    await fetchConversations(lead.id)
    setCurrentView('leadCard')
  }

  // Navigate to next/previous lead
  const navigateLead = async (direction) => {
    const newIndex = selectedLeadIndex + direction
    if (newIndex >= 0 && newIndex < leads.length) {
      await selectLead(leads[newIndex], newIndex)
    }
  }

  // Send SMS
  const sendSMS = async (message, phone) => {
    try {
      await axios.post(`${API_URL}/api/leads/${selectedLead.id}/sms`, {
        message,
        to_phone: phone
      })
      await fetchConversations(selectedLead.id)
      showToast('Message sent successfully')
    } catch (error) {
      console.error('Error sending SMS:', error)
      showToast('Failed to send message', 'error')
    }
  }

  // Add note
  const addNote = async (note) => {
    try {
      const res = await axios.post(`${API_URL}/api/leads/${selectedLead.id}/notes`, { note })
      setSelectedLead(res.data)
      // Update in leads list too
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      showToast('Note added')
    } catch (error) {
      console.error('Error adding note:', error)
      showToast('Failed to add note', 'error')
    }
  }

  // Add disposition
  const addDisposition = async (dispositionType, notes) => {
    try {
      await axios.post(`${API_URL}/api/leads/${selectedLead.id}/dispositions`, {
        disposition_type: dispositionType,
        notes
      })
      // Refresh lead data
      const res = await axios.get(`${API_URL}/api/leads/${selectedLead.id}`)
      setSelectedLead(res.data)
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      setShowDispositionModal(false)
      showToast('Disposition saved')
    } catch (error) {
      console.error('Error adding disposition:', error)
      showToast('Failed to save disposition', 'error')
    }
  }

  // Create appointment
  const createAppointment = async (appointmentData) => {
    try {
      await axios.post(`${API_URL}/api/appointments`, {
        lead_id: selectedLead.id,
        ...appointmentData
      })
      // Refresh lead data
      const res = await axios.get(`${API_URL}/api/leads/${selectedLead.id}`)
      setSelectedLead(res.data)
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      setShowAppointmentModal(false)
      showToast('Appointment created')
    } catch (error) {
      console.error('Error creating appointment:', error)
      showToast('Failed to create appointment', 'error')
    }
  }

  // Dispatch appointment
  const dispatchAppointment = async (appointmentId, salespersonPhone) => {
    try {
      await axios.post(`${API_URL}/api/appointments/${appointmentId}/dispatch`, {
        salesperson_phone: salespersonPhone
      })
      await fetchAppointments()
      setShowDispatchModal(false)
      showToast('Appointment dispatched')
    } catch (error) {
      console.error('Error dispatching appointment:', error)
      showToast('Failed to dispatch appointment', 'error')
    }
  }

  // Upload Excel file
  const uploadFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post(`${API_URL}/api/leads/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      showToast(res.data.message)
      setShowUploadModal(false)
      fetchLeads()
    } catch (error) {
      console.error('Error uploading file:', error)
      showToast('Failed to upload file', 'error')
    }
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <h1>Patagon Dialer</h1>
        <nav>
          <button
            className={currentView === 'leads' || currentView === 'leadCard' ? 'active' : ''}
            onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}
          >
            Leads
          </button>
          <button
            className={currentView === 'appointments' ? 'active' : ''}
            onClick={() => setCurrentView('appointments')}
          >
            Appointments
          </button>
          <button
            className={currentView === 'salespeople' ? 'active' : ''}
            onClick={() => setCurrentView('salespeople')}
          >
            Salespeople
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Leads List View */}
        {currentView === 'leads' && (
          <>
            <header className="header">
              <h2>Leads ({pagination.total})</h2>
              <div className="header-actions">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                />
                <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                  Upload Excel
                </button>
              </div>
            </header>

            <div className="content">
              {/* Filter Tabs */}
              <div className="filter-tabs">
                {['all', 'new', 'callback', 'appointment', 'no_answer', 'closed'].map(status => (
                  <button
                    key={status}
                    className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(status); fetchLeads(1) }}
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : leads.length === 0 ? (
                <div className="empty-state">
                  <h3>No leads found</h3>
                  <p>Upload an Excel file to get started</p>
                </div>
              ) : (
                <div className="lead-list">
                  <div className="lead-list-header">
                    <span>Name</span>
                    <span>Phone</span>
                    <span>City</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {leads.map((lead, index) => (
                    <div key={lead.id} className="lead-item" onClick={() => selectLead(lead, index)}>
                      <div className="lead-name">
                        {lead.first_name} {lead.last_name}
                        <small>{lead.job_group}</small>
                      </div>
                      <span>{lead.phone}</span>
                      <span>{lead.city}, {lead.state}</span>
                      <span className={`status-badge status-${lead.status}`}>{lead.status}</span>
                      <button className="btn btn-small btn-secondary" onClick={(e) => { e.stopPropagation(); selectLead(lead, index) }}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={pagination.page === 1}
                    onClick={() => fetchLeads(pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <button
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => fetchLeads(pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Lead Card View */}
        {currentView === 'leadCard' && selectedLead && (
          <>
            <header className="header">
              <h2>Lead Details</h2>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}>
                  Back to List
                </button>
                <button className="btn btn-primary" onClick={() => setShowDispositionModal(true)}>
                  Add Disposition
                </button>
                <button className="btn btn-success" onClick={() => setShowAppointmentModal(true)}>
                  Set Appointment
                </button>
              </div>
            </header>

            <div className="content">
              {/* Navigation */}
              <div className="lead-navigation">
                <button
                  className="nav-btn"
                  disabled={selectedLeadIndex === 0}
                  onClick={() => navigateLead(-1)}
                >
                  &larr; Previous Lead
                </button>
                <span>Lead {selectedLeadIndex + 1} of {leads.length}</span>
                <button
                  className="nav-btn"
                  disabled={selectedLeadIndex === leads.length - 1}
                  onClick={() => navigateLead(1)}
                >
                  Next Lead &rarr;
                </button>
              </div>

              <div className="lead-card-container">
                {/* Lead Card */}
                <div className="lead-card">
                  <div className="lead-card-header">
                    <h2>{selectedLead.first_name} {selectedLead.last_name}</h2>
                    <p>{selectedLead.job_group} | Source: {selectedLead.source}</p>
                    <span className={`status-badge status-${selectedLead.status}`}>{selectedLead.status}</span>
                  </div>

                  <div className="lead-card-body">
                    <div className="lead-info-grid">
                      <div className="info-item">
                        <label>Address</label>
                        <span>{selectedLead.address}</span>
                      </div>
                      <div className="info-item">
                        <label>City, State, Zip</label>
                        <span>{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</span>
                      </div>
                      <div className="info-item">
                        <label>Primary Phone</label>
                        <span>{selectedLead.phone}</span>
                      </div>
                      <div className="info-item">
                        <label>Phone 2</label>
                        <span>{selectedLead.phone2 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Phone 3</label>
                        <span>{selectedLead.phone3 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Lead Date</label>
                        <span>{selectedLead.lead_date || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Phone Actions */}
                    <div className="phone-actions">
                      {selectedLead.phone && (
                        <a href={`tel:${selectedLead.phone}`} className="phone-btn">
                          Call {selectedLead.phone}
                        </a>
                      )}
                      {selectedLead.phone2 && (
                        <a href={`tel:${selectedLead.phone2}`} className="phone-btn">
                          Call {selectedLead.phone2}
                        </a>
                      )}
                      {selectedLead.phone3 && (
                        <a href={`tel:${selectedLead.phone3}`} className="phone-btn">
                          Call {selectedLead.phone3}
                        </a>
                      )}
                    </div>

                    {/* Notes Section */}
                    <NotesSection lead={selectedLead} onAddNote={addNote} />
                  </div>
                </div>

                {/* Conversation Panel */}
                <ConversationPanel
                  lead={selectedLead}
                  conversations={conversations}
                  onSendSMS={sendSMS}
                />
              </div>
            </div>
          </>
        )}

        {/* Appointments View */}
        {currentView === 'appointments' && (
          <>
            <header className="header">
              <h2>Appointments</h2>
            </header>

            <div className="content">
              {appointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No appointments</h3>
                  <p>Set appointments from lead cards</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {appointments.map(apt => (
                    <div key={apt.id} className="appointment-item">
                      <div className="appointment-info">
                        <h4>{apt.leads?.first_name} {apt.leads?.last_name}</h4>
                        <p>{apt.leads?.phone} | {apt.leads?.address}, {apt.leads?.city}</p>
                        <p><strong>Date:</strong> {apt.appointment_date} at {apt.appointment_time}</p>
                        <p><strong>Status:</strong> <span className={`status-badge status-${apt.status}`}>{apt.status}</span></p>
                      </div>
                      <div className="appointment-actions">
                        {apt.status !== 'dispatched' && (
                          <button
                            className="btn btn-success btn-small"
                            onClick={() => { setSelectedAppointment(apt); setShowDispatchModal(true) }}
                          >
                            Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Salespeople View */}
        {currentView === 'salespeople' && (
          <>
            <header className="header">
              <h2>Salespeople</h2>
              <button className="btn btn-primary" onClick={() => {/* Add salesperson modal */}}>
                Add Salesperson
              </button>
            </header>

            <div className="content">
              <SalespeopleManager
                salespeople={salespeople}
                onRefresh={fetchSalespeople}
                showToast={showToast}
              />
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showDispositionModal && (
        <DispositionModal
          onClose={() => setShowDispositionModal(false)}
          onSave={addDisposition}
        />
      )}

      {showAppointmentModal && (
        <AppointmentModal
          salespeople={salespeople}
          onClose={() => setShowAppointmentModal(false)}
          onSave={createAppointment}
        />
      )}

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={uploadFile}
        />
      )}

      {showDispatchModal && selectedAppointment && (
        <DispatchModal
          appointment={selectedAppointment}
          salespeople={salespeople}
          onClose={() => { setShowDispatchModal(false); setSelectedAppointment(null) }}
          onDispatch={dispatchAppointment}
        />
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  )
}

// Notes Section Component
function NotesSection({ lead, onAddNote }) {
  const [newNote, setNewNote] = useState('')

  const handleSubmit = () => {
    if (newNote.trim()) {
      onAddNote(newNote.trim())
      setNewNote('')
    }
  }

  return (
    <div className="notes-section">
      <h3>Notes</h3>
      <div className="notes-display">
        {lead.notes || 'No notes yet'}
      </div>
      <div className="notes-input">
        <textarea
          rows="2"
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSubmit}>Add</button>
      </div>
    </div>
  )
}

// Conversation Panel Component
function ConversationPanel({ lead, conversations, onSendSMS }) {
  const [message, setMessage] = useState('')
  const [selectedPhone, setSelectedPhone] = useState(lead.phone)

  const handleSend = () => {
    if (message.trim() && selectedPhone) {
      onSendSMS(message.trim(), selectedPhone)
      setMessage('')
    }
  }

  return (
    <div className="conversation-panel">
      <div className="conversation-header">
        SMS Conversation
        <select
          value={selectedPhone}
          onChange={(e) => setSelectedPhone(e.target.value)}
          style={{ marginLeft: 12, padding: '4px 8px', borderRadius: 4 }}
        >
          {lead.phone && <option value={lead.phone}>{lead.phone}</option>}
          {lead.phone2 && <option value={lead.phone2}>{lead.phone2}</option>}
          {lead.phone3 && <option value={lead.phone3}>{lead.phone3}</option>}
        </select>
      </div>

      <div className="conversation-messages">
        {conversations.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div key={conv.id} className={`message ${conv.direction}`}>
              {conv.message}
              <div className="message-time">
                {new Date(conv.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="conversation-input">
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="send-btn" onClick={handleSend}>
          &#10148;
        </button>
      </div>
    </div>
  )
}

// Disposition Modal Component
function DispositionModal({ onClose, onSave }) {
  const [selected, setSelected] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Disposition</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="disposition-options">
            {DISPOSITIONS.map(disp => (
              <div
                key={disp.value}
                className={`disposition-option ${selected === disp.value ? 'selected' : ''}`}
                onClick={() => setSelected(disp.value)}
              >
                {disp.label}
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => onSave(selected, notes)}
          >
            Save Disposition
          </button>
        </div>
      </div>
    </div>
  )
}

// Appointment Modal Component
function AppointmentModal({ salespeople, onClose, onSave }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [salespersonId, setSalespersonId] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Set Appointment</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Assign Salesperson</label>
            <select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
              <option value="">Select salesperson...</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Appointment notes..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success"
            disabled={!date || !time}
            onClick={() => onSave({ appointment_date: date, appointment_time: time, salesperson_id: salespersonId || null, notes })}
          >
            Create Appointment
          </button>
        </div>
      </div>
    </div>
  )
}

// Upload Modal Component
function UploadModal({ onClose, onUpload }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (file) {
      setUploading(true)
      await onUpload(file)
      setUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload Leads</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div
            className="upload-area"
            onClick={() => document.getElementById('fileInput').click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file ? (
              <p><strong>{file.name}</strong> selected</p>
            ) : (
              <>
                <p><strong>Click to select file</strong></p>
                <p>Accepts .xlsx, .xls, .csv</p>
              </>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            <p><strong>Expected columns:</strong></p>
            <p>Name, Address, City, State, Zip, Phone, Phone 2, Phone 3, Job Group, Date, Source</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Dispatch Modal Component
function DispatchModal({ appointment, salespeople, onClose, onDispatch }) {
  const [salespersonPhone, setSalespersonPhone] = useState('')

  const selectedSalesperson = salespeople.find(sp => sp.id === appointment.salesperson_id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Dispatch Appointment</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 16 }}>
            Send appointment details via SMS to salesperson.
          </p>

          <div className="form-group">
            <label>Salesperson Phone Number</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={salespersonPhone || (selectedSalesperson?.phone || '')}
              onChange={(e) => setSalespersonPhone(e.target.value)}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, fontSize: '0.9rem' }}>
            <strong>Message Preview:</strong>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
{`NEW APPOINTMENT
Name: ${appointment.leads?.first_name} ${appointment.leads?.last_name}
Phone: ${appointment.leads?.phone}
Address: ${appointment.leads?.address}, ${appointment.leads?.city}, ${appointment.leads?.state} ${appointment.leads?.zip}
Job: ${appointment.leads?.job_group}
Date: ${appointment.appointment_date}
Time: ${appointment.appointment_time}
Notes: ${appointment.notes || 'N/A'}`}
            </pre>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success"
            disabled={!salespersonPhone && !selectedSalesperson?.phone}
            onClick={() => onDispatch(appointment.id, salespersonPhone || selectedSalesperson?.phone)}
          >
            Send to Salesperson
          </button>
        </div>
      </div>
    </div>
  )
}

// Salespeople Manager Component
function SalespeopleManager({ salespeople, onRefresh, showToast }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/salespeople`, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim()
      })
      setName('')
      setPhone('')
      setEmail('')
      onRefresh()
      showToast('Salesperson added')
    } catch (error) {
      showToast('Failed to add salesperson', 'error')
    }
    setAdding(false)
  }

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Add New Salesperson</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          disabled={!name.trim() || adding}
          onClick={handleAdd}
        >
          {adding ? 'Adding...' : 'Add Salesperson'}
        </button>
      </div>

      <div className="lead-list">
        <div className="lead-list-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <span>Name</span>
          <span>Phone</span>
          <span>Email</span>
        </div>
        {salespeople.map(sp => (
          <div key={sp.id} className="lead-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <span>{sp.name}</span>
            <span>{sp.phone || 'N/A'}</span>
            <span>{sp.email || 'N/A'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
