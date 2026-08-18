/* =========================================================================
   torneo-veloce.js — la procedura guidata per tirare su un torneo o una
   partita in tre passi, senza passare dalle iscrizioni.

   Sta in un file solo perché la usano due pagine: l'area organizzatori e la
   sala da gioco. Prima era scritta dentro una sola delle due, e infatti
   dall'altra sembrava non esistere.

   Chi la usa deve dire soltanto:
     TV.apri({
       velo:      l'elemento che fa da sfondo scuro,
       finestra:  dove disegnare i passi,
       rubrica:   { giocatori:[{nome, compagno, volte}] }  (si può omettere),
       iscritti:  [{nome, compagno}]   — chi si è iscritto, per proporlo
       salvaRubrica: function(rubrica){}   — facoltativa
       fatto:     function(torneo){}       — riceve il torneo pronto
     });
   ========================================================================= */
(function () {
  'use strict';

  function V(v, d) { return (v === undefined || v === null || v === '') ? d : v; }
  function crea(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = String(txt);
    return e;
  }
  function normale(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  /* ---------------------- trascinare i nomi ----------------------------
     Col mouse fa tutto il browser (draggable + drop). Col dito no: sul
     telefono il trascinamento del browser non esiste, quindi si tiene
     premuto un istante e poi si trascina, con un «fantasma» del nome che
     segue il dito. In tutti e due i casi il gesto fa la stessa cosa:
     scambiare di posto due nomi. */
  var DA = null;
  var FINETRASC = 0;      /* quando è finito l'ultimo trascinamento */

  function spegniBersagli() {
    var b = document.querySelectorAll('.nome-trasc.bersaglio');
    for (var i = 0; i < b.length; i++) b[i].classList.remove('bersaglio');
  }

  function bersaglioSotto(x, y) {
    var e = document.elementFromPoint(x, y);
    while (e && e !== document.body) {
      if (e.classList && e.classList.contains('nome-trasc')) return e;
      e = e.parentElement;
    }
    return null;
  }

  function fantasmaDi(b, x, y) {
    var g = b.cloneNode(true);
    var r = b.getBoundingClientRect();
    g.className = 'nome-trasc fantasma btn btn-p btn-piccolo';
    g.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;opacity:.9;' +
      'width:' + Math.round(r.width) + 'px;left:0;top:0;transform:translate(' +
      Math.round(x - r.width / 2) + 'px,' + Math.round(y - r.height / 2) + 'px) rotate(-2deg);';
    document.body.appendChild(g);
    g.__w = r.width; g.__h = r.height;
    return g;
  }
  function muoviFantasma(g, x, y) {
    if (!g) return;
    g.style.transform = 'translate(' + Math.round(x - g.__w / 2) + 'px,' +
      Math.round(y - g.__h / 2) + 'px) rotate(-2deg)';
  }
  function via(g) { if (g && g.parentNode) g.parentNode.removeChild(g); }

  function avvisa(m) {
    if (window.CA && CA.toast) CA.toast(m, 5000);
  }

  var NOMI_GIOCO = {
    scopone: 'Scopone scientifico', tresette: 'Tresette', briscola: 'Briscola',
    burraco: 'Burraco', altro: 'Carte'
  };

  var C = null;      /* la configurazione di chi ci ha chiamato */
  var N = null;      /* quello che si sta componendo */

  function apri(conf) {
    C = conf || {};
    var rub = V(C.rubrica, { giocatori: [] });
    N = {
      scelti: {}, nuovi: [], tipo: 'torneo', formato: 'italiana', formula: 'secca',
      gioco: 'scopone', traguardo: 41, ritorno: false, coppie: [], aMano: false,
      elenco: elencoIniziale(rub, V(C.iscritti, []))
    };
    passoGente();
    C.velo.classList.add('aperto');
  }

  /* La rubrica e gli iscritti sono due elenchi diversi che parlano delle
     stesse persone: si fondono, e chi risulta da tutte e due tiene il
     compagno dichiarato all'iscrizione, che è più fresco. */
  function elencoIniziale(rubrica, iscritti) {
    var per = {}, fuori = [];
    /* Si mostra tutto quello che c'è. Se al posto del nome c'è un codice del
       database lo si segnala, ma non si nasconde nessuno: una persona che
       non compare è peggio di un nome scritto male. */
    var codice = (window.CA && CA.sembraCodice) ? CA.sembraCodice : function () { return false; };
    V(rubrica.giocatori, []).forEach(function (g) {
      if (!g || !g.nome) return;
      per[normale(g.nome)] = {
        nome: g.nome, compagno: V(g.compagno, ''),
        volte: V(g.volte, 0), da: 'rubrica', illeggibile: codice(g.nome)
      };
    });
    iscritti.forEach(function (p) {
      if (!p || !p.nome) return;
      var k = normale(p.nome);
      var comp = V(p.compagno, '');
      if (per[k]) { if (comp) per[k].compagno = comp; per[k].da = 'iscritto'; }
      else per[k] = { nome: p.nome, compagno: comp, volte: 0, da: 'iscritto', illeggibile: codice(p.nome) };
    });
    Object.keys(per).forEach(function (k) { fuori.push(per[k]); });
    fuori.sort(function (a, b) {
      if ((b.da === 'iscritto') !== (a.da === 'iscritto')) return b.da === 'iscritto' ? 1 : -1;
      return (b.volte || 0) - (a.volte || 0);
    });
    return fuori;
  }

  function chiudi() { C.velo.classList.remove('aperto'); }

  function bottoniera(voci) {
    var az = crea('div', 'azioni');
    az.style.cssText = 'margin-top:14px;justify-content:center;flex-wrap:wrap';
    voci.forEach(function (v) {
      var b = crea('button', 'btn ' + (v.p ? 'btn-p' : 'btn-chiaro'), v.t);
      b.addEventListener('click', v.f);
      az.appendChild(b);
    });
    return az;
  }

  /* ------------------------------ passo 1 -------------------------------- */
  function passoGente() {
    var f = C.finestra;
    f.textContent = '';
    var box = crea('div', 'passo visibile');
    box.appendChild(crea('h3', null, '1 · Chi gioca'));
    box.appendChild(crea('p', 'aiuto',
      'Tocca i nomi di chi c\'è. Ci sono gli iscritti e chi ha già giocato altre volte; ' +
      'i nuovi si scrivono qui sotto, anche tutti insieme.'));
    /* Da dove arrivano i nomi: serve quando l'elenco sembra vuoto e non si
       capisce se il database non ha risposto o se davvero non c'è nessuno. */
    var quanti = crea('p', 'aiuto');
    quanti.style.cssText = 'font-size:.8rem;opacity:.75;margin-top:-6px';
    var daR = N.elenco.filter(function (g) { return g.da === 'rubrica'; }).length;
    var daI = N.elenco.length - daR;
    quanti.textContent = 'Letti dal database: ' + daI + (daI === 1 ? ' iscritto o giocatore' : ' fra iscritti e giocatori') +
      ' e ' + daR + (daR === 1 ? ' nome in rubrica' : ' nomi in rubrica') + '.';
    box.appendChild(quanti);

    if (N.elenco.length) {
      var rapide = crea('div', 'azioni');
      rapide.style.cssText = 'justify-content:flex-start;margin-bottom:8px';
      var tutti = crea('button', 'btn btn-chiaro btn-piccolo', '✅ Tutti');
      tutti.addEventListener('click', function () {
        N.elenco.concat(N.nuovi).forEach(function (g) {
          N.scelti[normale(g.nome)] = { nome: g.nome, compagno: V(g.compagno, '') };
        });
        passoGente();
      });
      var nessuno = crea('button', 'btn btn-chiaro btn-piccolo', '✖️ Nessuno');
      nessuno.addEventListener('click', function () { N.scelti = {}; passoGente(); });
      rapide.appendChild(tutti); rapide.appendChild(nessuno);
      box.appendChild(rapide);
    }

    var gente = crea('div', 'gente');
    N.elenco.concat(N.nuovi).forEach(function (g) {
      var k = normale(g.nome);
      var l = crea('label', 'tipo-g' + (N.scelti[k] ? ' preso' : ''));
      var c = document.createElement('input');
      c.type = 'checkbox'; c.checked = !!N.scelti[k];
      c.addEventListener('change', function () {
        if (c.checked) N.scelti[k] = { nome: g.nome, compagno: V(g.compagno, '') };
        else delete N.scelti[k];
        l.className = 'tipo-g' + (c.checked ? ' preso' : '');
        conta();
      });
      l.appendChild(c);
      l.appendChild(crea('span', 'chi', g.nome));
      if (g.compagno) l.appendChild(crea('small', null, 'con ' + g.compagno));
      else if (g.da === 'iscritto') l.appendChild(crea('small', null, 'iscritto, senza compagno'));
      gente.appendChild(l);
    });
    box.appendChild(gente);
    if (!N.elenco.length && !N.nuovi.length) {
      box.appendChild(crea('p', 'aiuto', 'Non c\'è ancora nessuno: scrivi qui sotto i nomi.'));
    }

    box.appendChild(crea('h3', null, 'Aggiungi giocatori'));
    box.appendChild(crea('p', 'aiuto',
      'Scrivili tutti insieme: uno per riga, oppure separati da virgola. Restano per le prossime volte.'));
    var campo = crea('div', 'campo');
    var inp = document.createElement('textarea');
    inp.rows = 3;
    inp.placeholder = 'Gianpaolo Zarletti\nLorenzo Bini\nLaura Neri, Serena Rossi';
    campo.appendChild(inp);
    box.appendChild(campo);
    var agg = crea('button', 'btn btn-chiaro btn-largo', '➕ Aggiungi questi giocatori');
    agg.addEventListener('click', function () {
      var nomi = String(inp.value || '').split(/[\n,;]+/)
        .map(function (s) { return s.trim(); }).filter(Boolean);
      if (!nomi.length) return;
      var messi = 0, gia = 0;
      nomi.forEach(function (n) {
        var k = normale(n);
        if (N.elenco.concat(N.nuovi).some(function (g) { return normale(g.nome) === k; })) {
          N.scelti[k] = N.scelti[k] || { nome: n, compagno: '' }; gia++; return;
        }
        N.nuovi.push({ nome: n, compagno: '' });
        N.scelti[k] = { nome: n, compagno: '' };
        messi++;
      });
      inp.value = '';
      passoGente();
      avvisa((messi ? messi + (messi === 1 ? ' giocatore aggiunto' : ' giocatori aggiunti') : '') +
        (gia ? (messi ? ', ' : '') + gia + ' c\'erano già' : ''));
    });
    box.appendChild(agg);

    var conto = crea('p', 'aiuto');
    box.appendChild(conto);
    function conta() {
      var q = Object.keys(N.scelti).length;
      conto.textContent = q
        ? (q + (q === 1 ? ' giocatore scelto' : ' giocatori scelti') +
          (q % 2 ? ' — sono dispari: uno resterebbe fuori' : ''))
        : 'Nessuno scelto per ora.';
    }
    conta();

    f.appendChild(box);
    f.appendChild(bottoniera([
      {
        t: 'Avanti →', p: true, f: function () {
          if (Object.keys(N.scelti).length < 4) { avvisa('Servono almeno quattro giocatori: due coppie.'); return; }
          passoCosa();
        }
      },
      { t: 'Annulla', f: chiudi }
    ]));
  }

  /* ------------------------------ passo 2 -------------------------------- */
  function passoCosa() {
    var f = C.finestra;
    f.textContent = '';
    var coppieQuante = Math.floor(Object.keys(N.scelti).length / 2);
    var box = crea('div', 'passo visibile');
    box.appendChild(crea('h3', null, '2 · Che cosa si gioca'));

    var scelte = crea('div', 'scelte-r');
    [{ id: 'partita', tit: '🃏 Partita singola', sotto: 'Due coppie e via, senza classifica.' },
    { id: 'torneo', tit: '🏆 Torneo', sotto: 'Girone o tabellone, con la classifica.' }
    ].forEach(function (s) {
      if (s.id === 'partita' && coppieQuante !== 2) return;
      var b = crea('button', 'scelta-r' + (N.tipo === s.id ? ' presa' : ''));
      b.appendChild(crea('b', null, s.tit));
      b.appendChild(crea('small', null, s.sotto));
      b.addEventListener('click', function () { N.tipo = s.id; passoCosa(); });
      scelte.appendChild(b);
    });
    box.appendChild(scelte);

    if (N.tipo === 'partita') {
      box.appendChild(crea('h3', null, 'Quante partite'));
      var q = crea('div', 'scelte-r');
      [{ id: 'secca', tit: 'Una secca', sotto: 'Chi vince, vince.' },
      { id: 'tre', tit: 'Al meglio delle tre', sotto: 'Si gioca fino a due vittorie.' }].forEach(function (s) {
        var b = crea('button', 'scelta-r' + (N.formula === s.id ? ' presa' : ''));
        b.appendChild(crea('b', null, s.tit));
        b.appendChild(crea('small', null, s.sotto));
        b.addEventListener('click', function () { N.formula = s.id; passoCosa(); });
        q.appendChild(b);
      });
      box.appendChild(q);
    } else {
      box.appendChild(crea('h3', null, 'La formula'));
      var fm = crea('div', 'scelte-r');
      [{ id: 'italiana', tit: 'Girone all\'italiana', sotto: 'Tutti contro tutti: la più giusta.' },
      { id: 'gironi', tit: 'Due gironi e finale', sotto: 'Da sette coppie in su.' },
      { id: 'eliminazione', tit: 'Eliminazione diretta', sotto: 'Chi perde esce.' }].forEach(function (s) {
        var b = crea('button', 'scelta-r' + (N.formato === s.id ? ' presa' : ''));
        b.appendChild(crea('b', null, s.tit));
        b.appendChild(crea('small', null, s.sotto));
        b.addEventListener('click', function () { N.formato = s.id; passoCosa(); });
        fm.appendChild(b);
      });
      box.appendChild(fm);
      if (N.formato === 'italiana') {
        var lr = crea('label', 'tipo-g' + (N.ritorno ? ' preso' : ''));
        var cr = document.createElement('input');
        cr.type = 'checkbox'; cr.checked = N.ritorno;
        cr.addEventListener('change', function () { N.ritorno = cr.checked; passoCosa(); });
        lr.appendChild(cr);
        lr.appendChild(crea('span', 'chi', 'Andata e ritorno'));
        box.appendChild(lr);
      }
    }

    box.appendChild(crea('h3', null, 'A che gioco'));
    var g = crea('div', 'campo');
    var sel = document.createElement('select');
    Object.keys(NOMI_GIOCO).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = k === 'altro' ? 'Un altro gioco' : NOMI_GIOCO[k];
      if (N.gioco === k) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { N.gioco = sel.value; });
    g.appendChild(sel);
    box.appendChild(g);

    var tg = crea('div', 'campo');
    tg.appendChild(crea('label', null, 'La partita finisce a quanti punti'));
    var it = document.createElement('input');
    it.type = 'number'; it.inputMode = 'numeric'; it.value = N.traguardo;
    it.addEventListener('change', function () { N.traguardo = Math.max(1, Number(it.value) || 41); });
    tg.appendChild(it);
    box.appendChild(tg);

    f.appendChild(box);
    f.appendChild(bottoniera([
      { t: 'Avanti →', p: true, f: function () { formaCoppie(); passoCoppie(); } },
      { t: '← Indietro', f: passoGente },
      { t: 'Annulla', f: chiudi }
    ]));
  }

  /* ------------------------------ passo 3 --------------------------------
     Le coppie si formano da sole rispettando chi si è dichiarato compagno —
     all'iscrizione o le altre volte che ha giocato — e accoppiando i
     rimasti. Poi si possono cambiare a mano toccando due nomi. */
  function formaCoppie() {
    var gente = Object.keys(N.scelti).map(function (k) { return N.scelti[k]; });
    var usati = {}, coppie = [];
    function metti(a, b) {
      usati[normale(a.nome)] = true;
      if (b) usati[normale(b.nome)] = true;
      coppie.push({
        id: 'c' + (coppie.length + 1), a: a.nome, b: b ? b.nome : '',
        nome: a.nome + ' – ' + (b ? b.nome : '(da abbinare)')
      });
    }
    /* prima chi si è scelto a vicenda */
    gente.forEach(function (p) {
      if (usati[normale(p.nome)] || !p.compagno) return;
      var altro = gente.filter(function (x) { return normale(x.nome) === normale(p.compagno); })[0];
      if (!altro || usati[normale(altro.nome)]) return;
      if (normale(V(altro.compagno, '')) !== normale(p.nome)) return;
      metti(p, altro);
    });
    /* poi chi l'ha chiesto a senso unico */
    gente.forEach(function (p) {
      if (usati[normale(p.nome)] || !p.compagno) return;
      var altro = gente.filter(function (x) { return normale(x.nome) === normale(p.compagno); })[0];
      if (!altro || usati[normale(altro.nome)]) return;
      metti(p, altro);
    });
    /* infine i rimasti, in ordine */
    var rimasti = gente.filter(function (p) { return !usati[normale(p.nome)]; });
    while (rimasti.length >= 2) metti(rimasti.shift(), rimasti.pop());
    if (rimasti.length === 1) metti(rimasti[0], null);
    N.coppie = coppie;
  }

  function passoCoppie() {
    var f = C.finestra;
    f.textContent = '';
    var box = crea('div', 'passo visibile');
    box.appendChild(crea('h3', null, '3 · Le coppie'));
    box.appendChild(crea('p', 'aiuto',
      'Chi si era dichiarato un compagno è già insieme. Per cambiare: ' +
      'trascina un nome sopra un altro e si scambiano di posto. ' +
      'Dal telefono tienilo premuto un istante e poi trascina — oppure, se è più comodo, ' +
      'tocca prima un nome e poi l\'altro.'));

    var presa = null;
    var elenco = crea('div');
    box.appendChild(elenco);

    /* Scambiare due nomi di posto: è l'unica cosa che si fa qui dentro, e
       la fanno sia il trascinamento sia i due tocchi. */
    function scambia(uno, due) {
      if (!uno || !due) return;
      if (uno.i === due.i && uno.lato === due.lato) return;
      var ca = N.coppie[uno.i], cb = N.coppie[due.i];
      var tmp = ca[uno.lato];
      ca[uno.lato] = cb[due.lato];
      cb[due.lato] = tmp;
      [ca, cb].forEach(function (x) {
        x.nome = (x.a || '(vuoto)') + ' – ' + (x.b || '(da abbinare)');
      });
    }

    function ridisegna() {
      elenco.textContent = '';
      N.coppie.forEach(function (c, i) {
        var r = crea('div', 'coppia-r');
        r.appendChild(crea('span', 'n', (i + 1) + '.'));
        ['a', 'b'].forEach(function (lato) {
          var b = crea('button', 'btn btn-piccolo nome-trasc ' +
            (presa && presa.i === i && presa.lato === lato ? 'btn-p' : 'btn-chiaro'),
            c[lato] || '— libero —');
          b.style.flex = '1';
          b.setAttribute('data-i', i);
          b.setAttribute('data-lato', lato);
          b.draggable = true;
          b.title = 'Trascinami sopra un altro nome per scambiarci di posto';

          b.addEventListener('click', function () {
            /* dopo un trascinamento il telefono può mandare anche un click:
               se lo ascoltassimo, il nome appena posato risulterebbe «preso» */
            if (Date.now() - FINETRASC < 500) return;
            if (!presa) { presa = { i: i, lato: lato }; ridisegna(); return; }
            scambia(presa, { i: i, lato: lato });
            presa = null;
            ridisegna();
          });

          /* ---- col mouse: il trascinamento del browser ---- */
          b.addEventListener('dragstart', function (e) {
            presa = null;
            DA = { i: i, lato: lato };
            b.classList.add('trascino');
            try { e.dataTransfer.setData('text/plain', i + ':' + lato); e.dataTransfer.effectAllowed = 'move'; } catch (x) { }
          });
          b.addEventListener('dragend', function () {
            b.classList.remove('trascino');
            spegniBersagli();
            DA = null;
          });
          b.addEventListener('dragover', function (e) {
            if (!DA) return;
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (x) { }
            spegniBersagli();
            if (!(DA.i === i && DA.lato === lato)) b.classList.add('bersaglio');
          });
          b.addEventListener('dragleave', function () { b.classList.remove('bersaglio'); });
          b.addEventListener('drop', function (e) {
            e.preventDefault();
            spegniBersagli();
            FINETRASC = Date.now();
            if (!DA) return;
            scambia(DA, { i: i, lato: lato });
            DA = null;
            ridisegna();
          });

          /* ---- col dito: si tiene premuto un istante e si trascina ---- */
          b.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse') return;        /* al mouse ci pensa il browser */
            var partito = false, fantasma = null;
            var attesa = setTimeout(function () {
              partito = true;
              DA = { i: i, lato: lato };
              b.classList.add('trascino');
              b.style.touchAction = 'none';
              fantasma = fantasmaDi(b, e.clientX, e.clientY);
              if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) { } }
            }, 260);

            function muovi(ev) {
              if (!partito) {
                /* se si muove prima che scatti, sta scorrendo la pagina */
                clearTimeout(attesa);
                fine(ev, false);
                return;
              }
              ev.preventDefault();
              muoviFantasma(fantasma, ev.clientX, ev.clientY);
              spegniBersagli();
              var sotto = bersaglioSotto(ev.clientX, ev.clientY);
              if (sotto && sotto !== b) sotto.classList.add('bersaglio');
            }
            function su(ev) {
              clearTimeout(attesa);
              if (!partito) { fine(ev, false); return; }
              var sotto = bersaglioSotto(ev.clientX, ev.clientY);
              fine(ev, true);
              if (sotto && sotto !== b) {
                FINETRASC = Date.now();
                scambia(DA, { i: Number(sotto.getAttribute('data-i')), lato: sotto.getAttribute('data-lato') });
                DA = null;
                ridisegna();
                return;
              }
              DA = null;
            }
            function fine(ev, eraPartito) {
              b.classList.remove('trascino');
              b.style.touchAction = '';
              spegniBersagli();
              via(fantasma); fantasma = null;
              b.removeEventListener('pointermove', muovi);
              b.removeEventListener('pointerup', su);
              b.removeEventListener('pointercancel', su);
              try { b.releasePointerCapture(e.pointerId); } catch (x) { }
            }
            try { b.setPointerCapture(e.pointerId); } catch (x) { }
            b.addEventListener('pointermove', muovi);
            b.addEventListener('pointerup', su);
            b.addEventListener('pointercancel', su);
          });

          r.appendChild(b);
        });
        elenco.appendChild(r);
      });
    }
    ridisegna();

    var rif = crea('button', 'btn btn-chiaro btn-piccolo', '🔄 Rifalle da capo');
    rif.addEventListener('click', function () { formaCoppie(); presa = null; ridisegna(); });
    box.appendChild(rif);

    f.appendChild(box);
    f.appendChild(bottoniera([
      { t: '▶️ Si comincia', p: true, f: consegna },
      { t: '← Indietro', f: passoCosa },
      { t: 'Annulla', f: chiudi }
    ]));
  }

  /* ------------------------ il torneo bell'e pronto ---------------------- */
  function consegna() {
    /* Una «coppia» con un solo nome non può giocare a carte: se i giocatori
       sono dispari uno resta senza compagno, e mandarlo al tavolo da solo
       vorrebbe dire falsare tutto il torneo. Si dice, e si lascia fuori. */
    var soli = N.coppie.filter(function (c) { return c.a && !c.b; });
    var coppie = N.coppie.filter(function (c) { return c.a && c.b; });
    if (coppie.length < 2) { avvisa('Servono almeno due coppie complete.'); return; }
    if (soli.length) {
      if (!confirm(soli.map(function (c) { return c.a; }).join(' e ') +
        (soli.length === 1 ? ' è rimasto senza compagno e resterebbe fuori dal torneo.'
          : ' sono rimasti senza compagno e resterebbero fuori dal torneo.') +
        '\n\nVai avanti lo stesso? (per farli giocare, torna indietro e togli o aggiungi un nome)')) return;
    }

    var incontri = [];
    if (N.tipo === 'partita') {
      var quante = N.formula === 'tre' ? 3 : 1;
      for (var i = 1; i <= quante; i++) {
        incontri.push({
          id: 'm' + i, turno: quante === 1 ? 'La partita' : ('Partita ' + i),
          a: coppie[0].id, b: coppie[1].id, tavolo: 1, puntiA: '', puntiB: '', mani: []
        });
      }
    } else if (N.formato === 'eliminazione') {
      incontri = giroEliminazione(coppie);
    } else if (N.formato === 'gironi' && coppie.length >= 6) {
      incontri = giroGironi(coppie);
    } else if (N.formato === 'gironi') {
      /* Con meno di sei coppie i due gironi verrebbero da due o tre squadre
         l'uno: non è un torneo, è un sorteggio. Si gioca all'italiana e si
         dice perché, invece di consegnare un tabellone storto. */
      N.formato = 'italiana';
      incontri = giroItaliana(coppie);
      avvisa('Siete in ' + coppie.length + ' coppie: i due gironi verrebbero troppo piccoli. Ho fatto un girone all\'italiana, tutte contro tutte.');
    } else {
      incontri = giroItaliana(coppie);
      if (N.ritorno) {
        incontri = incontri.concat(incontri.map(function (m) {
          return {
            id: 'r' + m.id, turno: 'Ritorno · ' + m.turno, a: m.b, b: m.a,
            tavolo: m.tavolo, puntiA: '', puntiB: '', mani: []
          };
        }));
      }
    }

    var torneo = {
      veloce: true,
      nome: (N.tipo === 'partita'
        ? (N.formula === 'tre' ? 'Sfida al meglio delle tre' : 'Partita secca')
        : 'Torneo di ' + (NOMI_GIOCO[N.gioco] || 'carte').toLowerCase()),
      gioco: N.gioco,
      nomeGioco: NOMI_GIOCO[N.gioco] || 'Carte',
      tipo: N.tipo,
      formula: N.formula,
      formato: N.tipo === 'partita' ? 'sfida' : N.formato,
      traguardo: N.traguardo,
      ritorno: !!N.ritorno,
      inizio: new Date().toISOString(),
      fine: '',
      coppie: coppie,
      incontri: incontri
    };

    /* chi ha giocato resta in rubrica col compagno di stasera */
    if (typeof C.salvaRubrica === 'function') {
      var rub = V(C.rubrica, { giocatori: [] });
      rub.giocatori = V(rub.giocatori, []);
      var per = {};
      rub.giocatori.forEach(function (g) { per[normale(g.nome)] = g; });
      Object.keys(N.scelti).forEach(function (k) {
        var nome = N.scelti[k].nome;
        var sua = coppie.filter(function (c) { return normale(c.a) === k || normale(c.b) === k; })[0];
        var compagno = sua ? (normale(sua.a) === k ? sua.b : sua.a) : '';
        if (per[k]) { per[k].volte = (per[k].volte || 0) + 1; if (compagno) per[k].compagno = compagno; }
        else { per[k] = { nome: nome, compagno: compagno, volte: 1 }; rub.giocatori.push(per[k]); }
      });
      rub.giocatori.sort(function (a, b) { return (b.volte || 0) - (a.volte || 0); });
      try { C.salvaRubrica(rub); } catch (e) { }
    }

    chiudi();
    if (typeof C.fatto === 'function') C.fatto(torneo);
  }

  /* girone all'italiana col metodo del cerchio */
  function giroItaliana(coppie) {
    var ids = coppie.map(function (c) { return c.id; });
    if (ids.length % 2) ids.push(null);
    var n = ids.length, out = [], k = 0;
    for (var t = 0; t < n - 1; t++) {
      var tav = 1;
      for (var i = 0; i < n / 2; i++) {
        var a = ids[i], b = ids[n - 1 - i];
        if (a === null || b === null) continue;
        k++;
        out.push({
          id: 'm' + k, turno: 'Turno ' + (t + 1), a: a, b: b, tavolo: tav++,
          puntiA: '', puntiB: '', mani: []
        });
      }
      ids.splice(1, 0, ids.pop());
    }
    return out;
  }
  /* Due gironi e finale: le coppie si dividono in due, ognuna gioca il suo
     girone all'italiana, e la finale la mette insieme la pagina delle
     partite quando i due gironi sono finiti — prima non si sa chi la gioca.
     La divisione è a serpentina (1ª e 4ª di qua, 2ª e 3ª di là) così, se
     l'ordine delle coppie rispecchia la forza, i gironi restano pari. */
  function giroGironi(coppie) {
    coppie.forEach(function (c, i) {
      c.girone = (i % 4 === 0 || i % 4 === 3) ? 'A' : 'B';
    });
    var out = [], k = 0;
    ['A', 'B'].forEach(function (g) {
      var sue = coppie.filter(function (c) { return c.girone === g; });
      if (sue.length < 2) return;
      giroItaliana(sue).forEach(function (m) {
        k++;
        m.id = 'g' + g + k;
        m.turno = 'Girone ' + g + ' · ' + m.turno;
        m.girone = g;
        out.push(m);
      });
    });
    return out;
  }

  /* Come si chiama il turno, secondo quante coppie ci sono ancora. I turni
     dopo il primo li mette la pagina delle partite, quando si sa chi ha
     vinto: qui si può solo cominciare. */
  function nomeGiro(quante) {
    if (quante <= 2) return '🏁 Finale';
    if (quante <= 4) return 'Semifinali';
    if (quante <= 8) return 'Quarti';
    if (quante <= 16) return 'Ottavi';
    return 'Primo turno';
  }

  function giroEliminazione(coppie) {
    var out = [], k = 0;
    for (var i = 0; i + 1 < coppie.length; i += 2) {
      k++;
      out.push({
        id: 'm' + k, turno: nomeGiro(coppie.length), giro: 1,
        a: coppie[i].id, b: coppie[i + 1].id,
        tavolo: k, puntiA: '', puntiB: '', mani: []
      });
    }
    return out;
  }

  window.TV = { apri: apri, chiudi: chiudi };
})();
