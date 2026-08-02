/**
 * Suscripción a notificaciones push (Web Push).
 *
 * Aviso importante sobre iOS: Safari solo entrega notificaciones si la PWA
 * está instalada en la pantalla de inicio. Abierta como web normal, la API
 * de permisos ni siquiera existe. Por eso `estadoPush()` distingue el caso
 * "no soportado aquí" del "soportado pero sin permiso": el primero se
 * resuelve instalando la app, el segundo dando permiso.
 */

import { automationApi } from './api'

export function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function esPWAInstalada() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function soportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Estado actual: 'no-soportado' | 'requiere-instalar' | 'denegado'
 *              | 'pendiente' (soportado, sin decidir) | 'activo'
 */
export async function estadoPush() {
  if (!soportaPush()) {
    return esIOS() && !esPWAInstalada() ? 'requiere-instalar' : 'no-soportado'
  }
  if (Notification.permission === 'denied') return 'denegado'
  if (Notification.permission !== 'granted') return 'pendiente'

  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'activo' : 'pendiente'
}

// La clave VAPID viaja en base64url; PushManager la quiere como Uint8Array
function base64UrlAUint8(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normal)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function serializar(sub) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  }
}

/** Pide permiso y registra este dispositivo. Devuelve el nuevo estado. */
export async function activarPush(vapidPublicKey) {
  if (!soportaPush()) {
    throw new Error(
      esIOS() && !esPWAInstalada()
        ? 'En iPhone hay que añadir la app a la pantalla de inicio para recibir notificaciones.'
        : 'Este navegador no admite notificaciones.',
    )
  }
  if (!vapidPublicKey) throw new Error('El servidor no tiene configuradas las claves de notificación.')

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error('No se ha dado permiso para las notificaciones.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8(vapidPublicKey),
    })
  }
  await automationApi.pushSubscribe(serializar(sub))
  return 'activo'
}

/** Da de baja este dispositivo. */
export async function desactivarPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await automationApi.pushUnsubscribe(serializar(sub)).catch(() => {})
    await sub.unsubscribe()
  }
  return 'pendiente'
}
