/* =========================================================================
   comune.js — le cose che servono a tutte le pagine pubbliche:
   caricamento di contenuti.json, colori del tema, data e ora in italiano,
   conto alla rovescia, contatori degli iscritti aggiornati da soli, piede
   di pagina, avvisi.  Nessuna dipendenza esterna.
   ========================================================================= */
(function () {
  'use strict';

  var DATI = null;
  var ascoltiAvviati = false;
  var rinfreschi = [];       /* funzioni da richiamare a ogni aggiornamento */

  /* ------------------------------ utilità ------------------------------- */
  function $(id) { return document.getElementById(id); }
  function V(v, def) { return (v === undefined || v === null || v === '') ? def : v; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function testo(id, s) {
    var el = (typeof id === 'string') ? $(id) : id;
    if (el) el.textContent = (s == null ? '' : String(s));
    return el;
  }
  function crea(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = String(txt);
    return e;
  }

  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  function dataIt(iso, conAnno) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length !== 3) return String(iso);
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return String(iso);
    var s = GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
    return conAnno ? (s + ' ' + d.getFullYear()) : s;
  }
  function dataBreve(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length !== 3) return String(iso);
    return Number(p[2]) + ' ' + MESI[Number(p[1]) - 1];
  }
  function eur(n) {
    var v = Number(n) || 0;
    var s = (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
    return s.replace(/,00$/, '') + ' €';
  }

  /* ------------------------- caricamento contenuti ----------------------- */
  function carica() {
    return fetch('contenuti.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('contenuti.json non trovato');
        return r.json();
      })
      .then(function (d) {
        DATI = d || {};
        applicaColori(DATI);
        avviaCloud(DATI);
        return DATI;
      });
  }
  function dati() { return DATI || {}; }

  function colore(v, def) {
    var s = String(v == null ? '' : v).trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : def;
  }
  function applicaColori(d) {
    var t = V(d.tema, {});
    var r = document.documentElement.style;
    var c1 = colore(t.colorePrimario, '#0b7fd4');
    var c2 = colore(t.coloreSecondario, '#14c4b4');
    var c3 = colore(t.coloreAccento, '#ffc233');
    r.setProperty('--c1', c1);
    r.setProperty('--c2', c2);
    r.setProperty('--c3', c3);
    var aree = V(d.aree, {});
    r.setProperty('--area-ragazzi', colore((aree.ragazzi || {}).colore, c2));
    r.setProperty('--area-adulti', colore((aree.adulti || {}).colore, c1));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c1);
  }

  function avviaCloud(d) {
    var c = V(d.cloud, {});
    if (window.FB && c.firebaseApiKey && c.firebaseProjectId) {
      FB.cfg(c.firebaseApiKey, c.firebaseProjectId);
    }
  }

  /* ------------------------- conto alla rovescia ------------------------- */
  function avviaConto(idContenitore, iso, ora) {
    var box = $(idContenitore);
    if (!box || !iso) return;
    var p = String(iso).split('-');
    var oo = String(ora || '00:00').split(':');
    var quando = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]),
      Number(oo[0]) || 0, Number(oo[1]) || 0, 0);
    if (isNaN(quando.getTime())) return;

    function cella(n, u) {
      return '<div class="cella"><span class="n">' + n + '</span><span class="u">' + u + '</span></div>';
    }
    function battito() {
      var ms = quando.getTime() - Date.now();
      if (ms <= 0) {
        box.innerHTML = '<div class="cella" style="min-width:auto;padding:12px 22px">' +
          '<span class="n">🎉</span><span class="u">si gioca!</span></div>';
        return;
      }
      var s = Math.floor(ms / 1000);
      var gg = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600);
      var mm = Math.floor((s % 3600) / 60), ss = s % 60;
      box.innerHTML = cella(gg, gg === 1 ? 'giorno' : 'giorni') + cella(hh, 'ore') +
        cella(mm, 'minuti') + cella(ss, 'secondi');
    }
    battito();
    setInterval(battito, 1000);
  }

  /* --------------------- contatori degli iscritti ------------------------ */
  /* Numeri veri dal documento pubblico di Firestore. Si aggiornano da soli
     ogni minuto se la pagina è in primo piano, e subito quando si torna
     sulla scheda: così chi tiene la pagina aperta vede sempre il dato buono. */
  var CONTA = null;

  function contatori() { return CONTA; }

  function leggiContatori() {
    if (!window.FB || !FB.attivo()) return Promise.resolve(null);
    return FB.leggiContatori().then(function (c) {
      /* Se il documento non esiste ancora (nessuno si è iscritto) va bene
         mostrare zero: meglio di un trattino che sembra un guasto. */
      var v = c || { ragazzi: 0, adulti: 0, italiana: 0, burraco: 0 };
      CONTA = v;
      rinfreschi.forEach(function (f) { try { f(v); } catch (e) { } });
      return v;
    });
  }

  function avviaContatori(alCambio) {
    if (typeof alCambio === 'function') rinfreschi.push(alCambio);
    leggiContatori();
    if (ascoltiAvviati) return;
    ascoltiAvviati = true;
    setInterval(function () { if (!document.hidden) leggiContatori(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) leggiContatori(); });
    window.addEventListener('focus', leggiContatori);
  }

  /* Disegna un riquadro contatore: iscritti, posti, rimanenti.
     Il riquadro deve avere dentro gli elementi con questi id:
       <id>Num  <id>Eti  <id>Barra  */
  function mostraContatore(prefisso, iscritti, posti) {
    var n = Math.max(0, Number(iscritti) || 0);
    var tot = Math.max(0, Number(posti) || 0);
    var num = $(prefisso + 'Num'), eti = $(prefisso + 'Eti'), barra = $(prefisso + 'Barra');
    var box = $(prefisso + 'Box');
    if (num) num.textContent = String(n);
    if (eti) {
      eti.textContent = tot
        ? (n >= tot ? 'posti esauriti — puoi metterti in lista d\'attesa'
          : 'iscritti su ' + tot + ' posti · ne restano ' + (tot - n))
        : (n === 1 ? 'iscritto finora' : 'iscritti finora');
    }
    if (barra) barra.style.width = tot ? Math.min(100, Math.round(n * 100 / tot)) + '%' : '0%';
    if (box) box.classList.toggle('pieno', !!(tot && n >= tot));
  }

  /* ------------------------------- piede -------------------------------- */
  function disegnaPiede(idPiede) {
    var el = $(idPiede || 'piede');
    if (!el) return;
    var d = dati();
    var res = V(d.residence, {}), ev = V(d.evento, {}), con = V(d.contatti, {});
    var t = V(d.tema, {}), cond = V(d.condivisione, {});

    el.textContent = '';
    var fp = crea('div', 'fp');

    var a = crea('div');
    a.appendChild(crea('h4', null, V(t.titolo, 'Certamen Aquaticum')));
    a.appendChild(crea('p', null, V(t.sottotitolo, '')));
    a.appendChild(crea('p', null, dataIt(ev.data, true) + ' · ' + V(ev.orario, '') +
      (ev.orarioFine ? '–' + ev.orarioFine : '')));
    fp.appendChild(a);

    var b = crea('div');
    b.appendChild(crea('h4', null, 'Dove'));
    b.appendChild(crea('p', null, V(ev.luogo, '')));
    b.appendChild(crea('p', null, V(res.nome, '') + (res.localita ? ' — ' + res.localita : '')));
    fp.appendChild(b);

    var c = crea('div');
    c.appendChild(crea('h4', null, 'Organizzazione'));
    c.appendChild(crea('p', null, V(con.organizzatore, '')));
    if (con.telefono) {
      var p = crea('p');
      var link = crea('a', null, con.telefono);
      link.href = 'tel:' + String(con.telefono).replace(/\s/g, '');
      p.appendChild(document.createTextNode('Telefono: '));
      p.appendChild(link);
      c.appendChild(p);
    }
    fp.appendChild(c);

    var e = crea('div');
    e.appendChild(crea('h4', null, 'Pagine'));
    [['index.html', 'Home'], ['ragazzi.html', 'Giochi in acqua'],
    ['carte.html', 'Tornei di carte'], ['classifiche.html', 'Classifiche'],
    ['admin.html', 'Area organizzatori']].forEach(function (v) {
      var pp = crea('p');
      var l = crea('a', null, v[1]); l.href = v[0];
      pp.appendChild(l); e.appendChild(pp);
    });
    fp.appendChild(e);

    el.appendChild(fp);
    var copy = crea('div', 'copy',
      V(res.emoji, '') + ' ' + V(res.nome, 'Residence Holiday') + ' — ' +
      V(t.titolo, 'Certamen Aquaticum') + ' · sito fatto in casa, senza pubblicità' +
      (cond.urlSito ? '' : ''));
    el.appendChild(copy);
  }

  /* ------------------------------- avvisi ------------------------------- */
  var timerToast = null;
  function toast(msg, ms) {
    var el = $('toast');
    if (!el) { return; }
    el.textContent = String(msg || '');
    el.classList.add('visibile');
    if (timerToast) clearTimeout(timerToast);
    timerToast = setTimeout(function () { el.classList.remove('visibile'); }, ms || 5000);
  }

  /* ------------------- memoria del browser (con riserva) ----------------- */
  function memLeggi(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function memScrivi(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function memCancella(k) { try { localStorage.removeItem(k); } catch (e) { } }

  /* ------------------------- barra di navigazione ------------------------ */
  function segnaPagina() {
    var qui = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var voci = document.querySelectorAll('.menu a');
    for (var i = 0; i < voci.length; i++) {
      var href = (voci[i].getAttribute('href') || '').toLowerCase();
      if (href === qui) voci[i].classList.add('attivo');
    }
  }

  /* ------------------------- la musica dei giochi ------------------------ */
  /* Ogni gioco dei ragazzi ha la sua canzone. Se l'organizzatore ha incollato
     il collegamento di un video preciso si usa quello; altrimenti si apre la
     ricerca su YouTube del titolo, che funziona sempre e non scade mai. */
  function linkMusica(m) {
    if (!m) return '';
    var url = String(V(m.url, '')).trim();
    if (/^https?:\/\//i.test(url)) return url;
    var q = String(V(m.ricerca, '') || (V(m.titolo, '') + ' ' + V(m.artista, ''))).trim();
    if (!q) return '';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }
  function titoloMusica(m) {
    if (!m) return '';
    var t = String(V(m.titolo, '')).trim();
    var a = String(V(m.artista, '')).trim();
    if (!t) return a;
    return a ? (t + ' — ' + a) : t;
  }

  /* --------------------------- iscrizioni aperte? ------------------------ */
  function iscrizioniChiuse() {
    var ev = V(dati().evento, {});
    var fine = V(ev.chiusuraIscrizioni, '');
    if (!fine) return false;
    var p = String(fine).split('-');
    if (p.length !== 3) return false;
    var limite = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59);
    return Date.now() > limite.getTime();
  }

  window.CA = {
    $: $, V: V, esc: esc, testo: testo, crea: crea,
    dataIt: dataIt, dataBreve: dataBreve, eur: eur, colore: colore,
    carica: carica, dati: dati, applicaColori: applicaColori,
    avviaConto: avviaConto,
    avviaContatori: avviaContatori, leggiContatori: leggiContatori,
    contatori: contatori, mostraContatore: mostraContatore,
    disegnaPiede: disegnaPiede, toast: toast, segnaPagina: segnaPagina,
    memLeggi: memLeggi, memScrivi: memScrivi, memCancella: memCancella,
    iscrizioniChiuse: iscrizioniChiuse,
    linkMusica: linkMusica, titoloMusica: titoloMusica
  };
})();
