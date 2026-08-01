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
        disegnaAvviso();
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

  /* --------------------------- avviso in cima ---------------------------
     La striscia che l'organizzatore accende quando c'è da dire qualcosa a
     tutti: rimandato per pioggia, ritrovo spostato, iscrizioni chiuse prima.
     Compare da sola in cima a ogni pagina che carica i contenuti, senza
     doverla mettere pagina per pagina. */
  function disegnaAvviso() {
    var vecchio = $('avvisoSito');
    if (vecchio) vecchio.remove();

    var a = V(dati().avviso, {});
    if (a.attivo !== true || !String(V(a.testo, '')).trim()) return;

    var barra = crea('div', 'avviso-sito ' + (V(a.tipo, 'info')));
    barra.id = 'avvisoSito';
    barra.setAttribute('role', 'status');

    var dentro = crea('div', 'wrap avviso-dentro');
    dentro.appendChild(crea('span', 'segno', a.tipo === 'allarme' ? '⛔'
      : (a.tipo === 'attenzione' ? '⚠️' : 'ℹ️')));
    var testoBox = crea('div');
    if (a.titolo) testoBox.appendChild(crea('b', null, a.titolo));
    testoBox.appendChild(crea('span', null, a.testo));
    dentro.appendChild(testoBox);
    barra.appendChild(dentro);

    document.body.insertBefore(barra, document.body.firstChild);
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

  /* Ogni quindici secondi, non ogni minuto: con l'iscrizione aperta la gente
     guarda il contatore salire, e un minuto di attesa non sembra «in tempo
     reale». Solo con la pagina davanti agli occhi: in secondo piano si sta
     fermi e non si consuma la batteria. */
  var OGNI = 15000;

  function avviaContatori(alCambio) {
    if (typeof alCambio === 'function') rinfreschi.push(alCambio);
    leggiContatori();
    if (ascoltiAvviati) return;
    ascoltiAvviati = true;
    setInterval(function () { if (!document.hidden) leggiContatori(); }, OGNI);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) leggiContatori(); });
    window.addEventListener('focus', leggiContatori);
  }

  /* Disegna un riquadro contatore: iscritti, posti, rimanenti.
     Il riquadro deve avere dentro gli elementi con questi id:
       <id>Num  <id>Eti  <id>Barra  */
  var ultimiValori = {};

  function mostraContatore(prefisso, iscritti, posti) {
    var n = Math.max(0, Number(iscritti) || 0);
    var tot = Math.max(0, Number(posti) || 0);
    var num = $(prefisso + 'Num'), eti = $(prefisso + 'Eti'), barra = $(prefisso + 'Barra');
    var box = $(prefisso + 'Box');

    /* se il numero è cambiato lo si fa notare: chi sta guardando la pagina
       vede il conteggio salire, invece di trovarselo cambiato per magia */
    var prima = ultimiValori[prefisso];
    var cambiato = (prima !== undefined && prima !== n);
    ultimiValori[prefisso] = n;

    if (num) {
      num.textContent = String(n);
      if (cambiato) {
        num.classList.remove('salito');
        void num.offsetWidth;              /* riavvia l'animazione */
        num.classList.add('salito');
        if (n > prima) toast('🎉 Un nuovo iscritto! Adesso sono ' + n + '.', 5000);
      }
    }
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

  /* ---------------------- il messaggio da far girare --------------------- */
  /* Il testo dell'invito, pronto da incollare nei gruppi. Lo usano i pulsanti
     WhatsApp e Telegram e il riquadro «Condividi» dell'area organizzatori. */
  function urlSito() {
    var c = V(dati().condivisione, {});
    return V(c.urlSito, location.href.split('#')[0].replace(/[^\/]*$/, ''));
  }
  /* Niente emoji nel messaggio da condividere: su parecchi telefoni e sui
     WhatsApp da computer arrivano come quadratini, e l'invito sembra scritto
     male. Bastano le maiuscole, gli a capo e il puntino elenco (•), che si
     vede su qualsiasi dispositivo. */
  function messaggioInvito() {
    var d = dati();
    var t = V(d.tema, {}), ev = V(d.evento, {}), res = V(d.residence, {});
    var aree = V(d.aree, {}), rag = V(aree.ragazzi, {}), adu = V(aree.adulti, {});
    var q = V(d.quota, {});
    var r = [];

    r.push(String(V(t.titolo, 'Certamen Aquaticum')).toUpperCase());
    if (t.sottotitolo) r.push(t.sottotitolo);
    r.push('');

    var giorno = dataIt(ev.data, false);
    r.push(giorno.charAt(0).toUpperCase() + giorno.slice(1) +
      ', dalle ' + V(ev.orario, '') + ' alle ' + V(ev.orarioFine, ''));
    r.push(V(ev.luogo, '') + (res.localita ? ' — ' + res.localita : ''));
    r.push('');

    r.push('• ' + V(rag.nome, 'Giochi in acqua') + ' per i ' +
      V(rag.etichetta, 'ragazzi') + (rag.eta ? ' ' + rag.eta : ''));
    r.push('• ' + V(adu.nome, 'Tornei di carte') + ' per gli ' +
      V(adu.etichetta, 'adulti') + ': ' +
      torneiAttivi().map(function (x) { return x.nome; }).join(', '));
    r.push('');

    r.push(q.attiva === true
      ? ('Iscrizioni con quota di ' + eur(q.importo) + ' a persona' +
        (ev.chiusuraIscrizioni ? ', entro ' + dataIt(ev.chiusuraIscrizioni) : ''))
      : ('Iscrizioni gratuite' + (ev.chiusuraIscrizioni ? ' entro ' + dataIt(ev.chiusuraIscrizioni) : '')));
    r.push(urlSito());
    return r.join('\n');
  }
  /* Si può passare un testo proprio: nell'area organizzatori il messaggio è
     modificabile, e i pulsanti devono mandare quello che si legge nel riquadro. */
  function linkWhatsApp(testoScelto) {
    var c = V(dati().condivisione, {});
    if (c.linkGruppoWhatsApp) return String(c.linkGruppoWhatsApp);
    return 'https://wa.me/?text=' + encodeURIComponent(V(testoScelto, messaggioInvito()));
  }
  function linkTelegram(testoScelto) {
    var c = V(dati().condivisione, {});
    if (c.linkGruppoTelegram) return String(c.linkGruppoTelegram);
    /* Telegram vuole il link separato dal testo, altrimenti lo ripete */
    var testoSenzaLink = V(testoScelto, messaggioInvito())
      .split(urlSito()).join('').replace(/\n+$/, '');
    return 'https://t.me/share/url?url=' + encodeURIComponent(urlSito()) +
      '&text=' + encodeURIComponent(testoSenzaLink);
  }

  /* -------------------- giochi e tornei che si fanno --------------------- */
  /* Nell'area organizzatori si può escludere un gioco o un torneo: da quel
     momento non deve comparire da nessuna parte nel sito. Tutte le pagine
     pubbliche passano da qui, così basta una riga sola per farlo sparire. */
  function giochiAttivi() {
    return V(dati().giochi, []).filter(function (g) { return !g.escluso; });
  }
  function torneiAttivi() {
    return V(dati().tornei, []).filter(function (t) { return !t.escluso; });
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

  /* ------------------------ la scaletta di un gioco ---------------------- */
  /* Ogni gioco ha una scaletta lunga quanto il gioco stesso: si fa partire a
     inizio gara e finisce da sola quando è ora di tirare le somme. Se la
     scaletta non c'è si usa la canzone singola, così i contenuti vecchi
     continuano a funzionare. */
  var MINUTI_A_BRANO = 3.5;

  function playlistDi(g) {
    if (!g) return [];
    var l = V(g.playlist, []).filter(function (b) {
      return b && (String(V(b.titolo, '')).trim() || String(V(b.url, '')).trim());
    });
    if (l.length) return l;
    return g.musica ? [g.musica] : [];
  }

  function minutiPlaylist(g) {
    return Math.round(playlistDi(g).length * MINUTI_A_BRANO);
  }

  /* l'identificativo del video dentro un indirizzo di YouTube, in tutte le
     forme in cui la gente lo copia */
  function idVideo(url) {
    var u = String(V(url, '')).trim();
    if (!u) return '';
    var m = u.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
      u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
      u.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }

  /* Con due o più video precisi YouTube sa incolonnarli in una coda
     temporanea: un solo tocco e partono uno dietro l'altro, senza dover
     creare nessun account né nessuna playlist salvata. */
  /* Se in un brano c'è incollato un indirizzo che contiene già una playlist
     di YouTube (la parte «list=»), quella vince su tutto: è una scaletta
     vera, fatta e ordinata su YouTube, e basta aprirla. */
  function playlistYouTube(g) {
    var trovata = '';
    playlistDi(g).forEach(function (b) {
      if (trovata) return;
      var u = String(V(b.url, ''));
      if (/^https?:\/\//i.test(u) && /[?&]list=[A-Za-z0-9_-]{6,}/.test(u)) trovata = u;
    });
    return trovata;
  }

  function linkPlaylist(g) {
    var vera = playlistYouTube(g);
    if (vera) return vera;
    var brani = playlistDi(g);
    var ids = [];
    brani.forEach(function (b) {
      var id = idVideo(b.url);
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    if (ids.length >= 2) {
      return 'https://www.youtube.com/watch_videos?video_ids=' + ids.join(',');
    }
    return linkMusica(brani[0]);
  }

  /* quanti brani hanno il collegamento preciso: sotto due, la coda automatica
     non si può fare e si apre solo il primo */
  function braniColLink(g) {
    return playlistDi(g).filter(function (b) { return !!idVideo(b.url); }).length;
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
    disegnaPiede: disegnaPiede, disegnaAvviso: disegnaAvviso,
    toast: toast, segnaPagina: segnaPagina,
    memLeggi: memLeggi, memScrivi: memScrivi, memCancella: memCancella,
    iscrizioniChiuse: iscrizioniChiuse,
    linkMusica: linkMusica, titoloMusica: titoloMusica,
    playlistDi: playlistDi, minutiPlaylist: minutiPlaylist,
    linkPlaylist: linkPlaylist, braniColLink: braniColLink,
    playlistYouTube: playlistYouTube,
    idVideo: idVideo, MINUTI_A_BRANO: MINUTI_A_BRANO,
    giochiAttivi: giochiAttivi, torneiAttivi: torneiAttivi,
    urlSito: urlSito, messaggioInvito: messaggioInvito,
    linkWhatsApp: linkWhatsApp, linkTelegram: linkTelegram
  };
})();
