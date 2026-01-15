import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import axios from 'axios'
import { Device } from '@twilio/voice-sdk'

const API_URL = import.meta.env.VITE_API_URL || ''

// Language Context
const LanguageContext = createContext()

// Translations
const TRANSLATIONS = {
  es: {
    // General
    leadManagementSystem: 'Sistema de Gestión de Leads',
    login: 'Iniciar Sesión',
    register: 'Registrarse',
    logout: 'Cerrar Sesión',
    cancel: 'Cancelar',
    save: 'Guardar',
    add: 'Agregar',
    view: 'Ver',
    send: 'Enviar',
    uploading: 'Subiendo...',
    upload: 'Subir',
    loading: 'Cargando...',
    pleaseWait: 'Por favor espere...',
    clear: 'Limpiar',
    search: 'Buscar',
    admin: 'Administrador',
    user: 'Usuario',

    // Auth
    email: 'Correo Electrónico',
    password: 'Contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    needAccount: '¿Necesitas una cuenta?',
    registrationSuccess: 'Registro exitoso. Por favor espere la aprobación del administrador.',
    errorOccurred: 'Ocurrió un error',

    // Navigation
    leads: 'Leads',
    inboundSMS: 'SMS Entrantes',
    appointments: 'Citas',
    salespeople: 'Vendedores',
    userManagement: 'Gestión de Usuarios',

    // Leads
    leadDetails: 'Detalles del Lead',
    backToList: 'Volver a Lista',
    addDisposition: 'Agregar Disposición',
    scheduleAppointment: 'Agendar Cita',
    previousLead: '← Lead Anterior',
    nextLead: 'Siguiente Lead →',
    leadOf: 'Lead {current} de {total}',
    searchLeads: 'Buscar leads...',
    uploadExcel: 'Subir Excel',
    createLead: 'Crear Lead',
    noLeadsFound: 'No se encontraron leads',
    uploadToStart: 'Sube un archivo Excel para comenzar',
    noLeadsAvailable: 'No hay leads disponibles',

    // Lead fields
    name: 'Nombre',
    phone: 'Teléfono',
    phone2: 'Teléfono 2',
    phone3: 'Teléfono 3',
    city: 'Ciudad',
    state: 'Estado',
    zip: 'Código Postal',
    address: 'Dirección',
    cityStateZip: 'Ciudad, Estado, CP',
    mainPhone: 'Teléfono Principal',
    leadDate: 'Fecha del Lead',
    source: 'Fuente',
    jobGroup: 'Grupo de Trabajo',
    date: 'Fecha',
    actions: 'Acciones',
    status: 'Estado',

    // Filters
    disposition: 'Disposición',
    allDispositions: 'Todas',
    sortBy: 'Ordenar',
    createdAt: 'Fecha de Creación',

    // Dispositions
    appointmentSet: 'Cita Agendada',
    callback: 'Devolver Llamada',
    notInterested: 'No Interesado',
    noAnswer: 'No Contesta',
    voicemail: 'Buzón de Voz',
    wrongNumber: 'Número Equivocado',
    busy: 'Ocupado',
    disconnected: 'Desconectado',

    // Status
    all: 'Todos',
    new: 'Nuevo',
    closed: 'Cerrado',
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    unread: 'No Leído',
    read: 'Leído',
    followUp: 'Seguimiento',
    scheduled: 'Programada',
    dispatched: 'Despachada',
    completed: 'Completada',

    // Calls
    callHistory: 'Historial de Llamadas',
    noCallsRecorded: 'No hay llamadas registradas',
    inbound: 'Entrante',
    outbound: 'Saliente',
    call: 'Llamar',

    // Notes
    notes: 'Notas',
    noNotesYet: 'Sin notas aún',
    addNote: 'Agregar una nota...',
    noteAdded: 'Nota agregada',

    // SMS
    smsConversation: 'Conversación SMS',
    noMessagesYet: 'Sin mensajes aún',
    writeMessage: 'Escribe un mensaje...',
    messageSent: 'Mensaje enviado',

    // Inbound
    noInboundMessages: 'No hay mensajes entrantes',
    inboundDescription: 'Cuando los clientes respondan a tus SMS, aparecerán aquí',

    // Appointments
    noAppointments: 'No hay citas',
    scheduleFromLeads: 'Agenda citas desde las tarjetas de leads',
    time: 'Hora',
    assignSalesperson: 'Asignar Vendedor',
    selectSalesperson: 'Seleccionar vendedor...',
    createAppointment: 'Crear Cita',
    appointmentCreated: 'Cita creada',
    dispatchAppointment: 'Enviar Cita',
    dispatchDescription: 'Enviar detalles de la cita por SMS al vendedor.',
    salespersonPhone: 'Teléfono del Vendedor',
    messagePreview: 'Vista Previa del Mensaje',
    sendToSalesperson: 'Enviar a Vendedor',
    appointmentSent: 'Cita enviada',
    newAppointment: 'NUEVA CITA',

    // Salespeople
    addNewSalesperson: 'Agregar Nuevo Vendedor',
    salespersonAdded: 'Vendedor agregado',
    adding: 'Agregando...',
    addSalesperson: 'Agregar Vendedor',

    // Users
    role: 'Rol',
    approve: 'Aprobar',
    reject: 'Rechazar',
    userApproved: 'Usuario aprobado',
    userRejected: 'Usuario rechazado',

    // Upload
    uploadLeads: 'Subir Leads',
    clickToSelect: 'Clic para seleccionar archivo',
    acceptedFormats: 'Acepta .xlsx, .xls, .csv',
    selected: 'seleccionado',
    expectedColumns: 'Columnas esperadas:',

    // Disposition Modal
    saveDisposition: 'Guardar Disposición',
    dispositionSaved: 'Disposición guardada',
    notesOptional: 'Notas (opcional)',
    additionalNotes: 'Agregar notas adicionales...',

    // Create Lead Modal
    createNewLead: 'Crear Nuevo Lead',
    createLeadBtn: 'Crear Lead',
    creating: 'Creando...',
    leadCreated: 'Lead creado exitosamente',
    fillRequiredFields: 'Por favor llena los campos requeridos',

    // Pagination
    previous: 'Anterior',
    next: 'Siguiente',
    page: 'Página',
    of: 'de',

    // Errors
    errorLoading: 'Error cargando',
    errorSending: 'Error al enviar',
    errorSaving: 'Error al guardar',
    errorCreating: 'Error al crear',
    errorUploading: 'Error al subir archivo',
    errorApproving: 'Error al aprobar',
    errorRejecting: 'Error al rechazar',
    errorMarking: 'Error al marcar como leído',

    // Dialer
    dialer: 'Teléfono',
    incomingCall: 'Llamada Entrante',
    answer: 'Contestar',
    hangUp: 'Colgar',
    calling: 'Llamando...',
    connected: 'Conectado',
    callEnded: 'Llamada Terminada',
    mute: 'Silenciar',
    unmute: 'Activar',
    dialerReady: 'Teléfono Listo',
    dialerConnecting: 'Conectando...',
    dialerOffline: 'Desconectado',
    callFrom: 'Llamada de'
  },
  en: {
    // General
    leadManagementSystem: 'Lead Management System',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    cancel: 'Cancel',
    save: 'Save',
    add: 'Add',
    view: 'View',
    send: 'Send',
    uploading: 'Uploading...',
    upload: 'Upload',
    loading: 'Loading...',
    pleaseWait: 'Please wait...',
    clear: 'Clear',
    search: 'Search',
    admin: 'Admin',
    user: 'User',

    // Auth
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    alreadyHaveAccount: 'Already have an account?',
    needAccount: 'Need an account?',
    registrationSuccess: 'Registration successful. Please wait for admin approval.',
    errorOccurred: 'An error occurred',

    // Navigation
    leads: 'Leads',
    inboundSMS: 'Inbound SMS',
    appointments: 'Appointments',
    salespeople: 'Salespeople',
    userManagement: 'User Management',

    // Leads
    leadDetails: 'Lead Details',
    backToList: 'Back to List',
    addDisposition: 'Add Disposition',
    scheduleAppointment: 'Schedule Appointment',
    previousLead: '← Previous Lead',
    nextLead: 'Next Lead →',
    leadOf: 'Lead {current} of {total}',
    searchLeads: 'Search leads...',
    uploadExcel: 'Upload Excel',
    createLead: 'Create Lead',
    noLeadsFound: 'No leads found',
    uploadToStart: 'Upload an Excel file to get started',
    noLeadsAvailable: 'No leads available',

    // Lead fields
    name: 'Name',
    phone: 'Phone',
    phone2: 'Phone 2',
    phone3: 'Phone 3',
    city: 'City',
    state: 'State',
    zip: 'Zip Code',
    address: 'Address',
    cityStateZip: 'City, State, Zip',
    mainPhone: 'Main Phone',
    leadDate: 'Lead Date',
    source: 'Source',
    jobGroup: 'Job Group',
    date: 'Date',
    actions: 'Actions',
    status: 'Status',

    // Filters
    disposition: 'Disposition',
    allDispositions: 'All',
    sortBy: 'Sort by',
    createdAt: 'Created Date',

    // Dispositions
    appointmentSet: 'Appointment Set',
    callback: 'Callback',
    notInterested: 'Not Interested',
    noAnswer: 'No Answer',
    voicemail: 'Voicemail',
    wrongNumber: 'Wrong Number',
    busy: 'Busy',
    disconnected: 'Disconnected',

    // Status
    all: 'All',
    new: 'New',
    closed: 'Closed',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    unread: 'Unread',
    read: 'Read',
    followUp: 'Follow Up',
    scheduled: 'Scheduled',
    dispatched: 'Dispatched',
    completed: 'Completed',

    // Calls
    callHistory: 'Call History',
    noCallsRecorded: 'No calls recorded',
    inbound: 'Inbound',
    outbound: 'Outbound',
    call: 'Call',

    // Notes
    notes: 'Notes',
    noNotesYet: 'No notes yet',
    addNote: 'Add a note...',
    noteAdded: 'Note added',

    // SMS
    smsConversation: 'SMS Conversation',
    noMessagesYet: 'No messages yet',
    writeMessage: 'Write a message...',
    messageSent: 'Message sent',

    // Inbound
    noInboundMessages: 'No inbound messages',
    inboundDescription: 'When customers reply to your SMS, they will appear here',

    // Appointments
    noAppointments: 'No appointments',
    scheduleFromLeads: 'Schedule appointments from lead cards',
    time: 'Time',
    assignSalesperson: 'Assign Salesperson',
    selectSalesperson: 'Select salesperson...',
    createAppointment: 'Create Appointment',
    appointmentCreated: 'Appointment created',
    dispatchAppointment: 'Dispatch Appointment',
    dispatchDescription: 'Send appointment details via SMS to salesperson.',
    salespersonPhone: 'Salesperson Phone',
    messagePreview: 'Message Preview',
    sendToSalesperson: 'Send to Salesperson',
    appointmentSent: 'Appointment sent',
    newAppointment: 'NEW APPOINTMENT',

    // Salespeople
    addNewSalesperson: 'Add New Salesperson',
    salespersonAdded: 'Salesperson added',
    adding: 'Adding...',
    addSalesperson: 'Add Salesperson',

    // Users
    role: 'Role',
    approve: 'Approve',
    reject: 'Reject',
    userApproved: 'User approved',
    userRejected: 'User rejected',

    // Upload
    uploadLeads: 'Upload Leads',
    clickToSelect: 'Click to select file',
    acceptedFormats: 'Accepts .xlsx, .xls, .csv',
    selected: 'selected',
    expectedColumns: 'Expected columns:',

    // Disposition Modal
    saveDisposition: 'Save Disposition',
    dispositionSaved: 'Disposition saved',
    notesOptional: 'Notes (optional)',
    additionalNotes: 'Add additional notes...',

    // Create Lead Modal
    createNewLead: 'Create New Lead',
    createLeadBtn: 'Create Lead',
    creating: 'Creating...',
    leadCreated: 'Lead created successfully',
    fillRequiredFields: 'Please fill required fields',

    // Pagination
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',

    // Errors
    errorLoading: 'Error loading',
    errorSending: 'Error sending',
    errorSaving: 'Error saving',
    errorCreating: 'Error creating',
    errorUploading: 'Error uploading file',
    errorApproving: 'Error approving',
    errorRejecting: 'Error rejecting',
    errorMarking: 'Error marking as read',

    // Dialer
    dialer: 'Phone',
    incomingCall: 'Incoming Call',
    answer: 'Answer',
    hangUp: 'Hang Up',
    calling: 'Calling...',
    connected: 'Connected',
    callEnded: 'Call Ended',
    mute: 'Mute',
    unmute: 'Unmute',
    dialerReady: 'Phone Ready',
    dialerConnecting: 'Connecting...',
    dialerOffline: 'Offline',
    callFrom: 'Call from'
  }
}

// Get disposition labels based on language
const getDispositions = (lang) => [
  { value: 'appointment_set', label: TRANSLATIONS[lang].appointmentSet, color: '#4caf50' },
  { value: 'callback', label: TRANSLATIONS[lang].callback, color: '#ff9800' },
  { value: 'not_interested', label: TRANSLATIONS[lang].notInterested, color: '#9e9e9e' },
  { value: 'no_answer', label: TRANSLATIONS[lang].noAnswer, color: '#f44336' },
  { value: 'voicemail', label: TRANSLATIONS[lang].voicemail, color: '#9c27b0' },
  { value: 'wrong_number', label: TRANSLATIONS[lang].wrongNumber, color: '#795548' },
  { value: 'busy', label: TRANSLATIONS[lang].busy, color: '#ff5722' },
  { value: 'disconnected', label: TRANSLATIONS[lang].disconnected, color: '#607d8b' }
]

// Get status labels based on language
const getStatusLabels = (lang) => ({
  all: TRANSLATIONS[lang].all,
  new: TRANSLATIONS[lang].new,
  callback: TRANSLATIONS[lang].callback,
  appointment: TRANSLATIONS[lang].appointmentSet,
  no_answer: TRANSLATIONS[lang].noAnswer,
  closed: TRANSLATIONS[lang].closed,
  appointment_set: TRANSLATIONS[lang].appointmentSet,
  not_interested: TRANSLATIONS[lang].notInterested,
  voicemail: TRANSLATIONS[lang].voicemail,
  wrong_number: TRANSLATIONS[lang].wrongNumber,
  busy: TRANSLATIONS[lang].busy,
  disconnected: TRANSLATIONS[lang].disconnected,
  pending: TRANSLATIONS[lang].pending,
  approved: TRANSLATIONS[lang].approved,
  rejected: TRANSLATIONS[lang].rejected,
  unread: TRANSLATIONS[lang].unread,
  read: TRANSLATIONS[lang].read,
  follow_up: TRANSLATIONS[lang].followUp,
  scheduled: TRANSLATIONS[lang].scheduled,
  dispatched: TRANSLATIONS[lang].dispatched,
  completed: TRANSLATIONS[lang].completed
})

// Custom hook for translations
function useTranslation() {
  const { lang, setLang } = useContext(LanguageContext)
  const t = TRANSLATIONS[lang]
  const DISPOSITIONS = getDispositions(lang)
  const STATUS_LABELS = getStatusLabels(lang)
  return { t, lang, setLang, DISPOSITIONS, STATUS_LABELS }
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
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'es')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

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

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <MainApp user={user} onLogout={handleLogout} />
      )}
    </LanguageContext.Provider>
  )
}

// ==================== LANGUAGE TOGGLE ====================
function LanguageToggle() {
  const { lang, setLang } = useTranslation()

  return (
    <div className="language-toggle">
      <button
        className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
        onClick={() => setLang('es')}
      >
        ES
      </button>
      <button
        className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  )
}

// ==================== LOGIN PAGE ====================
function LoginPage({ onLogin }) {
  const { t } = useTranslation()
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
        setSuccess(t.registrationSuccess)
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
      setError(err.response?.data?.error || t.errorOccurred)
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <LanguageToggle />
        <div className="login-header">
          <img src="/logo.png" alt="Patagon" className="login-logo" />
          <h1>Patagon Dialer</h1>
          <p>{t.leadManagementSystem}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {isRegister && (
            <div className="form-row">
              <div className="form-group">
                <label>{t.firstName}</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t.lastName}</label>
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
            <label>{t.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>{t.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t.pleaseWait : (isRegister ? t.register : t.login)}
          </button>
        </form>

        <div className="login-footer">
          {isRegister ? (
            <p>{t.alreadyHaveAccount} <button onClick={() => setIsRegister(false)}>{t.login}</button></p>
          ) : (
            <p>{t.needAccount} <button onClick={() => setIsRegister(true)}>{t.register}</button></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN APP ====================
function MainApp({ user, onLogout }) {
  const { t, DISPOSITIONS, STATUS_LABELS } = useTranslation()
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
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  // Dialer states
  const [device, setDevice] = useState(null)
  const [deviceStatus, setDeviceStatus] = useState('offline')
  const [activeCall, setActiveCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callStatus, setCallStatus] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [showDialer, setShowDialer] = useState(false)
  const [showQuickSMS, setShowQuickSMS] = useState(false)
  const [showQuickCall, setShowQuickCall] = useState(false)

  const isAdmin = user.role === 'admin'

  // Initialize Twilio Device
  useEffect(() => {
    let heartbeatInterval = null

    const initDevice = async () => {
      try {
        const res = await api.get('/api/voice/token')
        const twilioDevice = new Device(res.data.token, {
          codecPreferences: ['opus', 'pcmu'],
          enableRingingState: true
        })

        twilioDevice.on('registered', () => {
          console.log('Twilio Device ready')
          setDeviceStatus('ready')
        })

        twilioDevice.on('error', (error) => {
          console.error('Twilio Device error:', error)
          setDeviceStatus('error')
        })

        twilioDevice.on('incoming', (call) => {
          console.log('Incoming call from:', call.parameters.From)
          setIncomingCall(call)
          setCallStatus('incoming')

          call.on('cancel', () => {
            setIncomingCall(null)
            setCallStatus(null)
          })

          call.on('disconnect', () => {
            setIncomingCall(null)
            setActiveCall(null)
            setCallStatus('ended')
            setTimeout(() => setCallStatus(null), 2000)
          })
        })

        twilioDevice.on('tokenWillExpire', async () => {
          const newToken = await api.get('/api/voice/token')
          twilioDevice.updateToken(newToken.data.token)
        })

        await twilioDevice.register()
        setDevice(twilioDevice)

        // Send heartbeat every 2 minutes to stay registered as online
        heartbeatInterval = setInterval(() => {
          api.post('/api/voice/heartbeat').catch(err => console.log('Heartbeat error:', err))
        }, 2 * 60 * 1000)
      } catch (error) {
        console.error('Error initializing Twilio device:', error)
        setDeviceStatus('error')
      }
    }

    initDevice()

    return () => {
      if (device) {
        device.destroy()
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
    }
  }, [])

  // Make outbound call
  const makeCall = async (phoneNumber, leadId) => {
    if (!device || deviceStatus !== 'ready') {
      showToast('Teléfono no disponible', 'error')
      return
    }

    try {
      setCallStatus('calling')
      const call = await device.connect({
        params: {
          To: phoneNumber,
          leadId: leadId || ''
        }
      })

      setActiveCall(call)

      call.on('accept', () => {
        setCallStatus('connected')
      })

      call.on('disconnect', () => {
        setActiveCall(null)
        setCallStatus('ended')
        setTimeout(() => setCallStatus(null), 2000)
      })

      call.on('error', (error) => {
        console.error('Call error:', error)
        setActiveCall(null)
        setCallStatus(null)
        showToast('Error en la llamada', 'error')
      })
    } catch (error) {
      console.error('Error making call:', error)
      showToast('Error al llamar', 'error')
    }
  }

  // Answer incoming call
  const answerCall = () => {
    if (incomingCall) {
      incomingCall.accept()
      setActiveCall(incomingCall)
      setIncomingCall(null)
      setCallStatus('connected')
    }
  }

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.reject()
      setIncomingCall(null)
      setCallStatus(null)
    }
  }

  // Hang up call
  const hangUp = () => {
    if (activeCall) {
      activeCall.disconnect()
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (activeCall) {
      if (isMuted) {
        activeCall.mute(false)
      } else {
        activeCall.mute(true)
      }
      setIsMuted(!isMuted)
    }
  }

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
      showToast(error.response?.data?.error || t.errorUploading, 'error')
    }
  }

  // Create lead manually
  const createLead = async (leadData) => {
    try {
      await api.post('/api/leads', leadData)
      showToast(t.leadCreated)
      setShowCreateLeadModal(false)
      fetchLeads()
    } catch (error) {
      console.error('Error creating lead:', error)
      showToast(error.response?.data?.error || t.errorCreating, 'error')
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

  // Send quick SMS to any number
  const sendQuickSMS = async (phone, message) => {
    try {
      await api.post('/api/sms/send', { to: phone, message })
      showToast(t.messageSent)
      setShowQuickSMS(false)
    } catch (error) {
      console.error('Error sending SMS:', error)
      showToast(t.errorSending, 'error')
    }
  }

  // Quick call to any number
  const quickCall = (phone) => {
    if (device && deviceStatus === 'ready') {
      makeCall(phone, null)
      setShowQuickCall(false)
    } else {
      showToast(t.dialerOffline, 'error')
    }
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="Patagon" className="sidebar-logo" />
          <h1>Patagon Dialer</h1>
          <LanguageToggle />
        </div>
        <nav>
          <button
            className={currentView === 'leads' || currentView === 'leadCard' ? 'active' : ''}
            onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}
          >
            {t.leads}
          </button>
          <button
            className={currentView === 'inbound' ? 'active' : ''}
            onClick={() => setCurrentView('inbound')}
          >
            {t.inboundSMS} {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </button>
          <button
            className={currentView === 'appointments' ? 'active' : ''}
            onClick={() => setCurrentView('appointments')}
          >
            {t.appointments}
          </button>
          <button
            className={currentView === 'salespeople' ? 'active' : ''}
            onClick={() => setCurrentView('salespeople')}
          >
            {t.salespeople}
          </button>
          {isAdmin && (
            <button
              className={currentView === 'users' ? 'active' : ''}
              onClick={() => setCurrentView('users')}
            >
              {t.userManagement}
            </button>
          )}
        </nav>
        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-btn sms" onClick={() => setShowQuickSMS(true)}>
            💬 SMS
          </button>
          <button
            className={`quick-btn call ${deviceStatus === 'ready' ? 'ready' : ''}`}
            onClick={() => setShowQuickCall(true)}
            disabled={deviceStatus !== 'ready'}
          >
            📞 {t.call}
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <span>{user.first_name} {user.last_name}</span>
            <small>{user.role === 'admin' ? t.admin : t.user}</small>
          </div>
          <button className="logout-btn" onClick={onLogout}>{t.logout}</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Leads List View */}
        {currentView === 'leads' && (
          <>
            <header className="header">
              <h2>{t.leads} ({pagination.total})</h2>
              <div className="header-actions">
                <input
                  type="text"
                  className="search-input"
                  placeholder={t.searchLeads}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                />
                <button className="btn btn-success" onClick={() => setShowCreateLeadModal(true)}>
                  + {t.createLead}
                </button>
                {isAdmin && (
                  <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                    {t.uploadExcel}
                  </button>
                )}
              </div>
            </header>

            <div className="content">
              {/* Filters */}
              <div className="filters-row">
                {/* Status Filter */}
                <div className="filter-group">
                  <label>{t.status}:</label>
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
                  <label>{t.disposition}:</label>
                  <select
                    value={dispositionFilter}
                    onChange={(e) => { setDispositionFilter(e.target.value); fetchLeads(1) }}
                    className="filter-select"
                  >
                    <option value="all">{t.allDispositions}</option>
                    {DISPOSITIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div className="filter-group">
                  <label>{t.date}:</label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => { setDateFilter(e.target.value); fetchLeads(1) }}
                    className="filter-date"
                  />
                  {dateFilter && (
                    <button className="btn btn-small btn-secondary" onClick={() => { setDateFilter(''); fetchLeads(1) }}>
                      {t.clear}
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div className="filter-group">
                  <label>{t.sortBy}:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); fetchLeads(1) }}
                    className="filter-select"
                  >
                    <option value="created_at">{t.createdAt}</option>
                    <option value="lead_date">{t.leadDate}</option>
                    <option value="first_name">{t.name}</option>
                    <option value="status">{t.status}</option>
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
                  <h3>{t.noLeadsFound}</h3>
                  <p>{isAdmin ? t.uploadToStart : t.noLeadsAvailable}</p>
                </div>
              ) : (
                <div className="lead-list">
                  <div className="lead-list-header">
                    <span>{t.name}</span>
                    <span>{t.phone}</span>
                    <span>{t.city}</span>
                    <span>{t.date}</span>
                    <span>{t.status}</span>
                    <span>{t.actions}</span>
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
                        {t.view}
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
                    {t.previous}
                  </button>
                  <span>{t.page} {pagination.page} {t.of} {pagination.totalPages}</span>
                  <button
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => fetchLeads(pagination.page + 1)}
                  >
                    {t.next}
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
              <h2>{t.leadDetails}</h2>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => { setCurrentView('leads'); setSelectedLead(null) }}>
                  {t.backToList}
                </button>
                <button className="btn btn-primary" onClick={() => setShowDispositionModal(true)}>
                  {t.addDisposition}
                </button>
                <button className="btn btn-success" onClick={() => setShowAppointmentModal(true)}>
                  {t.scheduleAppointment}
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
                  {t.previousLead}
                </button>
                <span>{t.leadOf.replace('{current}', selectedLeadIndex + 1).replace('{total}', leads.length)}</span>
                <button
                  className="nav-btn"
                  disabled={selectedLeadIndex === leads.length - 1}
                  onClick={() => navigateLead(1)}
                >
                  {t.nextLead}
                </button>
              </div>

              <div className="lead-card-container">
                {/* Lead Card */}
                <div className="lead-card">
                  <div className="lead-card-header">
                    <h2>{selectedLead.first_name} {selectedLead.last_name}</h2>
                    <p>{selectedLead.job_group} | {t.source}: {selectedLead.source}</p>
                    <span className={`status-badge status-${selectedLead.status}`}>
                      {STATUS_LABELS[selectedLead.status] || selectedLead.status}
                    </span>
                  </div>

                  <div className="lead-card-body">
                    <div className="lead-info-grid">
                      <div className="info-item">
                        <label>{t.address}</label>
                        <span>{selectedLead.address}</span>
                      </div>
                      <div className="info-item">
                        <label>{t.cityStateZip}</label>
                        <span>{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</span>
                      </div>
                      <div className="info-item">
                        <label>{t.mainPhone}</label>
                        <span>{selectedLead.phone}</span>
                      </div>
                      <div className="info-item">
                        <label>{t.phone2}</label>
                        <span>{selectedLead.phone2 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>{t.phone3}</label>
                        <span>{selectedLead.phone3 || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>{t.leadDate}</label>
                        <span>{selectedLead.lead_date || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Phone Actions */}
                    <div className="phone-actions">
                      {selectedLead.phone && (
                        <button
                          className="phone-btn"
                          onClick={() => makeCall(selectedLead.phone, selectedLead.id)}
                          disabled={deviceStatus !== 'ready' || callStatus}
                        >
                          📞 {t.call} {selectedLead.phone}
                        </button>
                      )}
                      {selectedLead.phone2 && (
                        <button
                          className="phone-btn"
                          onClick={() => makeCall(selectedLead.phone2, selectedLead.id)}
                          disabled={deviceStatus !== 'ready' || callStatus}
                        >
                          📞 {t.call} {selectedLead.phone2}
                        </button>
                      )}
                      {selectedLead.phone3 && (
                        <button
                          className="phone-btn"
                          onClick={() => makeCall(selectedLead.phone3, selectedLead.id)}
                          disabled={deviceStatus !== 'ready' || callStatus}
                        >
                          📞 {t.call} {selectedLead.phone3}
                        </button>
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

      {showCreateLeadModal && (
        <CreateLeadModal
          onClose={() => setShowCreateLeadModal(false)}
          onCreate={createLead}
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

      {/* Quick SMS Modal */}
      {showQuickSMS && (
        <QuickSMSModal
          onClose={() => setShowQuickSMS(false)}
          onSend={sendQuickSMS}
        />
      )}

      {/* Quick Call Modal */}
      {showQuickCall && (
        <QuickCallModal
          onClose={() => setShowQuickCall(false)}
          onCall={quickCall}
          deviceStatus={deviceStatus}
        />
      )}

      {/* Incoming Call Notification */}
      {incomingCall && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-modal">
            <div className="incoming-call-icon">📞</div>
            <h3>{t.incomingCall}</h3>
            <p>{t.callFrom}: {incomingCall.parameters?.From || 'Unknown'}</p>
            <div className="incoming-call-actions">
              <button className="btn btn-success btn-large" onClick={answerCall}>
                {t.answer}
              </button>
              <button className="btn btn-danger btn-large" onClick={rejectCall}>
                {t.hangUp}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Bar */}
      {callStatus && callStatus !== 'incoming' && (
        <div className={`call-bar ${callStatus}`}>
          <div className="call-bar-status">
            <span className="call-indicator"></span>
            {callStatus === 'calling' && t.calling}
            {callStatus === 'connected' && t.connected}
            {callStatus === 'ended' && t.callEnded}
          </div>
          {callStatus === 'connected' && (
            <div className="call-bar-actions">
              <button className={`call-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute}>
                {isMuted ? t.unmute : t.mute}
              </button>
              <button className="call-btn hangup" onClick={hangUp}>
                {t.hangUp}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phone Status Indicator */}
      <div className={`phone-status ${deviceStatus}`}>
        <span className="phone-icon">📱</span>
        {deviceStatus === 'ready' && t.dialerReady}
        {deviceStatus === 'offline' && t.dialerOffline}
        {deviceStatus === 'error' && t.dialerOffline}
      </div>

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
  const { t, DISPOSITIONS } = useTranslation()
  const [selected, setSelected] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t.addDisposition}</h3>
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
            <label>{t.notesOptional}</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.additionalNotes}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => onSave(selected, notes)}
          >
            {t.saveDisposition}
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
  const { t } = useTranslation()
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
          <h3>{t.uploadLeads}</h3>
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
              <p><strong>{file.name}</strong> {t.selected}</p>
            ) : (
              <>
                <p><strong>{t.clickToSelect}</strong></p>
                <p>{t.acceptedFormats}</p>
              </>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            <p><strong>{t.expectedColumns}</strong></p>
            <p>Name, Address, City, State, Zip, Phone, Phone 2, Phone 3, Job Group, Date, Source</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? t.uploading : t.upload}
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Lead Modal Component
function CreateLeadModal({ onClose, onCreate }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    phone2: '',
    phone3: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    job_group: '',
    source: 'Manual',
    lead_date: new Date().toISOString().split('T')[0]
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.phone) {
      setError(t.fillRequiredFields)
      return
    }
    setCreating(true)
    setError('')
    await onCreate(formData)
    setCreating(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t.createNewLead}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label>{t.firstName} *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>{t.lastName}</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.phone} *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>{t.phone2}</label>
              <input
                type="tel"
                name="phone2"
                value={formData.phone2}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.phone3}</label>
              <input
                type="tel"
                name="phone3"
                value={formData.phone3}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.address}</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.city}</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.state}</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.zip}</label>
              <input
                type="text"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.jobGroup}</label>
              <input
                type="text"
                name="job_group"
                value={formData.job_group}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.source}</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{t.leadDate}</label>
              <input
                type="date"
                name="lead_date"
                value={formData.lead_date}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-success"
            disabled={creating}
            onClick={handleSubmit}
          >
            {creating ? t.creating : t.createLeadBtn}
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

// Quick SMS Modal Component
function QuickSMSModal({ onClose, onSend }) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) return
    setSending(true)
    await onSend(phone.trim(), message.trim())
    setSending(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>SMS</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t.phone} *</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t.writeMessage} *</label>
            <textarea
              rows="4"
              placeholder={t.writeMessage}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-primary"
            disabled={!phone.trim() || !message.trim() || sending}
            onClick={handleSend}
          >
            {sending ? t.pleaseWait : t.send}
          </button>
        </div>
      </div>
    </div>
  )
}

// Quick Call Modal Component
function QuickCallModal({ onClose, onCall, deviceStatus }) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')

  const handleCall = () => {
    if (!phone.trim()) return
    onCall(phone.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t.call}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {deviceStatus !== 'ready' && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {t.dialerOffline}
            </div>
          )}
          <div className="form-group">
            <label>{t.phone} *</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCall()}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
          <button
            className="btn btn-success"
            disabled={!phone.trim() || deviceStatus !== 'ready'}
            onClick={handleCall}
          >
            {t.call}
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
