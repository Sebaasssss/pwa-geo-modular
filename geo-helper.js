// geo-helper.js - Módulo reutilizable de geolocalización en Vanilla JS
// Toda la asincronía se expone mediante new Promise() (sin async/await).

// Umbral (en metros) para considerar una lectura como GPS de alta precisión
const UMBRAL_ALTA_PRECISION = 30;

function traducirErrorGeolocalizacion(error) {
  switch (error.code) {
    case 1: // error.PERMISSION_DENIED
      return 'Permiso de ubicación denegado. Puedes ingresar tu zona manualmente.';
    case 2: // error.POSITION_UNAVAILABLE
      return 'No fue posible determinar tu ubicación (señal GPS o Wi-Fi no disponible).';
    case 3: // error.TIMEOUT
      return 'Se agotó el tiempo de espera intentando obtener las coordenadas.';
    default:
      return 'Ocurrió un error inesperado al consultar la ubicación.';
  }
}

function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // Acepta una lectura reciente de hasta 30 segundos
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      const sinSoporte = new Error('Este navegador no soporta la API de Geolocalización.');
      sinSoporte.codigo = 0;
      reject(sinSoporte);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: Math.round(posicion.coords.accuracy),
          altitud: posicion.coords.altitude,
          velocidad: posicion.coords.speed,
          timestamp: posicion.timestamp
        });
      },
      (error) => {
        const errorTraducido = new Error(traducirErrorGeolocalizacion(error));
        errorTraducido.codigo = error.code; // 1, 2 o 3 para que el consumidor decida
        reject(errorTraducido);
      },
      opciones
    );
  });
}

function consultarEstadoPermisoGeo() {
  if (!('permissions' in navigator) || !navigator.permissions.query) {
    return Promise.resolve('prompt');
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => resultado.state) // 'granted', 'denied' o 'prompt'
    .catch(() => 'prompt');
}

// Clasifica la calidad de la señal según coords.accuracy
function clasificarPrecision(precisionMetros) {
  if (precisionMetros < UMBRAL_ALTA_PRECISION) {
    return { nivel: 'alta', etiqueta: 'Precisión GPS Alta' };
  }
  return { nivel: 'aproximada', etiqueta: 'Ubicación Aproximada (Wi-Fi / IP)' };
}
