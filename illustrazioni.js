/* =========================================================================
   illustrazioni.js — le figure disegnate accanto a ogni gioco.
   Sono SVG scritti a mano, dentro questo file: nessuna immagine da scaricare,
   nessuna libreria, nessun font. Ogni scena vive in un viewBox 0 0 320 180.

   Uso:  ILL.disegna(elemento, 'staffetta-materassino')
         ILL.svg('briscola')   -> stringa SVG

   Nota sulle regole XSS: qui si inserisce HTML con innerHTML, ma il contenuto
   e' generato solo da questo file (costanti nostre), mai da dati esterni.
   ========================================================================= */
(function () {
  'use strict';

  /* ogni SVG ha bisogno di identificativi propri per i suoi gradienti,
     altrimenti due figure sulla stessa pagina si rubano i colori */
  var seq = 0;
  function uid() { seq += 1; return 'i' + seq; }

  var PELLE = ['#f6cfa8', '#e8b489', '#c98d5f', '#8d5a34', '#f2dcc4'];
  var COSTUMI = ['#ff6b6b', '#ffc233', '#7c4dff', '#22c55e', '#ff8a3d', '#14c4b4'];
  var CAPELLI = ['#3a2a1d', '#1b1b1b', '#7b4a1e', '#c9852b', '#4a3728'];

  function pelle(i) { return PELLE[i % PELLE.length]; }
  function costume(i) { return COSTUMI[i % COSTUMI.length]; }
  function capelli(i) { return CAPELLI[i % CAPELLI.length]; }

  /* --------------------------- pezzi riutilizzabili --------------------------- */

  /* cielo con sole e nuvole: fa da sfondo a tutte le scene */
  function cielo(id, opt) {
    var o = opt || {};
    var sole = o.sole === false ? '' :
      '<circle cx="278" cy="30" r="19" fill="#ffd75e"/>' +
      '<circle cx="278" cy="30" r="26" fill="#ffd75e" opacity=".28"/>';
    var nuvole = o.nuvole === false ? '' :
      '<g fill="#ffffff" opacity=".75">' +
      '<ellipse cx="60" cy="30" rx="24" ry="11"/><ellipse cx="46" cy="33" rx="16" ry="9"/>' +
      '<ellipse cx="78" cy="34" rx="15" ry="8"/>' +
      '<ellipse cx="176" cy="20" rx="18" ry="8"/><ellipse cx="164" cy="23" rx="12" ry="6"/>' +
      '</g>';
    return '<defs><linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#bfe9ff"/><stop offset="1" stop-color="#e8f7ff"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#4bc3e8"/><stop offset="1" stop-color="#0f7fc4"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#' + id + 'c)"/>' + sole + nuvole;
  }

  /* la superficie dell'acqua: onda in alto, azzurro sotto, riflessi bianchi */
  function acqua(id, y) {
    var yy = y === undefined ? 96 : y;
    return '<path d="M0 ' + yy + ' q26 -9 52 0 t52 0 t52 0 t52 0 t52 0 t60 0 V180 H0 Z" fill="url(#' + id + 'a)"/>' +
      '<g stroke="#ffffff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" fill="none">' +
      '<path d="M16 ' + (yy + 22) + ' q12 -6 24 0"/><path d="M228 ' + (yy + 16) + ' q12 -6 24 0"/>' +
      '<path d="M108 ' + (yy + 40) + ' q14 -7 28 0"/><path d="M258 ' + (yy + 46) + ' q14 -7 28 0"/>' +
      '<path d="M44 ' + (yy + 58) + ' q14 -7 28 0"/><path d="M168 ' + (yy + 62) + ' q14 -7 28 0"/>' +
      '</g>';
  }

  /* bordo piscina in fondo alla scena (per i tavoli delle carte) */
  function bordo(y) {
    return '<rect x="0" y="' + y + '" width="320" height="' + (180 - y) + '" fill="#e4d7c3"/>' +
      '<g stroke="#cdbca2" stroke-width="2">' +
      '<path d="M0 ' + (y + 16) + ' H320"/><path d="M70 ' + y + ' V180"/><path d="M210 ' + (y + 16) + ' V180"/>' +
      '</g>';
  }

  /* Testa e spalle che spuntano dall'acqua. dir: 1 guarda a destra, -1 a sinistra */
  function testa(x, y, i, opt) {
    var o = opt || {};
    var dir = o.dir === undefined ? 1 : o.dir;
    var r = o.r || 11;
    var p = pelle(i), cap = capelli(i);
    var occhioX = x + dir * (r * 0.34);
    var bocca = o.bocca === 'o'
      ? '<circle cx="' + (x + dir * r * 0.3) + '" cy="' + (y + r * 0.45) + '" r="2.4" fill="#8d3b3b"/>'
      : '<path d="M' + (x + dir * r * 0.08) + ' ' + (y + r * 0.4) + ' q' + (dir * r * 0.36) + ' ' + (r * 0.3) + ' ' + (dir * r * 0.6) + ' -' + (r * 0.06) + '" stroke="#8d3b3b" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    var cappello = o.corona
      ? '<path d="M' + (x - r * 0.95) + ' ' + (y - r * 0.72) + ' l' + (r * 0.42) + ' -' + (r * 0.85) + ' l' + (r * 0.5) + ' ' + (r * 0.5) +
        ' l' + (r * 0.5) + ' -' + (r * 0.72) + ' l' + (r * 0.5) + ' ' + (r * 0.72) + ' l' + (r * 0.5) + ' -' + (r * 0.5) +
        ' l' + (r * 0.42) + ' ' + (r * 0.85) + ' Z" fill="#ffc233" stroke="#e0a400" stroke-width="1"/>'
      : '';
    return '<g>' +
      '<ellipse cx="' + x + '" cy="' + (y + r * 1.32) + '" rx="' + (r * 1.26) + '" ry="' + (r * 0.72) + '" fill="' + p + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + p + '"/>' +
      '<path d="M' + (x - r) + ' ' + (y - r * 0.18) + ' a' + r + ' ' + r + ' 0 0 1 ' + (r * 2) + ' 0 q-' + r + ' -' + (r * 0.62) + ' -' + (r * 2) + ' 0 Z" fill="' + cap + '"/>' +
      '<circle cx="' + occhioX + '" cy="' + (y - r * 0.06) + '" r="1.9" fill="#2a2a2a"/>' +
      '<circle cx="' + (x - dir * r * 0.16) + '" cy="' + (y - r * 0.06) + '" r="1.9" fill="#2a2a2a"/>' +
      bocca + cappello +
      '</g>';
  }

  /* Figura intera vista di lato, seduta o in ginocchio sopra un materassino.
     posa: 'seduto' | 'ginocchio' | 'inpiedi' | 'pancia' */
  function figura(x, y, i, opt) {
    var o = opt || {};
    var dir = o.dir === undefined ? 1 : o.dir;
    var posa = o.posa || 'seduto';
    var p = pelle(i), cst = o.costume || costume(i), cap = capelli(i);
    var braccia = o.braccia || 'avanti';
    var g = '<g transform="translate(' + x + ',' + y + ') scale(' + dir + ',1)">';

    if (posa === 'pancia') {
      g += '<ellipse cx="0" cy="0" rx="20" ry="7" fill="' + cst + '"/>' +
        '<ellipse cx="-18" cy="1" rx="9" ry="5" fill="' + p + '"/>' +
        '<circle cx="17" cy="-5" r="8.5" fill="' + p + '"/>' +
        '<path d="M9 -9 a8.5 8.5 0 0 1 16 0 q-8 -5 -16 0 Z" fill="' + cap + '"/>' +
        '<circle cx="21" cy="-5.5" r="1.6" fill="#2a2a2a"/>' +
        '<path d="M22 4 q9 3 13 -3" stroke="' + p + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    } else if (posa === 'inpiedi') {
      g += '<path d="M-4 4 L-7 22 M4 4 L8 22" stroke="' + p + '" stroke-width="6" stroke-linecap="round"/>' +
        '<rect x="-8" y="2" width="17" height="10" rx="4" fill="' + cst + '"/>' +
        '<path d="M-2 -14 q9 0 11 16 q-11 4 -19 0 q1 -16 8 -16 Z" fill="' + cst + '"/>' +
        '<circle cx="1" cy="-22" r="9" fill="' + p + '"/>' +
        '<path d="M-8 -24 a9 9 0 0 1 18 0 q-9 -5.5 -18 0 Z" fill="' + cap + '"/>' +
        '<circle cx="5" cy="-22" r="1.7" fill="#2a2a2a"/>' +
        (braccia === 'alto'
          ? '<path d="M-4 -14 q-12 -6 -13 -20 M6 -14 q13 -5 15 -19" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>'
          : '<path d="M-4 -12 q-14 2 -17 -6 M6 -12 q14 2 18 -5" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
    } else if (posa === 'ginocchio') {
      g += '<path d="M-9 6 h18 q4 0 4 4 h-24 q0 -4 2 -4 Z" fill="' + p + '"/>' +
        '<path d="M-3 -10 q10 0 12 16 q-12 4 -21 0 q1 -16 9 -16 Z" fill="' + cst + '"/>' +
        '<circle cx="0" cy="-19" r="9" fill="' + p + '"/>' +
        '<path d="M-9 -21 a9 9 0 0 1 18 0 q-9 -5.5 -18 0 Z" fill="' + cap + '"/>' +
        '<circle cx="4" cy="-19" r="1.7" fill="#2a2a2a"/>' +
        (braccia === 'alto'
          ? '<path d="M-5 -11 q-13 -7 -14 -19 M6 -11 q13 -6 15 -18" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>'
          : '<path d="M-5 -9 q-15 3 -18 -5 M6 -9 q15 3 19 -4" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
    } else { /* seduto */
      g += '<path d="M0 4 q14 0 20 4 q1 4 -3 4 l-20 0 Z" fill="' + p + '"/>' +
        '<path d="M-3 -10 q11 0 12 16 q-13 4 -22 0 q1 -16 10 -16 Z" fill="' + cst + '"/>' +
        '<circle cx="0" cy="-19" r="9" fill="' + p + '"/>' +
        '<path d="M-9 -21 a9 9 0 0 1 18 0 q-9 -5.5 -18 0 Z" fill="' + cap + '"/>' +
        '<circle cx="4" cy="-19" r="1.7" fill="#2a2a2a"/>' +
        '<path d="M2 -20.5 q4 1 5 3.5" stroke="#8d3b3b" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        (braccia === 'alto'
          ? '<path d="M-5 -11 q-13 -7 -13 -19 M6 -11 q13 -6 14 -18" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>'
          : '<path d="M-5 -8 q-14 4 -17 -3 M6 -8 q15 3 18 -4" stroke="' + p + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
    }
    return g + '</g>';
  }

  /* materassino visto di tre quarti: si appoggia sull'acqua */
  function materassino(x, y, w, opt) {
    var o = opt || {};
    var h = o.h || 12;
    var c1 = o.colore || '#ff8a3d', c2 = o.colore2 || '#ffd166';
    var rot = o.rot || 0;
    var s = '<g transform="translate(' + x + ',' + y + ') rotate(' + rot + ')">' +
      '<ellipse cx="0" cy="' + (h * 0.75) + '" rx="' + (w / 2 + 5) + '" ry="' + (h * 0.5) + '" fill="#0a5f96" opacity=".28"/>' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + c1 + '"/>';
    var n = Math.max(3, Math.round(w / 16));
    for (var k = 1; k < n; k++) {
      var xx = -w / 2 + (w / n) * k;
      s += '<rect x="' + (xx - 2.2) + '" y="' + (-h / 2 + 1.6) + '" width="4.4" height="' + (h - 3.2) + '" rx="2.2" fill="' + c2 + '" opacity=".95"/>';
    }
    return s + '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + (h * 0.34) + '" rx="' + (h * 0.17) + '" fill="#ffffff" opacity=".35"/></g>';
  }

  function pallone(x, y, r, colore) {
    var c = colore || '#ffffff';
    return '<g transform="translate(' + x + ',' + y + ')">' +
      '<circle r="' + r + '" fill="' + c + '" stroke="#0a2540" stroke-width="1.4"/>' +
      '<path d="M' + (-r) + ' 0 a' + r + ' ' + (r * 0.45) + ' 0 0 0 ' + (r * 2) + ' 0" stroke="#ff6b6b" stroke-width="1.6" fill="none"/>' +
      '<path d="M' + (-r) + ' 0 a' + r + ' ' + (r * 0.45) + ' 0 0 1 ' + (r * 2) + ' 0" stroke="#0b7fd4" stroke-width="1.6" fill="none"/>' +
      '<path d="M0 ' + (-r) + ' a' + (r * 0.45) + ' ' + r + ' 0 0 0 0 ' + (r * 2) + '" stroke="#0a2540" stroke-width="1.2" fill="none" opacity=".5"/>' +
      '</g>';
  }

  function arco(x1, y1, x2, y2, alto, colore) {
    var mx = (x1 + x2) / 2, my = Math.min(y1, y2) - (alto || 26);
    return '<path d="M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2 + '" ' +
      'stroke="' + (colore || '#ffffff') + '" stroke-width="2.4" fill="none" ' +
      'stroke-dasharray="6 5" stroke-linecap="round" opacity=".85"/>';
  }

  function freccia(x1, y1, x2, y2, colore) {
    var c = colore || '#ffffff';
    var a = Math.atan2(y2 - y1, x2 - x1);
    var p1x = x2 - 9 * Math.cos(a - 0.42), p1y = y2 - 9 * Math.sin(a - 0.42);
    var p2x = x2 - 9 * Math.cos(a + 0.42), p2y = y2 - 9 * Math.sin(a + 0.42);
    return '<g stroke="' + c + '" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9">' +
      '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '"/>' +
      '<path d="M' + p1x + ' ' + p1y + ' L' + x2 + ' ' + y2 + ' L' + p2x + ' ' + p2y + '"/></g>';
  }

  function spruzzo(x, y, s) {
    var k = s || 1;
    return '<g fill="#ffffff" opacity=".85">' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (11 * k) + '" ry="' + (4 * k) + '"/>' +
      '<circle cx="' + (x - 10 * k) + '" cy="' + (y - 7 * k) + '" r="' + (2.6 * k) + '"/>' +
      '<circle cx="' + (x + 9 * k) + '" cy="' + (y - 9 * k) + '" r="' + (2.2 * k) + '"/>' +
      '<circle cx="' + (x + 1 * k) + '" cy="' + (y - 13 * k) + '" r="' + (1.9 * k) + '"/>' +
      '</g>';
  }

  /* carta da gioco italiana/francese, inclinabile */
  function carta(x, y, rot, dentro, larga) {
    var w = larga || 34, h = w * 1.5;
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + rot + ')">' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="4" ' +
      'fill="#fffdf6" stroke="#0a2540" stroke-width="1.6"/>' + (dentro || '') + '</g>';
  }
  function dorso(x, y, rot, larga) {
    var w = larga || 34, h = w * 1.5;
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + rot + ')">' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="4" fill="#0b7fd4" stroke="#0a2540" stroke-width="1.6"/>' +
      '<rect x="' + (-w / 2 + 4) + '" y="' + (-h / 2 + 4) + '" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="3" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>' +
      '<circle cy="0" r="' + (w * 0.16) + '" fill="#ffffff" opacity=".55"/></g>';
  }

  /* ------------------------------- le scene --------------------------------- */
  var SCENE = {};

  SCENE['palla-bollente'] = function (id) {
    var s = cielo(id) + acqua(id, 84);
    s += arco(72, 112, 128, 100, 22, '#ffffff') + arco(128, 100, 190, 112, 22, '#ffffff');
    s += arco(190, 112, 240, 128, 20, '#ffffff');
    s += testa(60, 118, 0, { dir: 1, bocca: 'o' });
    s += testa(112, 106, 1, { dir: 1 });
    s += testa(170, 104, 2, { dir: -1 });
    s += testa(232, 116, 3, { dir: -1, bocca: 'o' });
    s += testa(146, 146, 4, { dir: 1, r: 12 });
    s += pallone(196, 92, 11);
    s += '<g fill="#ff6b6b"><path d="M188 74 q4 -9 0 -14 q9 5 8 14 Z"/><path d="M200 72 q5 -8 2 -13 q8 6 6 13 Z"/></g>';
    return s;
  };

  SCENE['staffetta-materassino'] = function (id) {
    var s = cielo(id) + acqua(id, 92);
    s += '<g opacity=".55">' + freccia(40, 84, 250, 84, '#0a2540') + '</g>';
    s += materassino(120, 122, 96, { colore: '#ff8a3d', colore2: '#ffd166' });
    s += figura(122, 116, 1, { posa: 'pancia', dir: 1 });
    s += spruzzo(70, 128, .9);
    s += '<g transform="translate(272,74)"><rect x="-2" y="0" width="4" height="58" rx="2" fill="#0a2540"/>' +
      '<path d="M2 2 L34 12 L2 22 Z" fill="#ff6b6b"/></g>';
    s += testa(232, 128, 3, { dir: -1, r: 10 });
    return s;
  };

  SCENE['staffetta-pallone'] = function (id) {
    var s = cielo(id) + acqua(id, 94);
    s += arco(52, 118, 250, 112, 34, '#ffffff');
    s += testa(96, 122, 0, { dir: 1, bocca: 'o', r: 13 });
    s += pallone(126, 110, 13);
    s += '<path d="M112 116 q6 -8 12 -6" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += testa(196, 132, 2, { dir: 1, r: 11 });
    s += pallone(224, 118, 11);
    s += testa(258, 108, 3, { dir: 1, r: 10 });
    s += '<g stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M58 128 h16"/><path d="M50 138 h22"/></g>';
    return s;
  };

  SCENE['trasporto-compagno'] = function (id) {
    var s = cielo(id) + acqua(id, 92);
    s += materassino(178, 124, 104, { colore: '#22c55e', colore2: '#bbf7d0' });
    s += figura(184, 118, 2, { posa: 'seduto', dir: 1, braccia: 'alto' });
    s += testa(104, 128, 0, { dir: 1, bocca: 'o' });
    s += testa(126, 142, 3, { dir: 1 });
    s += '<path d="M114 126 q10 -4 18 -4 M136 140 q8 -6 16 -8" stroke="' + pelle(0) + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    s += freccia(88, 96, 152, 96, '#0a2540');
    s += spruzzo(92, 140, .8);
    return s;
  };

  SCENE['traghetto'] = function (id) {
    var s = cielo(id) + acqua(id, 90);
    s += materassino(150, 124, 118, { colore: '#7c4dff', colore2: '#d6c8ff', h: 13 });
    s += figura(122, 116, 1, { posa: 'ginocchio', dir: 1 });
    s += figura(176, 116, 4, { posa: 'seduto', dir: 1 });
    s += testa(76, 132, 0, { dir: 1, bocca: 'o' });
    s += testa(232, 136, 3, { dir: -1 });
    s += '<path d="M86 130 q10 -6 18 -6 M222 134 q-10 -6 -18 -8" stroke="' + pelle(0) + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    s += freccia(44, 92, 108, 92, '#0a2540');
    s += '<g transform="translate(288,72)"><rect x="-2" y="0" width="4" height="60" rx="2" fill="#0a2540"/>' +
      '<path d="M-2 2 L-32 12 L-2 22 Z" fill="#14c4b4"/></g>';
    return s;
  };

  SCENE['palla-capitano'] = function (id) {
    var s = cielo(id) + acqua(id, 88);
    s += materassino(238, 122, 76, { colore: '#ffc233', colore2: '#fff0b8' });
    s += figura(238, 114, 2, { posa: 'ginocchio', dir: -1, braccia: 'alto' });
    s += '<g transform="translate(238,90)"><path d="M-11 2 l4 -9 l5 5 l5 -8 l5 8 l5 -5 l4 9 Z" fill="#ffc233" stroke="#e0a400" stroke-width="1.2"/></g>';
    s += arco(96, 120, 216, 96, 40, '#ffffff');
    s += pallone(160, 84, 12);
    s += testa(78, 126, 0, { dir: 1, bocca: 'o' });
    s += testa(128, 142, 3, { dir: 1 });
    s += '<path d="M88 122 q9 -8 16 -8" stroke="' + pelle(0) + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    return s;
  };

  SCENE['catena'] = function (id) {
    var s = cielo(id) + acqua(id, 96);
    var xs = [72, 118, 164, 210, 256];
    for (var k = 0; k < xs.length - 1; k++) {
      s += '<path d="M' + (xs[k] + 12) + ' 128 q11 -8 22 0" stroke="' + pelle(k) + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    }
    for (var j = xs.length - 1; j >= 0; j--) {
      s += testa(xs[j], 126, j, { dir: -1, bocca: j === 0 ? 'o' : '' });
    }
    s += pallone(48, 116, 12);
    s += '<path d="M60 124 q-6 -6 -10 -6" stroke="' + pelle(0) + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    s += freccia(240, 82, 150, 82, '#0a2540');
    return s;
  };

  SCENE['pallanuoto'] = function (id) {
    var s = cielo(id) + acqua(id, 86);
    s += '<g transform="translate(272,58)" fill="none" stroke="#ffffff" stroke-width="4">' +
      '<rect x="-34" y="0" width="68" height="46" rx="3"/></g>' +
      '<g stroke="#ffffff" stroke-width="1.1" opacity=".65">' +
      '<path d="M244 62 H306 M244 72 H306 M244 82 H306 M244 92 H306"/>' +
      '<path d="M252 58 V104 M264 58 V104 M276 58 V104 M288 58 V104 M300 58 V104"/></g>';
    s += arco(112, 100, 258, 78, 44, '#ffd75e');
    s += pallone(184, 66, 12, '#ffe9a8');
    s += testa(96, 116, 0, { dir: 1, bocca: 'o', r: 13 });
    s += '<path d="M108 108 q12 -14 18 -12" stroke="' + pelle(0) + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    s += testa(160, 134, 3, { dir: 1 });
    s += testa(214, 124, 1, { dir: -1 });
    s += spruzzo(120, 130, .8);
    return s;
  };

  SCENE['passaggi-materassino'] = function (id) {
    var s = cielo(id) + acqua(id, 88);
    s += materassino(158, 120, 88, { colore: '#14c4b4', colore2: '#c8fff7' });
    s += figura(158, 112, 4, { posa: 'ginocchio', dir: 1, braccia: 'alto' });
    s += arco(74, 124, 146, 92, 30, '#ffffff');
    s += arco(178, 92, 250, 122, 30, '#ffffff');
    s += pallone(104, 96, 11);
    s += testa(62, 132, 0, { dir: 1 });
    s += testa(258, 130, 2, { dir: -1 });
    s += testa(160, 158, 3, { dir: 1, r: 10 });
    return s;
  };

  SCENE['re-materassino'] = function (id) {
    var s = cielo(id) + acqua(id, 100);
    s += '<g stroke="#0a2540" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".45">' +
      '<path d="M92 74 q-9 -7 -5 -16"/><path d="M228 74 q9 -7 5 -16"/></g>';
    s += materassino(160, 128, 96, { colore: '#ff6b6b', colore2: '#ffd6d6', rot: -5 });
    s += figura(158, 118, 1, { posa: 'inpiedi', dir: 1, braccia: 'alto' });
    s += '<g transform="translate(159,84)"><path d="M-11 2 l4 -9 l5 5 l5 -8 l5 8 l5 -5 l4 9 Z" fill="#ffc233" stroke="#e0a400" stroke-width="1.2"/></g>';
    s += spruzzo(96, 138, .8) + spruzzo(226, 142, .7);
    return s;
  };

  SCENE['nuoto-pallone'] = function (id) {
    var s = cielo(id) + acqua(id, 92);
    s += '<path d="M40 132 H286" stroke="#ffffff" stroke-width="2.4" stroke-dasharray="7 6" opacity=".7"/>';
    s += testa(132, 124, 0, { dir: 1, bocca: 'o', r: 14 });
    s += pallone(170, 116, 14);
    s += '<g stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" opacity=".85">' +
      '<path d="M96 128 h18"/><path d="M84 140 h26"/><path d="M104 116 h12"/></g>';
    s += spruzzo(112, 138, .9);
    s += '<g transform="translate(252,66)"><rect x="-2" y="0" width="4" height="62" rx="2" fill="#0a2540"/>' +
      '<path d="M2 2 L32 12 L2 22 Z" fill="#ffc233"/></g>';
    return s;
  };

  SCENE['cavalca-materassino'] = function (id) {
    var s = cielo(id) + acqua(id, 90);
    s += materassino(146, 126, 100, { colore: '#0b7fd4', colore2: '#bfe4ff', rot: -7 });
    s += figura(146, 116, 3, { posa: 'seduto', dir: 1 });
    s += spruzzo(84, 134, 1.1);
    s += freccia(66, 90, 138, 86, '#0a2540');
    s += testa(250, 134, 1, { dir: -1, r: 10 });
    s += '<g stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M74 148 h20"/><path d="M96 156 h16"/></g>';
    return s;
  };

  SCENE['king-of-the-mat'] = function (id) {
    var s = cielo(id) + acqua(id, 96);
    s += materassino(160, 134, 132, { colore: '#ffc233', colore2: '#fff3c4', h: 14 });
    s += figura(122, 124, 0, { posa: 'ginocchio', dir: 1 });
    s += figura(198, 124, 2, { posa: 'ginocchio', dir: -1 });
    s += '<g transform="translate(160,104)" fill="#ff6b6b">' +
      '<path d="M0 -12 l5 9 l10 -3 l-6 9 l9 6 l-11 2 l2 10 l-9 -7 l-9 7 l2 -10 l-11 -2 l9 -6 l-6 -9 l10 3 Z"/></g>';
    s += '<text x="160" y="110" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="11" font-weight="bold" fill="#ffffff">1vs1</text>';
    s += spruzzo(72, 146, .8) + spruzzo(248, 150, .7);
    return s;
  };

  SCENE['super-staffetta'] = function (id) {
    var s = cielo(id) + acqua(id, 92);
    s += '<g opacity=".5">' + arco(30, 116, 130, 116, 26, '#ffffff') + arco(130, 116, 236, 116, 26, '#ffffff') + '</g>';
    s += materassino(126, 128, 76, { colore: '#7c4dff', colore2: '#dcd0ff' });
    s += figura(126, 120, 1, { posa: 'pancia', dir: 1 });
    s += testa(58, 130, 0, { dir: 1, bocca: 'o' });
    s += pallone(84, 120, 11);
    s += testa(208, 130, 3, { dir: 1 });
    s += pallone(232, 122, 10);
    /* traguardo a scacchi */
    s += '<g transform="translate(268,62)"><rect x="-2" y="0" width="4" height="74" rx="2" fill="#0a2540"/>';
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        s += '<rect x="' + (2 + c * 9) + '" y="' + (2 + r * 9) + '" width="9" height="9" fill="' + ((r + c) % 2 ? '#0a2540' : '#ffffff') + '"/>';
      }
    }
    s += '</g>';
    s += '<g transform="translate(46,42)"><circle r="17" fill="#ffc233" stroke="#e0a400" stroke-width="2"/>' +
      '<text y="6" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="17" font-weight="bold" fill="#7a5300">x2</text></g>';
    return s;
  };

  /* ------------------------------ tornei di carte ---------------------------- */

  function tavoloCarte(id, opt) {
    var o = opt || {};
    var s = '<defs><linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#bfe9ff"/><stop offset="1" stop-color="#e8f7ff"/></linearGradient>' +
      '<linearGradient id="' + id + 't" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + (o.panno || '#1f8a5b') + '"/><stop offset="1" stop-color="' + (o.panno2 || '#136b46') + '"/></linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#' + id + 'c)"/>';
    /* ombrellone a sinistra */
    s += '<g transform="translate(36,0)">' +
      '<path d="M-30 44 q30 -40 60 0 Z" fill="#ff6b6b"/>' +
      '<path d="M-10 44 q10 -32 20 0 Z" fill="#ffffff" opacity=".5"/>' +
      '<rect x="-2" y="42" width="4" height="66" rx="2" fill="#c9a227"/></g>';
    s += bordo(104);
    /* tavolo */
    s += '<ellipse cx="176" cy="128" rx="112" ry="42" fill="url(#' + id + 't)" stroke="#0d4f34" stroke-width="3"/>' +
      '<ellipse cx="176" cy="124" rx="112" ry="42" fill="url(#' + id + 't)"/>' +
      '<ellipse cx="176" cy="124" rx="96" ry="33" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="2"/>';
    return s;
  }

  /* semi delle carte italiane, disegnati semplici */
  function denaro(x, y, r) {
    return '<g transform="translate(' + x + ',' + y + ')"><circle r="' + r + '" fill="#ffc233" stroke="#c9932b" stroke-width="1.4"/>' +
      '<circle r="' + (r * 0.55) + '" fill="none" stroke="#c9932b" stroke-width="1.2"/></g>';
  }
  function coppa(x, y, k) {
    var s = k || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" fill="#e05a2b">' +
      '<path d="M-7 -8 h14 q0 10 -7 12 q-7 -2 -7 -12 Z"/><rect x="-1.6" y="3" width="3.2" height="5"/>' +
      '<rect x="-5" y="8" width="10" height="2.6" rx="1.3"/></g>';
  }
  function spada(x, y, k) {
    var s = k || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" fill="#3b7dd8">' +
      '<path d="M-1.4 -11 h2.8 v16 h-2.8 Z"/><rect x="-6" y="4" width="12" height="2.4" rx="1.2"/>' +
      '<circle cy="9" r="2.4"/></g>';
  }
  function bastone(x, y, k) {
    var s = k || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" fill="#2f9e5b">' +
      '<rect x="-1.5" y="-11" width="3" height="22" rx="1.5"/>' +
      '<path d="M-6 -4 l5 3 M6 -4 l-5 3 M-6 5 l5 -3 M6 5 l-5 -3" stroke="#2f9e5b" stroke-width="2" stroke-linecap="round"/></g>';
  }

  SCENE['briscola'] = function (id) {
    var s = tavoloCarte(id, { panno: '#1f8a5b' });
    /* ventaglio di carte in mano */
    s += carta(112, 116, -20, denaro(0, -8, 7) + denaro(0, 8, 7), 36);
    s += carta(146, 110, -7, spada(0, -8, .95) + spada(0, 8, .95), 36);
    s += carta(180, 110, 7, bastone(0, -8, .9) + bastone(0, 8, .9), 36);
    s += carta(214, 116, 20, coppa(0, -8, 1) + coppa(0, 8, 1), 36);
    /* carta di briscola girata sotto il mazzo */
    s += dorso(268, 128, 8, 30);
    s += carta(252, 132, -74, denaro(0, 0, 8), 30);
    s += '<text x="176" y="66" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="19" font-weight="bold" fill="#0a2540">Briscola</text>';
    s += '<g transform="translate(176,84)"><rect x="-46" y="-11" width="92" height="22" rx="11" fill="#ffc233"/>' +
      '<text y="5" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="12" font-weight="bold" fill="#7a5300">a coppie · in 4</text></g>';
    return s;
  };

  SCENE['scopone'] = function (id) {
    var s = tavoloCarte(id, { panno: '#146b8a', panno2: '#0d4f68' });
    /* quattro carte scoperte sul tavolo */
    s += carta(112, 126, -12, denaro(0, -9, 6) + denaro(-8, 4, 6) + denaro(8, 4, 6), 32);
    s += carta(154, 122, -4, spada(0, 0, 1.15), 32);
    s += carta(196, 122, 5, bastone(0, -8, .8) + bastone(0, 8, .8), 32);
    /* il settebello in evidenza */
    s += '<g transform="translate(244,120) rotate(10)">' +
      '<rect x="-19" y="-28" width="38" height="56" rx="5" fill="#fffdf6" stroke="#0a2540" stroke-width="2"/>' +
      denaro(-8, -14, 5) + denaro(8, -14, 5) + denaro(-8, 0, 5) + denaro(8, 0, 5) +
      denaro(-8, 14, 5) + denaro(8, 14, 5) + denaro(0, 0, 5) +
      '</g>';
    s += '<g transform="translate(244,80)"><rect x="-38" y="-11" width="76" height="22" rx="11" fill="#ffc233"/>' +
      '<text y="5" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="12" font-weight="bold" fill="#7a5300">settebello</text></g>';
    s += '<text x="150" y="62" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="19" font-weight="bold" fill="#0a2540">Scopone</text>';
    return s;
  };

  SCENE['tresette'] = function (id) {
    var s = tavoloCarte(id, { panno: '#7a2f5e', panno2: '#5c2247' });
    s += carta(120, 124, -14, coppa(0, -10, 1) + coppa(0, 2, 1) + coppa(0, 14, 1), 36);
    s += '<g transform="translate(170,120) rotate(-2)">' +
      '<rect x="-21" y="-31" width="42" height="62" rx="5" fill="#fffdf6" stroke="#0a2540" stroke-width="2.2"/>' +
      '<text y="12" text-anchor="middle" font-family="Trebuchet MS,serif" font-size="42" font-weight="bold" fill="#c1121f">3</text></g>';
    s += carta(222, 124, 13, spada(0, -10, .9) + spada(0, 2, .9) + spada(0, 14, .9), 36);
    s += dorso(272, 130, 16, 28);
    /* le tre parole ammesse */
    s += '<g font-family="Trebuchet MS,sans-serif" font-size="11" font-weight="bold">' +
      '<g transform="translate(92,70)"><rect x="-25" y="-11" width="50" height="22" rx="11" fill="#ffffff" opacity=".9"/><text y="4" text-anchor="middle" fill="#0a2540">busso</text></g>' +
      '<g transform="translate(160,58)"><rect x="-27" y="-11" width="54" height="22" rx="11" fill="#ffffff" opacity=".9"/><text y="4" text-anchor="middle" fill="#0a2540">striscio</text></g>' +
      '<g transform="translate(228,70)"><rect x="-22" y="-11" width="44" height="22" rx="11" fill="#ffffff" opacity=".9"/><text y="4" text-anchor="middle" fill="#0a2540">volo</text></g></g>';
    return s;
  };

  SCENE['burraco'] = function (id) {
    var s = tavoloCarte(id, { panno: '#1c6fa8', panno2: '#12527d' });
    /* scala di cuori */
    var scala = '';
    for (var k = 0; k < 4; k++) {
      scala += '<g transform="translate(' + (98 + k * 17) + ',126) rotate(' + (-9 + k * 5) + ')">' +
        '<rect x="-15" y="-24" width="30" height="48" rx="4" fill="#fffdf6" stroke="#0a2540" stroke-width="1.6"/>' +
        '<path d="M0 6 q-9 -7 -9 -13 a5 5 0 0 1 9 -3 a5 5 0 0 1 9 3 q0 6 -9 13 Z" fill="#c1121f"/>' +
        '<text x="-10" y="-14" font-family="Trebuchet MS,sans-serif" font-size="9" font-weight="bold" fill="#c1121f">' + (7 + k) + '</text></g>';
    }
    s += scala;
    /* la jolly */
    s += '<g transform="translate(212,120) rotate(9)">' +
      '<rect x="-19" y="-28" width="38" height="56" rx="5" fill="#fffdf6" stroke="#0a2540" stroke-width="2"/>' +
      '<g transform="translate(0,2)">' +
      '<path d="M-11 -6 q-3 -9 4 -11 q-1 -5 4 -5 q5 0 4 5 q7 2 4 11 Z" fill="#7c4dff"/>' +
      '<circle cx="-11" cy="-6" r="2.6" fill="#ffc233"/><circle cx="11" cy="-6" r="2.6" fill="#ffc233"/>' +
      '<circle cy="-17" r="2.2" fill="#ffc233"/>' +
      '<circle cy="2" r="7" fill="#f6cfa8"/><circle cx="-2.6" cy="1" r="1.4" fill="#2a2a2a"/><circle cx="2.6" cy="1" r="1.4" fill="#2a2a2a"/>' +
      '<path d="M-3 4.5 q3 3 6 0" stroke="#8d3b3b" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g>';
    /* il pozzetto */
    s += dorso(272, 124, -6, 30) + dorso(268, 130, 6, 30);
    s += '<text x="160" y="60" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="19" font-weight="bold" fill="#0a2540">Burraco</text>';
    s += '<g transform="translate(160,80)"><rect x="-56" y="-11" width="112" height="22" rx="11" fill="#ffc233"/>' +
      '<text y="5" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="12" font-weight="bold" fill="#7a5300">pozzetto e burraco</text></g>';
    return s;
  };

  /* figura di riserva, se un gioco non ha ancora la sua */
  SCENE['generica'] = function (id) {
    var s = cielo(id) + acqua(id, 94);
    s += materassino(150, 124, 90, { colore: '#14c4b4', colore2: '#d5fff9' });
    s += figura(150, 116, 2, { posa: 'seduto', dir: 1, braccia: 'alto' });
    s += pallone(238, 116, 13);
    s += testa(70, 130, 0, { dir: 1, bocca: 'o' });
    return s;
  };

  /* --------------------------------- API ------------------------------------ */
  function svg(chiave, alt) {
    var f = SCENE[chiave] || SCENE['generica'];
    var id = uid();
    return '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="' + String(alt || 'Illustrazione del gioco').replace(/[<>&"]/g, '') + '" ' +
      'preserveAspectRatio="xMidYMid slice">' + f(id) + '</svg>';
  }

  function disegna(el, chiave, alt) {
    if (!el) return;
    el.innerHTML = svg(chiave, alt);   /* contenuto generato solo qui dentro */
  }

  function elenco() { return Object.keys(SCENE); }

  window.ILL = { svg: svg, disegna: disegna, elenco: elenco };
})();
