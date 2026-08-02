/**
 * Mantiene la app al día sin depender de que el usuario limpie la caché.
 *
 * El service worker sirve la versión guardada, así que un móvil puede quedarse
 * semanas ejecutando código antiguo: se ven fallos ya corregidos y no hay
 * forma razonable de explicarle a alguien cómo borrar los datos del sitio en
 * su teléfono. Aquí se le pide al navegador que compruebe si hay versión nueva
 * al abrir la app, al volver a ella y cada media hora; como el service worker
 * toma el control de inmediato (skipWaiting + clientsClaim en vite.config),
 * con eso se actualiza solo.
 */

const CADA = 30 * 60 * 1000

export function vigilarActualizaciones() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return

    const comprobar = () => reg.update().catch(() => {})

    comprobar()
    setInterval(comprobar, CADA)

    // Al volver a la app tras dejarla en segundo plano, que es justo cuando
    // más probable es que haya habido un despliegue entre medias
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') comprobar()
    })
  }).catch(() => {})

  // Cuando el service worker nuevo toma el control, recargar una sola vez
  // para que la página deje de usar el código viejo que ya tiene en memoria.
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return
    recargando = true
    window.location.reload()
  })
}
