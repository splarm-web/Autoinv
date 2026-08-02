/* Manejadores de notificaciones push.
 *
 * Este fichero se inyecta en el service worker que genera Workbox
 * (vite.config.js → workbox.importScripts), en vez de cambiar toda la
 * estrategia a injectManifest solo por añadir dos listeners.
 */

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch (e) {
    datos = { title: 'autoinv', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'autoinv', {
      body: datos.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: datos.url || '/' },
      tag: 'autoinv-automation',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = event.notification.data?.url || '/'

  // Si la app ya está abierta, se reutiliza esa pestaña en vez de abrir otra
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ('focus' in ventana) {
          ventana.navigate?.(destino)
          return ventana.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
