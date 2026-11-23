// app.js - Lógica de UI, pre-permiso y consumo del módulo geo-helper.js
// Regla: cero async/await. Todo se consume con .then() y .catch().

// ---------- Referencias del DOM ----------
const btnAdjuntar = document.getElementById('btn-adjuntar');
const btnConfirmar = document.getElementById('btn-confirmar');
const btnCancelar = document.getElementById('btn-cancelar');
const btnReintentar = document.getElementById('btn-reintentar');
const btnSucursal = document.getElementById('btn-sucursal');
const btnEnviar = document.getElementById('btn-enviar');
const btnAplicarZona = document.getElementById('btn-aplicar-zona');
const btnInstalar = document.getElementById('btn-instalar');
const chkAltaPrecision = document.getElementById('chk-alta-precision');

const tarjetaPrePermiso = document.getElementById('tarjeta-prepermiso');
const tarjetaManual = document.getElementById('tarjeta-manual');
const ayudaDenegado = document.getElementById('ayuda-denegado');
const estadoCarga = document.getElementById('estado-carga');
const mensajeError = document.getElementById('mensaje-error');
const tarjetaResultado = document.getElementById('tarjeta-resultado');
const selectorZona = document.getElementById('selector-zona');
const salidaPaquete = document.getElementById('salida-paquete');
const salidaSucursal = document.getElementById('salida-sucursal');
const estadoPermisoTexto = document.getElementById('estado-permiso');
const plataformaTexto = document.getElementById('plataforma');

// Última ubicación conocida (real o manual). Se adjunta al reporte.
let ubicacionActual = null;

// ---------- Datos de apoyo ----------
const ZONAS_MANUALES = {
  cdmx: { nombre: 'Ciudad de México (Centro)', latitud: 19.4326, longitud: -99.1332 },
  gdl: { nombre: 'Guadalajara', latitud: 20.6597, longitud: -103.3496 },
  mty: { nombre: 'Monterrey', latitud: 25.6866, longitud: -100.3161 },
  pue: { nombre: 'Puebla', latitud: 19.0414, longitud: -98.2063 },
  qro: { nombre: 'Querétaro', latitud: 20.5888, longitud: -100.3899 },
  mer: { nombre: 'Mérida', latitud: 20.9674, longitud: -89.5926 },
  tij: { nombre: 'Tijuana', latitud: 32.5149, longitud: -117.0382 }
};

const SUCURSALES = [
  { nombre: 'Sucursal Reforma (CDMX)', latitud: 19.4270, longitud: -99.1677 },
  { nombre: 'Sucursal Chapultepec (GDL)', latitud: 20.6736, longitud: -103.3700 },
  { nombre: 'Sucursal San Pedro (MTY)', latitud: 25.6576, longitud: -100.4029 },
  { nombre: 'Sucursal Angelópolis (PUE)', latitud: 19.0300, longitud: -98.2320 },
  { nombre: 'Sucursal Juriquilla (QRO)', latitud: 20.7080, longitud: -100.4460 },
  { nombre: 'Sucursal Montejo (MER)', latitud: 21.0000, longitud: -89.6180 },
  { nombre: 'Sucursal Zona Río (TIJ)', latitud: 32.5280, longitud: -117.0200 }
];

// ---------- Utilidades de UI ----------
function mostrar(elemento) { elemento.hidden = false; }
function ocultar(elemento) { elemento.hidden = true; }

function mostrarCargando(texto) {
  estadoCarga.textContent = texto;
  mostrar(estadoCarga);
}

function ocultarCargando() {
  ocultar(estadoCarga);
}

function mostrarMensajeError(texto) {
  mensajeError.textContent = texto;
  mostrar(mensajeError);
}

function limpiarMensajes() {
  ocultar(mensajeError);
  ocultar(btnReintentar);
  ocultar(ayudaDenegado);
}

function habilitarSelectorManualZona(mostrarAyudaDenegado) {
  mostrar(tarjetaManual);
  if (mostrarAyudaDenegado) {
    mostrar(ayudaDenegado);
  }
}

function detectarPlataforma() {
  const ua = navigator.userAgent;
  const esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/.test(ua);
  const esStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  let texto = 'Escritorio / Laptop (probablemente sin GPS: Wi-Fi o IP)';
  if (esIOS) texto = 'iPhone / iPad (Safari / WebKit)';
  if (esAndroid) texto = 'Android (Chrome / WebView)';
  if (esStandalone) texto += ' · PWA instalada';
  return { texto: texto, esIOS: esIOS, esStandalone: esStandalone };
}

function formatearCoordenada(valor) {
  return valor.toFixed(6);
}

// ---------- Renderizado del resultado ----------
function renderizarResultadoUbicacion(ubicacion) {
  const calidad = ubicacion.origen === 'manual'
    ? { nivel: 'manual', etiqueta: 'Zona seleccionada manualmente' }
    : clasificarPrecision(ubicacion.precisionMetros);

  document.getElementById('res-lat').textContent = formatearCoordenada(ubicacion.latitud);
  document.getElementById('res-lng').textContent = formatearCoordenada(ubicacion.longitud);
  document.getElementById('res-precision').textContent =
    ubicacion.precisionMetros !== null ? ubicacion.precisionMetros.toLocaleString('es-MX') + ' m' : 'N/D';
  document.getElementById('res-hora').textContent = new Date(ubicacion.timestamp).toLocaleTimeString('es-MX');
  document.getElementById('res-origen').textContent =
    ubicacion.origen === 'manual' ? 'Selector manual (Plan B)' : 'Geolocation API';

  const insignia = document.getElementById('res-insignia');
  insignia.textContent = calidad.etiqueta;
  insignia.className = 'insignia insignia-' + calidad.nivel;

  // Barra visual: 0 m = llena, 1000 m o más = casi vacía (escala logarítmica)
  const barra = document.getElementById('res-barra');
  let porcentaje = 100;
  if (ubicacion.precisionMetros !== null) {
    const log = Math.log10(Math.max(ubicacion.precisionMetros, 1));
    porcentaje = Math.max(5, Math.min(100, 100 - (log / 4) * 100));
  } else {
    porcentaje = 5;
  }
  barra.style.width = porcentaje + '%';
  barra.className = 'barra-relleno barra-' + calidad.nivel;

  const enlace = document.getElementById('res-mapa');
  enlace.href = 'https://www.openstreetmap.org/?mlat=' + ubicacion.latitud +
    '&mlon=' + ubicacion.longitud + '#map=16/' + ubicacion.latitud + '/' + ubicacion.longitud;

  mostrar(tarjetaResultado);
  btnEnviar.disabled = false;
}

// ---------- Lectura real (siempre nace de un clic) ----------
function leerUbicacionReal() {
  limpiarMensajes();
  ocultar(tarjetaPrePermiso);

  const altaPrecision = chkAltaPrecision.checked;
  mostrarCargando(altaPrecision
    ? 'Obteniendo coordenadas (alta precisión)...'
    : 'Obteniendo coordenadas (baja precisión)...');

  return obtenerUbicacionActual({ enableHighAccuracy: altaPrecision, timeout: altaPrecision ? 10000 : 8000 })
    .then((ubicacion) => {
      ubicacion.origen = 'gps';
      ubicacionActual = ubicacion;
      ocultarCargando();
      ocultar(tarjetaManual);
      renderizarResultadoUbicacion(ubicacion);
      actualizarEstadoPermiso();
      return ubicacion;
    })
    .catch((error) => {
      console.warn('[Geo] Fallback activado:', error.message);
      ocultarCargando();
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona(error.codigo === 1);

      // En TIMEOUT o señal no disponible ofrecemos reintentar sin forzar el GPS
      if (error.codigo === 2 || error.codigo === 3) {
        mostrar(btnReintentar);
      }
      actualizarEstadoPermiso();
    });
}

// ---------- Flujo de Pre-Permiso ----------
function iniciarFlujoUbicacion() {
  limpiarMensajes();

  consultarEstadoPermisoGeo()
    .then((estado) => {
      estadoPermisoTexto.textContent = estado;

      if (estado === 'granted') {
        leerUbicacionReal();
      } else if (estado === 'denied') {
        ocultar(tarjetaPrePermiso);
        mostrarMensajeError('El permiso de ubicación está bloqueado para este sitio.');
        habilitarSelectorManualZona(true);
      } else {
        // 'prompt': explicamos antes de lanzar el diálogo nativo
        mostrar(tarjetaPrePermiso);
        btnConfirmar.focus();
      }
    });
}

function actualizarEstadoPermiso() {
  consultarEstadoPermisoGeo().then((estado) => {
    estadoPermisoTexto.textContent = estado;
  });
}

// ---------- Plan B: selector manual ----------
function aplicarZonaManual() {
  const clave = selectorZona.value;
  if (!clave) {
    mostrarMensajeError('Selecciona una zona de la lista.');
    return;
  }
  const zona = ZONAS_MANUALES[clave];
  ubicacionActual = {
    latitud: zona.latitud,
    longitud: zona.longitud,
    precisionMetros: null,
    timestamp: Date.now(),
    origen: 'manual',
    zona: zona.nombre
  };
  ocultar(mensajeError);
  renderizarResultadoUbicacion(ubicacionActual);
}

// ---------- Reutilización 1: adjuntar coordenadas a un reporte ----------
function enviarReporteConUbicacion(datosFormulario) {
  if (!ubicacionActual) {
    mostrarMensajeError('Primero adjunta tu ubicación o selecciona una zona manual.');
    return Promise.resolve(null);
  }

  const paqueteCompleto = Object.assign({}, datosFormulario, {
    coordenadas: ubicacionActual,
    creadoEn: new Date().toISOString()
  });
  console.log('Paquete listo para enviar o encolar en IndexedDB:', paqueteCompleto);
  salidaPaquete.textContent = JSON.stringify(paqueteCompleto, null, 2);
  mostrar(salidaPaquete);
  return Promise.resolve(paqueteCompleto);
}

// ---------- Reutilización 2: sucursal más cercana (baja precisión) ----------
function distanciaKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * rad;
  const dLng = (b.longitud - a.longitud) * rad;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.latitud * rad) * Math.cos(b.latitud * rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mostrarSucursalCercana(origen) {
  const ordenadas = SUCURSALES
    .map((s) => ({ nombre: s.nombre, km: distanciaKm(origen, s) }))
    .sort((x, y) => x.km - y.km);
  const masCercana = ordenadas[0];
  salidaSucursal.textContent = 'Más cercana: ' + masCercana.nombre + ' a ' +
    masCercana.km.toFixed(1) + ' km de ' +
    (origen.origen === 'manual' ? origen.zona : 'tu posición') + '.';
  mostrar(salidaSucursal);
}

function buscarSucursalesCercanas() {
  // Si ya hay una ubicación (incluida la manual), se reutiliza sin pedir otra lectura
  if (ubicacionActual) {
    mostrarSucursalCercana(ubicacionActual);
    return Promise.resolve(ubicacionActual);
  }

  salidaSucursal.textContent = 'Buscando con lectura rápida de baja precisión...';
  mostrar(salidaSucursal);

  return consultarEstadoPermisoGeo()
    .then((estado) => {
      if (estado !== 'granted') {
        // No lanzamos el diálogo nativo sin pre-permiso: redirigimos al flujo ético
        salidaSucursal.textContent = 'Primero usa "Adjuntar mi ubicación" o elige una zona manual.';
        iniciarFlujoUbicacion();
        return null;
      }
      return obtenerUbicacionActual({ enableHighAccuracy: false, maximumAge: 60000 })
        .then((ubicacion) => {
          ubicacion.origen = 'gps';
          console.log('Filtrando sucursales cerca de ' + ubicacion.latitud + ', ' + ubicacion.longitud);
          mostrarSucursalCercana(ubicacion);
          return ubicacion;
        });
    })
    .catch((error) => {
      salidaSucursal.textContent = error.message;
      habilitarSelectorManualZona(error.codigo === 1);
    });
}

// ---------- Eventos ----------
btnAdjuntar.addEventListener('click', iniciarFlujoUbicacion);
btnConfirmar.addEventListener('click', leerUbicacionReal); // gesto directo (requisito iOS)
btnCancelar.addEventListener('click', () => {
  ocultar(tarjetaPrePermiso);
  habilitarSelectorManualZona(false);
});
btnReintentar.addEventListener('click', () => {
  chkAltaPrecision.checked = false;
  leerUbicacionReal();
});
btnAplicarZona.addEventListener('click', aplicarZonaManual);
btnSucursal.addEventListener('click', buscarSucursalesCercanas);
btnEnviar.addEventListener('click', () => {
  enviarReporteConUbicacion({
    titulo: document.getElementById('rep-titulo').value.trim() || 'Reporte sin título',
    descripcion: document.getElementById('rep-descripcion').value.trim()
  });
});

// ---------- Inicio (sin pedir ubicación automáticamente) ----------
document.addEventListener('DOMContentLoaded', () => {
  const plataforma = detectarPlataforma();
  plataformaTexto.textContent = plataforma.texto;

  if (plataforma.esIOS) {
    document.getElementById('nota-ios').hidden = false;
  }

  // Desktop sin GPS: sugerimos baja precisión para evitar TIMEOUT
  if (!plataforma.esIOS && !/Android/.test(navigator.userAgent)) {
    chkAltaPrecision.checked = false;
  }

  // Llenar selector manual
  Object.keys(ZONAS_MANUALES).forEach((clave) => {
    const opcion = document.createElement('option');
    opcion.value = clave;
    opcion.textContent = ZONAS_MANUALES[clave].nombre;
    selectorZona.appendChild(opcion);
  });

  actualizarEstadoPermiso();
});

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => console.log('[SW] Registrado con alcance:', registro.scope))
      .catch((error) => console.error('[SW] Error al registrar:', error));
  });
}

// ---------- Instalación ----------
let eventoInstalacion = null;
window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  eventoInstalacion = evento;
  mostrar(btnInstalar);
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacion) return;
  eventoInstalacion.prompt();
  eventoInstalacion.userChoice.then(() => {
    eventoInstalacion = null;
    ocultar(btnInstalar);
  });
});
