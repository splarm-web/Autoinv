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
}

// Export
export const exportApi = {
  download: (from, to) => {
    const token = localStorage.getItem('autoinv_token')
    const url = `${API_URL}/api/export?from_date=${from}&to_date=${to}`
    // Descarga directa via anchor
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', '')
    // Añadir token como query param no es lo ideal pero es la manera más simple
    // para descarga de fichero sin fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  },
}
