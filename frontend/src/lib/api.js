const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('autoinv_token')
  const isFormData = opts.body instanceof FormData

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de red' }))
    throw new Error(err.detail || `Error ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

// Auth
export const authApi = {
  register: (data) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiFetch('/api/auth/me'),
  updateMe: (data) =>
    apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
}

// Dashboard
export const dashboardApi = {
  get: (periodo = 'trimestre') => apiFetch(`/api/dashboard?periodo=${periodo}`),
}

// Expenses
export const expensesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/expenses${qs ? `?${qs}` : ''}`)
  },
  create: (data) =>
    apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    apiFetch(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }),
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiFetch('/api/expenses/upload', { method: 'POST', body: fd })
  },
  confirm: (data, tempPath) => {
    const fd = new FormData()
    fd.append('data', JSON.stringify(data))
    fd.append('temp_path', tempPath)
    return apiFetch('/api/expenses/confirm', { method: 'POST', body: fd })
  },
  categories: () => apiFetch('/api/expenses/categories'),
}

// Invoices
export const invoicesApi = {
  list: () => apiFetch('/api/invoices'),
  create: (data) =>
    apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiFetch(`/api/invoices/${id}`),
  delete: (id) => apiFetch(`/api/invoices/${id}`, { method: 'DELETE' }),
  downloadPdf: async (id, number) => {
    const token = localStorage.getItem('autoinv_token')
    const res = await fetch(`${API_URL}/api/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('No se pudo generar el PDF')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `Factura-${(number || id).toString().replace(/[/\\]/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(blobUrl)
  },
  // Facturas de transporte (formato "Alfredo")
  parseTransporteExcel: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiFetch('/api/invoices/transporte/parse-excel', { method: 'POST', body: fd })
  },
  saveTransporte: (data) =>
    apiFetch('/api/invoices/transporte', { method: 'POST', body: JSON.stringify(data) }),
  transportePdf: async (data) => {
    const token = localStorage.getItem('autoinv_token')
    const res = await fetch(`${API_URL}/api/invoices/transporte/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'No se pudo generar el PDF' }))
      throw new Error(err.detail || 'No se pudo generar el PDF')
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `Factura-${(data.numero_factura || 'transporte').toString().replace(/[/\\]/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(blobUrl)
  },
}

// Clients
export const clientsApi = {
  list: () => apiFetch('/api/clients'),
  create: (data) => apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setDefault: (id) => apiFetch(`/api/clients/${id}/set-default`, { method: 'POST' }),
  delete: (id) => apiFetch(`/api/clients/${id}`, { method: 'DELETE' }),
}

// Export
async function downloadZip(url, fallbackName) {
  const token = localStorage.getItem('autoinv_token')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'No se pudo exportar' }))
    throw new Error(err.detail || 'No se pudo exportar')
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fallbackName
  a.click()
  URL.revokeObjectURL(blobUrl)
}

export const exportApi = {
  download: (from, to) =>
    downloadZip(`${API_URL}/api/export?from_date=${from}&to_date=${to}`, `autoinv_${from}_${to}.zip`),
  downloadQuarters: (years, quarters) => {
    const params = new URLSearchParams()
    years.forEach((y) => params.append('years', y))
    quarters.forEach((q) => params.append('quarters', q))
    return downloadZip(`${API_URL}/api/export?${params.toString()}`, 'autoinv_trimestres.zip')
  },
}
