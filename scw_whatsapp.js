document.addEventListener('DOMContentLoaded', function () {
  // Claves para el almacenamiento en caché local
  const CACHE_KEY = 'scw_config_cache';
  const CACHE_TIME_KEY = 'scw_config_cache_time';

  // Duración del caché en minutos
  const CACHE_DURATION_MIN = 60;

  const parametroLimpieza = new URLSearchParams(window.location.search).get('clear_cache');
  const limpiarCache = parametroLimpieza === atob('bGltcGlhcl9jYWNoZV93aGF0c2FwcF8yMDI1');

  // Valida si el caché actual aún es válido
  const esCacheValida = () => {
    const lastTime = parseInt(localStorage.getItem(CACHE_TIME_KEY), 10);
    return lastTime && (Date.now() - lastTime < CACHE_DURATION_MIN * 60000);
  };

  // Determina si se usará la caché o se recargará desde Sheets
  const usarCache = !limpiarCache && esCacheValida();
  const cacheRaw = localStorage.getItem(CACHE_KEY);

  if (usarCache && cacheRaw) {
    console.log('[SCW] Usando configuración desde caché.');
    const config = JSON.parse(cacheRaw);
    inicializarWhatsapp(config);
  } else {
    console.log('[SCW] Cargando configuración desde Google Sheets...');
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTPoOFV_b6K5fBZD9tPfGqJmtbjqSZcr5lqj5AP0kqkPfy_WCTcG0oFAubX3ytTO1DeHySzjJVuKytK/pub?output=csv')
      .then(res => res.text())
      .then(text => {
        const configuracionSitios = {};
        const filas = text.trim().split('\n').map(l => l.split(','));
        const encabezados = filas.shift().map(e => e.trim()); // Lee la primera fila como encabezados

        // Procesa cada fila del CSV como objeto por dominio
        filas.forEach(fila => {
          const filaObj = {};
          encabezados.forEach((col, idx) => {
            filaObj[col] = fila[idx]?.trim();
          });
          const dominio = filaObj['dominio'];
          if (dominio) {
            configuracionSitios[dominio] = {
              nombre: filaObj['nombre'],
              numero: filaObj['numero'],
              usarCodigoProducto: filaObj['usarCodigoProducto'] === 'TRUE',
              usarSufijoDispositivo: filaObj['usarSufijoDispositivo'] === 'TRUE'
            };
          }
        });

        // Guarda en caché para uso posterior
        localStorage.setItem(CACHE_KEY, JSON.stringify(configuracionSitios));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

        inicializarWhatsapp(configuracionSitios);
      })
      .catch(err => console.error('❌ Error al cargar Google Sheet:', err));
  }
});

// ⚙️ Función que aplica la configuración cargada al DOM y enlaces
function inicializarWhatsapp(configuracionSitios) {
  const hostname = window.location.hostname;

  // Valores por defecto si no se encuentra el dominio
  let nombreSitio = 'Sticker Center';
  let whatsappNumber = '593961211100';
  let usarCodigoProducto = true;
  let usarSufijoDispositivo = true;

  // Busca la configuración del dominio actual
  for (const dominio in configuracionSitios) {
    if (hostname.includes(dominio)) {
      const config = configuracionSitios[dominio];
      nombreSitio = config.nombre;
      whatsappNumber = config.numero;
      usarCodigoProducto = config.usarCodigoProducto;
      usarSufijoDispositivo = config.usarSufijoDispositivo;
      break;
    }
  }

  // Detecta si es móvil para ajustar mensaje
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const sufijoDispositivo = usarSufijoDispositivo ? (isMobile ? '(m)' : '(c)') : '';

  // Lee información del producto desde el DOM
  const info = document.getElementById('scw-product-info');
  const characteristic = info?.dataset.nombreCatalogo || '';
  const productCode = info?.dataset.codigo || '';
  nombreSitio = info?.dataset.sitio || nombreSitio;

  // Construye el mensaje del producto (opcional)
  let mensajeProducto = '';
  if (characteristic) {
    mensajeProducto = `"${characteristic}`;
    if (usarCodigoProducto && productCode) {
      mensajeProducto += ` (cod. ${productCode})`;
    }
    mensajeProducto += `"`;
  }

  // Mensajes personalizados para los botones
  let messageNormal = `Hola ${nombreSitio}${sufijoDispositivo}`;
  let messageCompra = `Hola ${nombreSitio}${sufijoDispositivo}`;
  if (mensajeProducto) {
    messageNormal += `, me interesa ${mensajeProducto}`;
    messageCompra += `, quiero comprar ${mensajeProducto}`;
  } else {
    messageNormal += '!';
    messageCompra += '!';
  }

  // Inserta el mensaje en los botones estándar
  document.querySelectorAll('.scw_btwhatsapp').forEach(button => {
    button.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageNormal)}`;
    button.addEventListener('click', () => enviarEventoClick(button, 'consulta'));
  });

  // Inserta el mensaje en los botones de compra
  document.querySelectorAll('.scw_btwhatsapp-compra').forEach(button => {
    button.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageCompra)}`;
    button.addEventListener('click', () => enviarEventoClick(button, 'compra'));
  });

  // 🧾 Función para registrar clics y enviar eventos a GA
  const enviarEventoClick = (element, tipoBoton) => {
    const esDebug = new URLSearchParams(window.location.search).get('debug') === '1';
    const origen = element.getAttribute('data-scw-origen') || 'desconocido';
    const paginaActual = window.location.href;
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toTimeString().split(' ')[0];
    const referer = document.referrer || 'directo';
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get('utm_source') || '';
    const utm_medium = params.get('utm_medium') || '';
    const utm_campaign = params.get('utm_campaign') || '';
    const telefonoLegible = whatsappNumber.replace(/^593/, '0').replace(/(...)(...)(....)/, '$1 $2 $3');

    // ID de visitante único por navegador
    let visitanteID = localStorage.getItem('scw_visitante_id');
    if (!visitanteID) {
      visitanteID = 'scw-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('scw_visitante_id', visitanteID);
    }

    // Google Analytics (si está cargado)
    if (window.gtag) {
      gtag('event', esDebug ? 'click_whatsapp_test' : 'click_whatsapp', {
        event_category: esDebug ? 'WhatsApp Debug' : 'WhatsApp',
        event_label: `${tipoBoton} - ${origen}`,
        value: 1,
        page_location: paginaActual,
        idioma: navigator.language,
        click_date: fecha,
        click_time: hora
      });
    }

    // Reporte a backend (registro personalizado)
    fetch('/integrations/whatsapp_dinamico/report/guardar_whatsapp_click.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: tipoBoton,
        origen,
        url: paginaActual,
        caracteristica: mensajeProducto || null,
        sitio: nombreSitio,
        telefono: telefonoLegible,
        referer,
        utm_source,
        utm_medium,
        utm_campaign,
        debug: esDebug,
        visitante: visitanteID
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status !== 'ok') {
        console.warn('[SCW TRACKING] Error al guardar clic en el log:', data.message);
      } else {
        console.log('[SCW TRACKING] OK - clic guardado');
      }
    })
    .catch(err => console.error('[SCW TRACKING] Error al registrar clic:', err));
  };
}

// Ejemplo enlace botón whatsapp estándar:
// <a class="scw_btwhatsapp" data-scw-origen="ficha-producto" target="_blank">Consultar por WhatsApp</a>

// Ejemplo enlace botón whatsapp compra:
// <a class="scw_btwhatsapp-compra" data-scw-origen="popup-oferta" target="_blank">Comprar por WhatsApp</a>
