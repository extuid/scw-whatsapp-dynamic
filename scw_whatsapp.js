/* === SCW WhatsApp Config Dinámico (versión segura y comentada) === */

document.addEventListener('DOMContentLoaded', function () {
  const CACHE_KEY = 'scw_config_cache';
  const CACHE_TIME_KEY = 'scw_config_cache_time';
  const CACHE_DURATION_MIN = 60;

  const parametroLimpieza = new URLSearchParams(window.location.search).get('clear_cache');
  const limpiarCache = parametroLimpieza === atob('bGltcGlhcl9jYWNoZV93aGF0c2FwcF8yMDI1'); // "limpiar_cache_whatsapp_2025"

  const esCacheValida = () => {
    const lastTime = parseInt(localStorage.getItem(CACHE_TIME_KEY), 10);
    return lastTime && (Date.now() - lastTime < CACHE_DURATION_MIN * 60000);
  };

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
        const encabezados = filas.shift().map(e => e.trim());
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
        localStorage.setItem(CACHE_KEY, JSON.stringify(configuracionSitios));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        inicializarWhatsapp(configuracionSitios);
      })
      .catch(err => console.error('❌ Error al cargar Google Sheet:', err));
  }
});

function inicializarWhatsapp(configuracionSitios) {
  const esperarElemento = setInterval(() => {
    const info = document.getElementById('scw-product-info');
    if (info) {
      clearInterval(esperarElemento);

      const hostname = window.location.hostname;
      let nombreSitio = 'Sticker Center';
      let whatsappNumber = '593961211100';
      let usarCodigoProducto = true;
      let usarSufijoDispositivo = true;

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

      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const sufijoDispositivo = usarSufijoDispositivo ? (isMobile ? '(m)' : '(c)') : '';

      const characteristic = info?.dataset.nombreCatalogo || '';
      const productCode = info?.dataset.codigo || '';
      nombreSitio = info?.dataset.sitio || nombreSitio;

      let mensajeProducto = '';
      if (characteristic) {
        mensajeProducto = `"${characteristic}`;
        if (usarCodigoProducto && productCode) {
          mensajeProducto += ` (cod. ${productCode})`;
        }
        mensajeProducto += `"`;
      }

      let messageNormal = `Hola ${nombreSitio}${sufijoDispositivo}`;
      let messageCompra = `Hola ${nombreSitio}${sufijoDispositivo}`;
      if (mensajeProducto) {
        messageNormal += `, me interesa ${mensajeProducto}`;
        messageCompra += `, quiero comprar ${mensajeProducto}`;
      } else {
        messageNormal += `!`;
        messageCompra += `!`;
      }

      document.querySelectorAll('.scw_btwhatsapp').forEach(button => {
        button.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageNormal)}`;
        button.addEventListener('click', () => enviarEventoClick(button, 'consulta'));
      });

      document.querySelectorAll('.scw_btwhatsapp-compra').forEach(button => {
        button.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageCompra)}`;
        button.addEventListener('click', () => enviarEventoClick(button, 'compra'));
      });

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

        let visitanteID = localStorage.getItem('scw_visitante_id');
        if (!visitanteID) {
          visitanteID = 'scw-' + Math.random().toString(36).substring(2, 10);
          localStorage.setItem('scw_visitante_id', visitanteID);
        }

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
  }, 100); // Espera cada 100ms hasta que #scw-product-info exista
}
