// Sorteo final en la pantalla LED: cuenta atrás, animación de suspense por cada ganador y tablero
// final. Tres estilos de suspense: 'tragaperras' (carrete de nombres que frena), 'eliminacion'
// (todos los nombres en pantalla y se van apagando) y 'letras' (el nombre se descifra letra a letra).
//
// Todo lo que se ve es función del tiempo transcurrido desde que se lanzó el sorteo (reloj del
// servidor): si el player recarga la página a mitad, engancha en el punto exacto, y el iPad puede
// poner el redoble a la vez. Los ganadores vienen ya decididos del servidor; aquí solo se anima.
//
// Script clásico (ES5) como rueda.js, por si el navegador del player es antiguo. Uso:
//   var sorteoUI = crearSorteo(stage, { confeti: confeti });
//   sorteoUI.setMarca(logoUrl, nombreOptica);       // logo de la cabecera (o el nombre si no hay logo)
//   sorteoUI.actualizar(estado.sorteo || null, Date.parse(estado.ahora) - Date.now());
(function () {
  var imul = Math.imul || function (a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  };
  // Azar con semilla (mulberry32): la misma semilla da el mismo carrete en cada recarga.
  function prng(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = imul(a ^ (a >>> 15), 1 | a);
      t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function barajar(lista, rnd) {
    var a = lista.slice(), i, j, x;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Tamaño de letra para que un texto en mayúsculas (Montserrat 900) quepa en un ancho.
  function tamFuente(texto, ancho, maximo) {
    var n = Math.max(1, String(texto).length);
    return Math.max(9, Math.min(maximo, Math.floor(ancho / (0.76 * n))));
  }
  var ORD = ['PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO'];
  var ABC = 'ABCDEFGHIJKLMNOPRSTUVXYZ';
  var ALTO = 420;   // alto de la zona de animación

  window.crearSorteo = function (stage, opciones) {
    opciones = opciones || {};
    var caja = document.createElement('div');
    caja.id = 'sorteo';
    caja.style.display = 'none';
    caja.innerHTML = '<div class="s-prueba">PRUEBA · SIMULACRO DE SORTEO</div>' +
      '<div class="s-cab"><img alt="" style="display:none"><div class="s-marca"></div><div class="s-titulo">GRAN SORTEO</div><div class="s-premio"></div></div>' +
      '<div class="s-zona"></div><div class="s-pie"></div>';
    stage.appendChild(caja);
    var zona = caja.querySelector('.s-zona'), pie = caja.querySelector('.s-pie'), premioEl = caja.querySelector('.s-premio');
    var actual = null, clave = '', escena = null;

    function confeti() { if (opciones.confeti) opciones.confeti.lanzar(); }
    function rotulo(k) { return actual.ganadores.length === 1 ? 'Y EL PREMIO ES PARA…' : (ORD[k] || (k + 1) + 'º') + ' PREMIO'; }
    // Nombres de relleno: los de los demás participantes, sin los ganadores (para no destriparlo).
    function relleno() {
      var gan = {}, i, salida = [];
      for (i = 0; i < actual.ganadores.length; i++) gan[actual.ganadores[i].mostrar] = 1;
      for (i = 0; i < actual.nombres.length; i++) if (!gan[actual.nombres[i]]) salida.push(actual.nombres[i]);
      return salida.length ? salida : ['· · ·'];
    }

    // ------------------------------------------------------------ tragaperras
    function montarCarrete(k) {
      var rnd = prng(actual.id * 97 + k * 13 + 7), g = actual.ganadores[k], otros = relleno();
      var LARGO = 94, GANA = 90, FILA = 70, bolsa = [], html = '', i, txt, ultimo = '';
      for (i = 0; i < LARGO; i++) {
        if (i === GANA) txt = g.mostrar;
        else {
          if (!bolsa.length) bolsa = barajar(otros, rnd);
          txt = bolsa.pop();
          if (txt === ultimo && bolsa.length) { bolsa.unshift(txt); txt = bolsa.pop(); }
        }
        ultimo = txt;
        html += '<div class="s-fila" style="font-size:' + tamFuente(txt, 340, 44) + 'px">' + esc(txt) + '</div>';
      }
      zona.innerHTML = '<div class="s-reel"><div class="s-tira">' + html + '</div><div class="s-velo s-velo-a"></div><div class="s-velo s-velo-b"></div><div class="s-marco"></div></div>';
      escena = { tipo: 'carrete', tira: zona.querySelector('.s-tira'), gana: GANA, fila: FILA, centro: (ALTO - FILA) / 2 };
    }
    function animarCarrete(x) {
      // Arranca rápido (12 nombres por segundo) y frena: el último salto dura más de un segundo.
      var pos = escena.gana * (1 - Math.pow(1 - x, 2));
      escena.tira.style.transform = 'translateY(' + (escena.centro - pos * escena.fila).toFixed(1) + 'px)';
    }

    // ------------------------------------------------------------ eliminación
    function montarRejilla(k) {
      var rnd = prng(actual.id * 131 + 5), gan = actual.ganadores, lista = [], i, MAX = 63;
      for (i = 0; i < gan.length; i++) lista.push({ txt: gan[i].mostrar, g: i });
      var br = barajar(relleno(), rnd);
      for (i = 0; i < br.length && lista.length < MAX; i++) lista.push({ txt: br[i], g: -1 });
      lista = barajar(lista, rnd);                       // mismas posiciones en todas las rondas
      var n = lista.length, cols = n > 40 ? 3 : (n > 14 ? 2 : 1), filas = Math.ceil(n / cols);
      var filaH = Math.min(46, Math.floor(ALTO / filas)), colW = Math.floor(384 / cols), largo = 1;
      for (i = 0; i < n; i++) largo = Math.max(largo, lista[i].txt.length);
      var fs = Math.min(Math.floor(filaH * 0.7), tamFuente(new Array(largo + 1).join('X'), colW - 8, 30));
      var top0 = Math.floor((ALTO - filas * filaH) / 2), html = '';
      for (i = 0; i < n; i++) {
        html += '<div class="s-celda' + (lista[i].g >= 0 && lista[i].g < k ? ' premiado' : '') + '" style="left:' + ((i % cols) * colW) + 'px;top:' + (top0 + Math.floor(i / cols) * filaH) +
          'px;width:' + colW + 'px;height:' + filaH + 'px;line-height:' + filaH + 'px;font-size:' + fs + 'px">' + esc(lista[i].txt) + '</div>';
      }
      zona.innerHTML = '<div class="s-rejilla">' + html + '</div>';
      // Esta ronda: se apagan todos menos los ya premiados; el ganador de la ronda queda el último.
      var candidatos = [], ganador = -1;
      for (i = 0; i < n; i++) {
        if (lista[i].g === k) ganador = i;
        else if (!(lista[i].g >= 0 && lista[i].g < k)) candidatos.push(i);
      }
      escena = { tipo: 'rejilla', celdas: zona.querySelectorAll('.s-celda'), orden: barajar(candidatos, prng(actual.id * 131 + 50 + k)), ganador: ganador, hechos: 0, finales: -1 };
    }
    function animarRejilla(x) {
      var total = escena.orden.length, y = Math.min(1, x / 0.93), i;
      var e = Math.min(total, Math.floor(total * (1 - Math.pow(1 - y, 2)) + 1e-9));
      while (escena.hechos < e) { escena.celdas[escena.orden[escena.hechos]].className = 's-celda fuera'; escena.hechos++; }
      var quedan = total - e;
      if (quedan !== escena.finales) {
        escena.finales = quedan;
        if (quedan <= 4) {
          for (i = e; i < total; i++) escena.celdas[escena.orden[i]].className = 's-celda final';
          if (escena.ganador >= 0) escena.celdas[escena.ganador].className = quedan === 0 ? 's-celda gana' : 's-celda final';
        }
      }
    }

    // ------------------------------------------------------------ letra a letra
    function montarLetras(k) {
      var g = actual.ganadores[k], chars = g.mostrar.split(''), n = chars.length, i, m = 0, j = 0;
      var w = Math.min(48, Math.floor(368 / n) - 4), h = Math.floor(w * 1.4), html = '', fijar = [];
      for (i = 0; i < n; i++) if (chars[i] !== ' ') m++;
      for (i = 0; i < n; i++) {
        if (chars[i] === ' ') { html += '<span class="s-letra hueco" style="width:' + Math.floor(w / 2) + 'px"></span>'; fijar.push(-1); }
        else {
          html += '<span class="s-letra" style="width:' + w + 'px;height:' + h + 'px;line-height:' + h + 'px;font-size:' + Math.floor(w * 0.92) + 'px">?</span>';
          j++; fijar.push(0.28 + 0.62 * Math.pow(j / m, 1.5));      // la última letra cae al 90 % del suspense
        }
      }
      zona.innerHTML = '<div class="s-centro"><div class="s-letras">' + html + '</div><div class="s-tel" id="sTel"></div></div>';
      escena = { tipo: 'letras', spans: zona.querySelectorAll('.s-letra'), chars: chars, fijar: fijar, tel: (g.tel || '').replace(/\D/g, ''), telEl: zona.querySelector('#sTel'), ultimo: 0 };
    }
    function animarLetras(x) {
      var ahora = Date.now(), refrescar = ahora - escena.ultimo > 70, i, sp, d, tel = '';
      if (refrescar) escena.ultimo = ahora;
      for (i = 0; i < escena.spans.length; i++) {
        if (escena.fijar[i] < 0) continue;
        sp = escena.spans[i];
        if (x >= escena.fijar[i]) { if (sp.className !== 's-letra fija') { sp.className = 's-letra fija'; sp.textContent = escena.chars[i]; } }
        else if (refrescar) sp.textContent = /[A-ZÁÉÍÓÚÀÈÒÜÏÑÇ]/i.test(escena.chars[i]) ? ABC.charAt(Math.floor(Math.random() * ABC.length)) : escena.chars[i];
      }
      if (refrescar && escena.tel) {
        for (d = 0; d < escena.tel.length; d++) tel += x >= 0.93 + d * 0.02 ? escena.tel.charAt(d) : String(Math.floor(Math.random() * 10));
        escena.telEl.textContent = 'TEL. ···' + tel;
      }
    }

    // ------------------------------------------------------------ escenas
    function montar(fase, k) {
      var g, i, html, n = actual.ganadores.length;
      escena = null;
      if (fase === 'previa') {
        zona.innerHTML = '<div class="s-centro"><div class="s-xl latido">¡ATENCIÓN!</div><div class="s-md">Empieza el sorteo</div></div>';
        pie.innerHTML = '';
      } else if (fase === 'intro') {
        zona.innerHTML = '<div class="s-centro"><div id="sEntre"><div class="s-md">ENTRE</div><div class="s-num">' + actual.participantes + '</div><div class="s-md">PARTICIPANTES</div></div><div class="s-cuenta" id="sCuenta" style="display:none"></div></div>';
        pie.innerHTML = '<span class="latido">¡MUCHA SUERTE!</span>';
        escena = { tipo: 'intro', entre: zona.querySelector('#sEntre'), cuenta: zona.querySelector('#sCuenta'), numero: -1 };
      } else if (fase === 'suspense') {
        pie.innerHTML = '<span class="latido">' + rotulo(k) + '</span>';
        if (actual.estilo === 'eliminacion') montarRejilla(k);
        else if (actual.estilo === 'letras') montarLetras(k);
        else montarCarrete(k);
      } else if (fase === 'premio') {
        g = actual.ganadores[k];
        zona.innerHTML = '<div class="s-centro"><div class="s-lg parpadeo">¡ENHORABUENA!</div><div class="s-nombre" style="font-size:' + tamFuente(g.mostrar, 364, 78) + 'px">' + esc(g.mostrar) + '</div>' +
          (g.tel ? '<div class="s-tel">TEL. ' + esc(g.tel) + '</div>' : '') + '</div>';
        pie.innerHTML = rotulo(k).replace('Y EL PREMIO ES PARA…', '¡PREMIO!');
        confeti();
      } else {   // tablero final
        html = '<div class="s-centro"><div class="s-lg">' + (n === 1 ? 'PREMIO PARA' : 'GANADORES') + '</div>';
        for (i = 0; i < n; i++) {
          g = actual.ganadores[i];
          html += '<div class="s-nombre" style="font-size:' + tamFuente(g.mostrar, 364, n <= 2 ? 60 : 38) + 'px">' + esc(g.mostrar) + '</div>' + (g.tel ? '<div class="s-tel">TEL. ' + esc(g.tel) + '</div>' : '');
        }
        zona.innerHTML = html + '<div class="s-sm">Nos pondremos en contacto con ' + (n === 1 ? 'el ganador' : 'los ganadores') + '</div></div>';
        pie.innerHTML = '¡ENHORABUENA!';
        confeti();
      }
    }

    function pintar(t) {
      var T = actual.tiempos, n = actual.ganadores.length, fase, k = 0, v = t, u, ciclo, resto;
      if (t < 0) fase = 'previa';
      else if (t < T.intro) fase = 'intro';
      else {
        u = t - T.intro; ciclo = T.suspense + T.premio; k = Math.floor(u / ciclo);
        if (k >= n) { fase = 'tablero'; k = 0; }
        else { v = u - k * ciclo; if (v < T.suspense) fase = 'suspense'; else { fase = 'premio'; v -= T.suspense; } }
      }
      if (fase + ':' + k !== clave) { clave = fase + ':' + k; montar(fase, k); }
      if (!escena) return;
      if (escena.tipo === 'intro') {
        resto = Math.ceil((T.intro - v) / 1000);          // 5, 4, 3, 2, 1 en los últimos cinco segundos
        if (resto <= 5 && resto !== escena.numero) {
          escena.numero = resto; escena.entre.style.display = 'none'; escena.cuenta.style.display = 'block';
          escena.cuenta.textContent = resto; escena.cuenta.className = 's-cuenta';
          void escena.cuenta.offsetWidth; escena.cuenta.className = 's-cuenta pop';
        }
      } else if (fase === 'suspense') {
        var x = Math.max(0, Math.min(1, v / T.suspense));
        if (escena.tipo === 'carrete') animarCarrete(x);
        else if (escena.tipo === 'rejilla') animarRejilla(x);
        else if (escena.tipo === 'letras') animarLetras(x);
      }
    }

    function cuadro() {
      if (actual) { try { pintar(Date.now() - actual.t0Local); } catch (e) { /* un fallo de dibujo no debe parar el bucle */ } }
      (window.requestAnimationFrame || function (f) { setTimeout(f, 33); })(cuadro);
    }
    cuadro();

    return {
      // s = estado.sorteo (o null si no hay sorteo en marcha); desfase = reloj servidor − reloj local
      actualizar: function (s, desfase) {
        if (!s) {
          if (actual) { actual = null; clave = ''; escena = null; caja.style.display = 'none'; zona.innerHTML = ''; }
          return;
        }
        var firma = s.id + '|' + s.emitido_en + '|' + s.estilo;
        if (actual && actual.firma === firma) return;       // el mismo: se sigue con el reloj ya fijado
        actual = s; actual.firma = firma;
        actual.t0Local = Date.parse(s.emitido_en) + s.tiempos.inicio - desfase;
        clave = ''; escena = null;
        premioEl.textContent = s.premio || '';
        caja.className = s.prueba ? 'prueba' : '';
        caja.style.display = 'block';
      },
      activo: function () { return !!actual; },
      setMarca: function (logo, nombre) {
        var img = caja.querySelector('.s-cab img'), txt = caja.querySelector('.s-marca');
        if (logo) { if (img.getAttribute('src') !== logo) img.src = logo; img.style.display = ''; txt.textContent = ''; }
        else { img.style.display = 'none'; txt.textContent = nombre || ''; }
      }
    };
  };
})();
