import { createContext, useCallback, useContext, useState } from 'react'

/**
 * Densidad de la interfaz: cuánto ocupa todo en pantalla.
 *
 * Se aplica con `zoom` sobre la raíz en vez de tocar tamaños uno a uno. El
 * motivo es práctico: la mayoría de medidas de la app están en píxeles dentro
 * de estilos en línea, así que subir el tamaño base de la fuente no las
 * arrastraría. `zoom` sí escala todo —texto, iconos, márgenes y controles— y,
 * a diferencia de `transform`, **recalcula el layout**, así que el contenido
 * se reordena y no aparecen barras horizontales.
 *
 * Es preferencia de dispositivo, no de cuenta (como el tema): la misma persona
 * puede querer la letra grande en el móvil y normal en el ordenador.
 */

const DensityCtx = createContext(null)
export const useDensity = () => useContext(DensityCtx)

const STORAGE_KEY = 'autoinv_density'

export const DENSIDADES = [
  { key: 'compacta', label: 'Compacta', desc: 'Cabe más información en pantalla' },
  { key: 'normal',   label: 'Normal',   desc: 'El tamaño de siempre' },
  { key: 'comoda',   label: 'Cómoda',   desc: 'Texto y botones algo más grandes' },
  { key: 'grande',   label: 'Grande',   desc: 'Máxima legibilidad' },
]

const POR_DEFECTO = 'normal'

function aplicar(densidad) {
  document.documentElement.dataset.density = densidad
}

export function densidadGuardada() {
  const guardada = localStorage.getItem(STORAGE_KEY)
  return DENSIDADES.some((d) => d.key === guardada) ? guardada : POR_DEFECTO
}

export function DensityProvider({ children }) {
  const [densidad, setDensidad] = useState(
    () => document.documentElement.dataset.density || densidadGuardada(),
  )

  const cambiar = useCallback((siguiente) => {
    localStorage.setItem(STORAGE_KEY, siguiente)
    aplicar(siguiente)
    setDensidad(siguiente)
  }, [])

  return (
    <DensityCtx.Provider value={{ densidad, cambiar, densidades: DENSIDADES }}>
      {children}
    </DensityCtx.Provider>
  )
}
