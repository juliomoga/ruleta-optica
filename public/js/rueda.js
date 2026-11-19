// Rueda de la ruleta: dibujo en canvas + animación (giro con frenada, parpadeo del ganador).
// La usan la pantalla LED y el iPad con el MISMO código, así giran igual y paran en el mismo gajo.
//
// Script clásico (sin módulos ni sintaxis moderna) a propósito: el navegador del player de la
// LED puede ser antiguo. Uso:
//   var r = crearRueda(contenedor, { tamano: 376, logo: '/api/logo?tipo=redondo' });   // logo opcional
//   r.setLogo(url);                               // cambia el logo del centro (null = sin logo)
//   r.setPremios([{ id, etiqueta, color }, ...]);   // en orden de la rueda
//   r.girarA(indice, { duracion: 7000, alTerminar: function () {} });
//   r.reposo();                                   // vuelve a girar despacio
//   r.onTick = function (progreso) {}             // cada vez que pasa un gajo por el puntero
(function () {
  function luminancia(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 0;
    return (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255;
  }
  // Perfil del giro: velocidad constante durante el primer 45 % del tiempo y después una frenada
  // larga (curva de grado 4), sin salto de velocidad en la unión. Así un giro de 25 s se ve rápido
  // casi la mitad del tiempo y luego va parando poco a poco, en vez de arrastrarse desde el principio.
  var P = 0.45, N = 4, K = N / ((1 - P) + N * P);
  function perfil(t) {
    if (t <= P) return K * t;
    var u = (t - P) / (1 - P);
    return K * P + (1 - K * P) * (1 - Math.pow(1 - u, N));
  }

  // Temas de color. 'feria' usa el color de cada premio (editable en el panel); los demás
  // imponen una paleta que se repite gajo a gajo con el color de la óptica. Se eligen en el panel
  // (Ajustes → Aspecto) o con ?tema=… en la URL.
  function temas(color) {
    return {
      feria: null,
      marca: { paleta: ['#111111', '#ffffff', color], borde: '#ffffff', bombillas: ['#ffffff', color] },
      oro:   { paleta: ['#111111', '#e6b422', color], borde: '#e6b422', bombillas: ['#e6b422', '#ffffff'] },
    };
  }
  window.aplicarTemaRueda = function (rueda, nombre, premios, color) {
    var t = temas(color || '#d01e24')[nombre];
    if (!t) { rueda.setEstilo({ borde: '#ffffff', bombillas: ['#ffd23f', '#d01e24'] }); return premios; }
    rueda.setEstilo(t);
    var n = premios.length, len = t.paleta.length, salida = [];
    for (var i = 0; i < n; i++) {
      var q = {}; for (var k in premios[i]) q[k] = premios[i][k];
      var idx = i % len;
      if (i === n - 1 && idx === 0 && n > 1) idx = 1;   // que el último y el primero no coincidan
      q.color = t.paleta[idx];
      salida.push(q);
    }
    return salida;
  };

  window.crearRueda = function (contenedor, opciones) {
    var T = opciones.tamano;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var R = T / 2;
    var rExt = R - T * 0.03;   // radio de los gajos (deja sitio al aro con bombillas)
    var rCentro = T * 0.125;
    var premios = [];
    var angulo = 0;            // grados, sentido horario
    var modo = 'reposo';       // reposo | giro | premio
    var giro = null;
    var ganador = -1, flashOn = false, ultimoTick = -1, ultimoFlash = -1;
    var estilo = { borde: '#ffffff', bombillas: ['#ffd23f', '#d01e24'] };
    var api = { onTick: null };

    contenedor.style.position = 'relative';
    contenedor.style.width = T + 'px';
    contenedor.style.height = T + 'px';

    function canvas(z) {
      var c = document.createElement('canvas');
      c.width = T * dpr; c.height = T * dpr;
      c.style.cssText = 'position:absolute;left:0;top:0;width:' + T + 'px;height:' + T + 'px;z-index:' + z;
      contenedor.appendChild(c);
      var ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      return { el: c, ctx: ctx };
    }
    var rueda = canvas(1);   // gira (transform CSS)
    var marco = canvas(2);   // fijo: aro, bombillas, centro
    rueda.el.style.willChange = 'transform';

    var logoImg = null, logoUrl = null;
    function setLogo(url) {
      if (url === logoUrl) return;
      logoUrl = url || null;
      if (!logoUrl) { logoImg = null; dibujarMarco(); return; }
      logoImg = new Image();
      logoImg.onload = dibujarMarco;
      logoImg.src = logoUrl;
    }

    function dibujarRueda() {
      var ctx = rueda.ctx, n = premios.length;
      ctx.clearRect(0, 0, T, T);
      if (!n) return;
      var seg = 2 * Math.PI / n;
      for (var i = 0; i < n; i++) {
        var a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
        var color = premios[i].color || '#d01e24';
        var resaltado = (i === ganador && flashOn);
        ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, rExt, a0, a1); ctx.closePath();
        ctx.fillStyle = resaltado ? '#ffffff' : color;
        ctx.fill();
        ctx.lineWidth = Math.max(2, T * 0.008); ctx.strokeStyle = '#000'; ctx.stroke();

        var lineas = String(premios[i].etiqueta || '').split('|');
        var fs = Math.round(T * 0.055 * (lineas.length > 1 ? 0.88 : 1));
        if (n > 12) fs = Math.round(fs * 12 / n);
        ctx.save();
        ctx.translate(R, R); ctx.rotate(a0 + seg / 2);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = '900 ' + fs + 'px Montserrat, "Arial Black", Arial, sans-serif';
        ctx.fillStyle = (resaltado || luminancia(color) > 0.62) ? '#000' : '#fff';
        var lh = fs * 1.02, y0 = -(lineas.length - 1) * lh / 2;
        for (var k = 0; k < lineas.length; k++) ctx.fillText(lineas[k].trim(), rExt - T * 0.04, y0 + k * lh);
        ctx.restore();
      }
    }

    function dibujarMarco() {
      var ctx = marco.ctx;
      ctx.clearRect(0, 0, T, T);
      ctx.beginPath(); ctx.arc(R, R, rExt, 0, 2 * Math.PI);
      ctx.lineWidth = T * 0.022; ctx.strokeStyle = estilo.borde; ctx.stroke();
      var nb = 24;
      for (var k = 0; k < nb; k++) {
        var a = k * 2 * Math.PI / nb;
        ctx.beginPath(); ctx.arc(R + Math.cos(a) * rExt, R + Math.sin(a) * rExt, T * 0.013, 0, 2 * Math.PI);
        ctx.fillStyle = estilo.bombillas[(k + (flashOn ? 1 : 0)) % 2];
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(R, R, rCentro, 0, 2 * Math.PI);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.lineWidth = T * 0.012; ctx.strokeStyle = estilo.borde; ctx.stroke();
      if (logoImg && logoImg.complete && logoImg.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.arc(R, R, rCentro - T * 0.005, 0, 2 * Math.PI); ctx.clip();
        ctx.drawImage(logoImg, R - rCentro, R - rCentro, rCentro * 2, rCentro * 2);
        ctx.restore();
      }
    }

    var ultimoFrame = performance.now();
    function frame(ahora) {
      var dt = Math.min(100, ahora - ultimoFrame); ultimoFrame = ahora;
      if (modo === 'reposo') {
        angulo += 7 * dt / 1000;                       // una vuelta cada ~50 s
      } else if (modo === 'giro' && giro) {
        var t = (ahora - giro.t0) / giro.d;
        if (t >= 1) {
          angulo = giro.a1; modo = 'premio'; ganador = giro.idx; flashOn = true; ultimoFlash = -1;
          dibujarRueda(); dibujarMarco();
          if (giro.alTerminar) giro.alTerminar(giro.idx);
        } else {
          angulo = giro.a0 + (giro.a1 - giro.a0) * perfil(t);
          var seg = 360 / premios.length;
          var idxTick = Math.floor(angulo / seg);
          if (idxTick !== ultimoTick) { ultimoTick = idxTick; if (api.onTick) api.onTick(t); }
        }
      } else if (modo === 'premio') {
        var f = Math.floor(ahora / 260) % 2;
        if (f !== ultimoFlash) { ultimoFlash = f; flashOn = (f === 0); dibujarRueda(); dibujarMarco(); }
      }
      rueda.el.style.transform = 'rotate(' + angulo + 'deg)';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setLogo(opciones.logo);

    api.setLogo = setLogo;
    api.setPremios = function (lista) {
      premios = lista || [];
      dibujarRueda(); dibujarMarco();
    };
    api.indicePremio = function (id) {
      for (var i = 0; i < premios.length; i++) if (premios[i].id === id) return i;
      return -1;
    };
    api.girarA = function (idx, o) {
      o = o || {};
      var n = premios.length; if (!n) return;
      if (idx < 0 || idx >= n) idx = Math.floor(Math.random() * n);
      var seg = 360 / n;
      var centro = idx * seg + seg / 2;
      var jitter = (Math.random() * 2 - 1) * seg * 0.36;   // no para justo en el borde
      var objetivo = -(centro + jitter);
      var a0 = angulo % 360;
      var delta = ((objetivo - a0) % 360 + 360) % 360;
      angulo = a0; ganador = -1; flashOn = false; dibujarRueda(); dibujarMarco();
      var d = o.duracion || 7000;
      var vueltas = o.vueltas || Math.max(3, Math.round(d / 1000 * 0.7));   // 7 s → 5 vueltas, 25 s → 17
      giro = { t0: performance.now(), d: d, a0: a0, a1: a0 + vueltas * 360 + delta, idx: idx, alTerminar: o.alTerminar };
      ultimoTick = Math.floor(a0 / seg);
      modo = 'giro';
    };
    api.reposo = function () {
      modo = 'reposo'; ganador = -1; flashOn = false; giro = null;
      angulo = angulo % 360;
      dibujarRueda(); dibujarMarco();
    };
    api.modo = function () { return modo; };
    api.setEstilo = function (e) {
      if (e.borde) estilo.borde = e.borde;
      if (e.bombillas) estilo.bombillas = e.bombillas;
      dibujarMarco();
    };
    return api;
  };
})();
