import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

// Disposition types - Spanish
const DISPOSITIONS = [
  { value: 'appointment_set', label: 'Cita Agendada', color: '#4caf50' },
  { value: 'callback', label: 'Devolver Llamada', color: '#ff9800' },
  { value: 'not_interested', label: 'No Interesado', color: '#9e9e9e' },
  { value: 'no_answer', label: 'No Contesta', color: '#f44336' },
  { value: 'voicemail', label: 'Buzón de Voz', color: '#9c27b0' },
  { value: 'wrong_number', label: 'Número Equivocado', color: '#795548' },
  { value: 'busy', label: 'Ocupado', color: '#ff5722' },
  { value: 'disconnected', label: 'Desconectado', color: '#607d8b' }
]

// Status labels in Spanish
const STATUS_LABELS = {
  all: 'Todos',
  new: 'Nuevo',
  callback: 'Devolver',
  appointment: 'Cita',
  no_answer: 'No Contesta',
  closed: 'Cerrado',
  appointment_set: 'Cita Agendada',
  not_interested: 'No Interesado',
  voicemail: 'Buzón',
  wrong_number: 'Número Equivocado',
  busy: 'Ocupado',
  disconnected: 'Desconectado',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  unread: 'No Leído',
  read: 'Leído',
  follow_up: 'Seguimiento',
  scheduled: 'Programada',
  dispatched: 'Despachada',
  completed: 'Completada'
}

// API helper with auth
const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (isLoading) {
    return <div className="loading-screen"><div className="spinner"></div></div>
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <MainApp user={user} onLogout={handleLogout} />
}

// ==================== LOGIN PAGE ====================
function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isRegister) {
        await axios.post(`${API_URL}/api/auth/register`, {
          email, password, first_name: firstName, last_name: lastName
        })
        setSuccess('Registro exitoso. Por favor espere la aprobación del administrador.')
        setIsRegister(false)
        setEmail('')
        setPassword('')
        setFirstName('')
        setLastName('')
      } else {
        const res = await axios.post(`${API_URL}/api/auth/login`, { email, password })
        onLogin(res.data.user, res.data.token)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ocurrió un error')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="Patagon" className="login-logo" />
          <h1>Patagon Dialer</h1>
          <p>Sistema de Gestión de Leads</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {isRegister && (
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Por favor espere...' : (isRegister ? 'Registrarse' : 'Iniciar Sesión')}
          </button>
        </form>

        <div className="login-footer">
          {isRegister ? (
            <p>¿Ya tienes cuenta? <button onClick={() => setIsRegister(false)}>Iniciar Sesión</button></p>
          ) : (
            <p>¿Necesitas una cuenta? <button onClick={() => setIsRegister(true)}>Registrarse</button></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN APP ====================
function MainApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('leads')
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(-1)
  const [conversations, setConversations] = useState([])
  const [callHistory, setCallHistory] = useState([])
  const [appointments, setAppointments] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [users, setUsers] = useState([])
  const [inboundAlerts, setInboundAlerts] = useState([])
  const [alertCount, setAlertCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dispositionFilter, setDispositionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [toast, setToast] = useState(null)

  // Modal states
  const [showDispositionModal, setShowDispositionModal] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const isAdmin = user.role === 'admin'

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch alert count
  const fetchAlertCount = async () => {
    try {
      const res = await api.get('/api/inbound-alerts/count')
      setAlertCount(res.data.count || 0)
    } catch (error) {
      console.error('Error fetching alert count:', error)
    }
  }

  // Fetch leads
  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page,
        limit: 50,
        status: statusFilter,
        disposition: dispositionFilter,
        search: searchTerm,
        sort: sortBy,
        order: sortOrder
      })
      if (dateFilter) {
        params.append('date', dateFilter)
      }
      const res = await api.get(`/api/leads?${params}`)
      setLeads(res.data.leads)
      setPagination({
        page: res.data.page,
        totalPages: res.data.totalPages,
        total: res.data.total
      })
    } catch (error) {
      console.error('Error fetching leads:', error)
      showToast('Error cargando leads', 'error')
    }
    setLoading(false)
  }, [statusFilter, dispositionFilter, searchTerm, dateFilter, sortBy, sortOrder])

  // Fetch conversations for a lead
  const fetchConversations = async (leadId) => {
    try {
      const res = await api.get(`/api/leads/${leadId}/conversations`)
      setConversations(res.data)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  // Fetch call history for a lead
  const fetchCallHistory = async (leadId) => {
    try {
      const res = await api.get(`/api/leads/${leadId}/calls`)
      setCallHistory(res.data)
    } catch (error) {
      console.error('Error fetching call history:', error)
      setCallHistory([])
    }
  }

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      const res = await api.get('/api/appointments')
      setAppointments(res.data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    }
  }

  // Fetch salespeople
  const fetchSalespeople = async () => {
    try {
      const res = await api.get('/api/salespeople')
      setSalespeople(res.data)
    } catch (error) {
      console.error('Error fetching salespeople:', error)
    }
  }

  // Fetch users (admin only)
  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users')
      setUsers(res.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Fetch inbound alerts
  const fetchInboundAlerts = async () => {
    try {
      const res = await api.get('/api/inbound-alerts?status=all')
      setInboundAlerts(res.data)
    } catch (error) {
      console.error('Error fetching inbound alerts:', error)
    }
  }

  useEffect(() => {
    fetchLeads()
    fetchSalespeople()
    fetchAlertCount()
    const interval = setInterval(fetchAlertCount, 30000)
    return () => clearInterval(interval)
  }, [fetchLeads])

  useEffect(() => {
    if (currentView === 'appointments') {
      fetchAppointments()
    } else if (currentView === 'users' && isAdmin) {
      fetchUsers()
    } else if (currentView === 'inbound') {
      fetchInboundAlerts()
    }
  }, [currentView, isAdmin])

  // Select a lead
  const selectLead = async (lead, index) => {
    setSelectedLead(lead)
    setSelectedLeadIndex(index)
    await Promise.all([
      fetchConversations(lead.id),
      fetchCallHistory(lead.id)
    ])
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
      await api.post(`/api/leads/${selectedLead.id}/sms`, {
        message,
        to_phone: phone
      })
      await fetchConversations(selectedLead.id)
      showToast('Mensaje enviado')
    } catch (error) {
      console.error('Error sending SMS:', error)
      showToast('Error al enviar mensaje', 'error')
    }
  }

  // Add note
  const addNote = async (note) => {
    try {
      const res = await api.post(`/api/leads/${selectedLead.id}/notes`, { note })
      setSelectedLead(res.data)
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      showToast('Nota agregada')
    } catch (error) {
      console.error('Error adding note:', error)
      showToast('Error al agregar nota', 'error')
    }
  }

  // Add disposition
  const addDisposition = async (dispositionType, notes) => {
    try {
      await api.post(`/api/leads/${selectedLead.id}/dispositions`, {
        disposition_type: dispositionType,
        notes
      })
      const res = await api.get(`/api/leads/${selectedLead.id}`)
      setSelectedLead(res.data)
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      setShowDispositionModal(false)
      showToast('Disposición guardada')
    } catch (error) {
      console.error('Error adding disposition:', error)
      showToast('Error al guardar disposición', 'error')
    }
  }

  // Create appointment
  const createAppointment = async (appointmentData) => {
    try {
      await api.post('/api/appointments', {
        lead_id: selectedLead.id,
        ...appointmentData
      })
      const res = await api.get(`/api/leads/${selectedLead.id}`)
      setSelectedLead(res.data)
      setLeads(leads.map(l => l.id === res.data.id ? res.data : l))
      setShowAppointmentModal(false)
      showToast('Cita creada')
    } catch (error) {
      console.error('Error creating appointment:', error)
      showToast('Error al crear cita', 'error')
    }
  }

  // Dispatch appointment
  const dispatchAppointment = async (appointmentId, salespersonPhone) => {
    try {
      await api.post(`/api/appointments/${appointmentId}/dispatch`, {
        salesperson_phone: salespersonPhone
      })
      await fetchAppointments()
      setShowDispatchModal(false)
      showToast('Cita enviada')
    } catch (error) {
      console.error('Error dispatching appointment:', error)
      showToast('Error al enviar cita', 'error')
    }
  }

  // Upload Excel file
  const uploadFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/api/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      showToast(res.data.message)
      setShowUploadModal(false)
      fetchLeads()
    } catch (error) {
      console.error('Error uploading file:', error)
      showToast(error.response?.data?.error || 'Error al subir archivo', 'error')
    }
  }

  // Approve user
  const approveUser = async (userId) => {
    try {
      await api.post(`/api/users/${userId}/approve`)
      fetchUsers()
      showToast('Usuario aprobado')
    } catch (error) {
      showToast('Error al aprobar usuario', 'error')
    }
  }

  // Reject user
  const rejectUser = async (userId) => {
    try {
      await api.post(`/api/users/${userId}/reject`)
      fetchUsers()
      showToast('Usuario rechazado')
    } catch (error) {
      showToast('Error al rechazar usuario', 'error')
    }
  }

  // Mark alert as read
  const markAlertRead = async (alertId) => {
    try {
      await api.post(`/api/inbound-alerts/${alertId}/read`)
      fetchInboundAlerts()
      fetchAlertCount()
    } catch (error) {
      showToast('Error al marcar como leído', 'error')
    }
  }

  // Go to lead from alert
  const goToLeadFromAlert = async (alert) => {
    await markAlertRead(alert.id)
    if (alert.leads) {
      const res = await api.get(`/api/leads/${alert.lead_id}`)
      setSelectedLead(res.data)
      await Promise.all([
        fetchConversations(res.data.id),
        fetchCallHistory(res.data.id)
      ])
      setCurrentView('leadCard')
    }
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="Patagon" className="sidebar-logo" />
          <h1>Patagon Dialer</h1>
        </div>
        <nav>
          <button
            className={currentView === 'leads' || currentView === 'leadCard' ? 'active' : ''}
            onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}
          >
            Leads
          </button>
          <button
            className={currentView === 'inbound' ? 'active' : ''}
            onClick={() => setCurrentView('inbound')}
          >
            SMS Entrantes {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </button>
          <button
            className={currentView === 'appointments' ? 'active' : ''}
            onClick={() => setCurrentView('appointments')}
          >
            Citas
          </button>
          <button
            className={currentView === 'salespeople' ? 'active' : ''}
            onClick={() => setCurrentView('salespeople')}
          >
            Vendedores
          </button>
          {isAdmin && (
            <button
              className={currentView === 'users' ? 'active' : ''}
              onClick={() => setCurrentView('users')}
            >
              Gestión de Usuarios
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span>{user.first_name} {user.last_name}</span>
            <small>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</small>
          </div>
          <button className="logout-btn" onClick={onLogout}>Cerrar Sesión</button>
        </div>
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
                  placeholder="Buscar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                />
                {isAdmin && (
                  <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                    Subir Excel
                  </button>
                )}
              </div>
            </header>

            <div className="content">
              {/* Filters */}
              <div className="filters-row">
                {/* Status Filter */}
                <div className="filter-group">
                  <label>Estado:</label>
                  <div className="filter-tabs">
                    {['all', 'new', 'callback', 'appointment', 'no_answer', 'closed'].map(status => (
                      <button
                        key={status}
                        className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
                        onClick={() => { setStatusFilter(status); fetchLeads(1) }}
                      >
                        {STATUS_LABELS[status] || status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Disposition Filter */}
                <div className="filter-group">
                  <label>Disposición:</label>
                  <select
                    value={dispositionFilter}
                    onChange={(e) => { setDispositionFilter(e.target.value); fetchLeads(1) }}
                    className="filter-select"
                  >
                    <option value="all">Todas</option>
                    {DISPOSITIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div className="filter-group">
                  <label>Fecha:</label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => { setDateFilter(e.target.value); fetchLeads(1) }}
                    className="filter-date"
                  />
                  {dateFilter && (
                    <button className="btn btn-small btn-secondary" onClick={() => { setDateFilter(''); fetchLeads(1) }}>
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div className="filter-group">
                  <label>Ordenar:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); fetchLeads(1) }}
                    className="filter-select"
                  >
                    <option value="created_at">Fecha de Creación</option>
                    <option value="lead_date">Fecha del Lead</option>
                    <option value="first_name">Nombre</option>
                    <option value="status">Estado</option>
                  </select>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); fetchLeads(1) }}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : leads.length === 0 ? (
                <div className="empty-state">
                  <h3>No se encontraron leads</h3>
                  <p>{isAdmin ? 'Sube un archivo Excel para comenzar' : 'No hay leads disponibles'}</p>
                </div>
              ) : (
                <div className="lead-list">
                  <div className="lead-list-header">
                    <span>Nombre</span>
                    <span>Teléfono</span>
                    <span>Ciudad</span>
                    <span>Fecha</span>
                    <span>Estado</span>
                    <span>Acciones</span>
                  </div>
                  {leads.map((lead, index) => (
                    <div key={lead.id} className="lead-item" onClick={() => selectLead(lead, index)}>
                      <div className="lead-name">
                        {lead.first_name} {lead.last_name}
                        <small>{lead.job_group}</small>
                      </div>
                      <span>{lead.phone}</span>
                      <span>{lead.city}, {lead.state}</span>
                      <span>{lead.lead_date || '-'}</span>
                      <span className={`status-badge status-${lead.status}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                      <button className="btn btn-small btn-secondary" onClick={(e) => { e.stopPropagation(); selectLead(lead, index) }}>
                        Ver
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
                    Anterior
                  </button>
                  <span>Página {pagination.page} de {pagination.totalPages}</span>
                  <button
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => fetchLeads(pagination.page + 1)}
                  >
                    Siguiente
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
              <h2>Detalles del Lead</h2>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}>
                  Volver a Lista
                </button>
                <button className="btn btn-primary" onClick={() => setShowDispositionModal(true)}>
                  Agregar Disposición
                </button>
                <button className="btn btn-success" onClick={() => setShowAppointmentModal(true)}>
                  Agendar Cita
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
                  ← Lead Anterior
                </button>
                <span>Lead {selectedLeadIndex + 1} de {leads.length}</span>
                <button
                  className="nav-btn"
                  disabled={selectedLeadIndex === leads.length - 1}
                  onClick={() => navigateLead(1)}
                >
                  Siguiente Lead →
                </button>
              </div>

              <div className="lead-card-container">
                {/* Lead Card */}
                <div className="lead-card">
                  <div className="lead-card-header">
                    <h2>{selectedLead.first_name} {selectedLead.last_name}</h2>
                    <p>{selectedLead.job_group} | Fuente: {selectedLead.source}</p>
                    <span className={`status-badge status-${selectedLead.status}`}>
                      {STATUS_LABELS[selectedLead.status] || selectedLead.status}
                    </span>
                  </div>

                  <div className="lead-card-body">
                    <div className="lead-info-grid">
                      <div className="info-item">
                        <label>Dirección</label>
                        <span>{selectedLead.address}</span>
                      </div>
                      <div className="info-item">
                        <label>Ciudad, Estado, CP</label>
                        <span>{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</span>
                      </div>
                      <div className="info-item">
                        <label>Teléfono Principal</label>
                        <span>{selectedLead.phone}</span>
                      </div>
                      <div className="info-item">
                        <label>Teléfono 2</label>
                        <span>{selectedLead.phone2 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Teléfono 3</label>
                        <span>{selectedLead.phone3 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Fecha del Lead</label>
                        <span>{selectedLead.lead_date || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Phone Actions */}
                    <div className="phone-actions">
                      {selectedLead.phone && (
                        <a href={`tel:${selectedLead.phone}`} className="phone-btn">
                          Llamar {selectedLead.phone}
                        </a>
                      )}
                      {selectedLead.phone2 && (
                        <a href={`tel:${selectedLead.phone2}`} className="phone-btn">
                          Llamar {selectedLead.phone2}
                        </a>
                      )}
                      {selectedLead.phone3 && (
                        <a href={`tel:${selectedLead.phone3}`} className="phone-btn">
                          Llamar {selectedLead.phone3}
                        </a>
                      )}
                    </div>

                    {/* Call History Section */}
                    <CallHistorySection calls={callHistory} />

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

        {/* Inbound SMS View */}
        {currentView === 'inbound' && (
          <>
            <header className="header">
              <h2>SMS Entrantes</h2>
            </header>

            <div className="content">
              {inboundAlerts.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay mensajes entrantes</h3>
                  <p>Cuando los clientes respondan a tus SMS, aparecerán aquí</p>
                </div>
              ) : (
                <div className="inbound-list">
                  {inboundAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`inbound-item ${alert.status === 'unread' ? 'unread' : ''}`}
                      onClick={() => goToLeadFromAlert(alert)}
                    >
                      <div className="inbound-info">
                        <h4>{alert.leads?.first_name} {alert.leads?.last_name}</h4>
                        <p className="inbound-phone">{alert.phone}</p>
                        <p className="inbound-message">{alert.message}</p>
                        <small>{new Date(alert.created_at).toLocaleString()}</small>
                      </div>
                      <div className="inbound-status">
                        <span className={`status-badge status-${alert.status}`}>
                          {STATUS_LABELS[alert.status] || alert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Appointments View */}
        {currentView === 'appointments' && (
          <>
            <header className="header">
              <h2>Citas</h2>
            </header>

            <div className="content">
              {appointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay citas</h3>
                  <p>Agenda citas desde las tarjetas de leads</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {appointments.map(apt => (
                    <div key={apt.id} className="appointment-item">
                      <div className="appointment-info">
                        <h4>{apt.leads?.first_name} {apt.leads?.last_name}</h4>
                        <p>{apt.leads?.phone} | {apt.leads?.address}, {apt.leads?.city}</p>
                        <p><strong>Fecha:</strong> {apt.appointment_date} a las {apt.appointment_time}</p>
                        <p><strong>Estado:</strong> <span className={`status-badge status-${apt.status}`}>
                          {STATUS_LABELS[apt.status] || apt.status}
                        </span></p>
                      </div>
                      <div className="appointment-actions">
                        {apt.status !== 'dispatched' && (
                          <button
                            className="btn btn-success btn-small"
                            onClick={() => { setSelectedAppointment(apt); setShowDispatchModal(true) }}
                          >
                            Enviar
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
              <h2>Vendedores</h2>
            </header>

            <div className="content">
              <SalespeopleManager
                salespeople={salespeople}
                onRefresh={fetchSalespeople}
                showToast={showToast}
                isAdmin={isAdmin}
              />
            </div>
          </>
        )}

        {/* User Management View (Admin Only) */}
        {currentView === 'users' && isAdmin && (
          <>
            <header className="header">
              <h2>Gestión de Usuarios</h2>
            </header>

            <div className="content">
              <div className="users-list">
                <div className="lead-list-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 150px' }}>
                  <span>Nombre</span>
                  <span>Correo</span>
                  <span>Rol</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>
                {users.map(u => (
                  <div key={u.id} className="lead-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 150px' }}>
                    <span>{u.first_name} {u.last_name}</span>
                    <span>{u.email}</span>
                    <span className={`status-badge ${u.role === 'admin' ? 'status-appointment' : 'status-new'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Usuario'}
                    </span>
                    <span className={`status-badge status-${u.status === 'approved' ? 'appointment' : u.status === 'pending' ? 'callback' : 'closed'}`}>
                      {STATUS_LABELS[u.status] || u.status}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {u.status === 'pending' && (
                        <>
                          <button className="btn btn-success btn-small" onClick={() => approveUser(u.id)}>
                            Aprobar
                          </button>
                          <button className="btn btn-danger btn-small" onClick={() => rejectUser(u.id)}>
                            Rechazar
                          </button>
                        </>
                      )}
                      {u.status === 'rejected' && (
                        <button className="btn btn-success btn-small" onClick={() => approveUser(u.id)}>
                          Aprobar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

      {showUploadModal && isAdmin && (
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

// ==================== COMPONENTS ====================

// Call History Section Component
function CallHistorySection({ calls }) {
  if (!calls || calls.length === 0) {
    return (
      <div className="call-history-section">
        <h3>Historial de Llamadas</h3>
        <p className="empty-text">No hay llamadas registradas</p>
      </div>
    )
  }

  return (
    <div className="call-history-section">
      <h3>Historial de Llamadas</h3>
      <div className="call-history-list">
        {calls.map(call => (
          <div key={call.id} className={`call-item ${call.direction}`}>
            <div className="call-info">
              <span className={`call-direction ${call.direction}`}>
                {call.direction === 'inbound' ? '📞 Entrante' : '📱 Saliente'}
              </span>
              <span className="call-phone">{call.phone}</span>
              <span className="call-duration">{call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '-'}</span>
              <span className="call-date">{new Date(call.created_at).toLocaleString()}</span>
            </div>
            {call.recording_url && (
              <audio controls className="call-recording">
                <source src={call.recording_url} type="audio/mpeg" />
              </audio>
            )}
          </div>
        ))}
      </div>
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
      <h3>Notas</h3>
      <div className="notes-display">
        {lead.notes || 'Sin notas aún'}
      </div>
      <div className="notes-input">
        <textarea
          rows="2"
          placeholder="Agregar una nota..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSubmit}>Agregar</button>
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
        Conversación SMS
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
            <p>Sin mensajes aún</p>
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
          placeholder="Escribe un mensaje..."
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
          <h3>Agregar Disposición</h3>
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
            <label>Notas (opcional)</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar notas adicionales..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => onSave(selected, notes)}
          >
            Guardar Disposición
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
          <h3>Agendar Cita</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Asignar Vendedor</label>
            <select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
              <option value="">Seleccionar vendedor...</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de la cita..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-success"
            disabled={!date || !time}
            onClick={() => onSave({ appointment_date: date, appointment_time: time, salesperson_id: salespersonId || null, notes })}
          >
            Crear Cita
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
          <h3>Subir Leads</h3>
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
              <p><strong>{file.name}</strong> seleccionado</p>
            ) : (
              <>
                <p><strong>Clic para seleccionar archivo</strong></p>
                <p>Acepta .xlsx, .xls, .csv</p>
              </>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            <p><strong>Columnas esperadas:</strong></p>
            <p>Name, Address, City, State, Zip, Phone, Phone 2, Phone 3, Job Group, Date, Source</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Subiendo...' : 'Subir'}
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
          <h3>Enviar Cita</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 16 }}>
            Enviar detalles de la cita por SMS al vendedor.
          </p>

          <div className="form-group">
            <label>Teléfono del Vendedor</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={salespersonPhone || (selectedSalesperson?.phone || '')}
              onChange={(e) => setSalespersonPhone(e.target.value)}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, fontSize: '0.9rem' }}>
            <strong>Vista Previa del Mensaje:</strong>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
{`NUEVA CITA
Nombre: ${appointment.leads?.first_name} ${appointment.leads?.last_name}
Teléfono: ${appointment.leads?.phone}
Dirección: ${appointment.leads?.address}, ${appointment.leads?.city}, ${appointment.leads?.state} ${appointment.leads?.zip}
Trabajo: ${appointment.leads?.job_group}
Fecha: ${appointment.appointment_date}
Hora: ${appointment.appointment_time}
Notas: ${appointment.notes || 'N/A'}`}
            </pre>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-success"
            disabled={!salespersonPhone && !selectedSalesperson?.phone}
            onClick={() => onDispatch(appointment.id, salespersonPhone || selectedSalesperson?.phone)}
          >
            Enviar a Vendedor
          </button>
        </div>
      </div>
    </div>
  )
}

// Salespeople Manager Component
function SalespeopleManager({ salespeople, onRefresh, showToast, isAdmin }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.post('/api/salespeople', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim()
      })
      setName('')
      setPhone('')
      setEmail('')
      onRefresh()
      showToast('Vendedor agregado')
    } catch (error) {
      showToast('Error al agregar vendedor', 'error')
    }
    setAdding(false)
  }

  return (
    <div>
      {isAdmin && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Agregar Nuevo Vendedor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <input
              type="text"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
            />
            <input
              type="email"
              placeholder="Correo"
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
            {adding ? 'Agregando...' : 'Agregar Vendedor'}
          </button>
        </div>
      )}

      <div className="lead-list">
        <div className="lead-list-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <span>Nombre</span>
          <span>Teléfono</span>
          <span>Correo</span>
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
