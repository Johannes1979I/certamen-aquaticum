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
    V(rubrica.giocatori, []).forEach(function (g) {
      if (!g || !g.nome) return;
      per[normale(g.nome)] = { nome: g.nome, compagno: V(g.compagno, ''), volte: V(g.volte, 0), da: 'rubrica' };
    });
    iscritti.forEach(function (p) {
      if (!p || !p.nome) return;
      var k = normale(p.nome);
      if (per[k]) { if (p.compagno) per[k].compagno = p.compagno; per[k].da = 'iscritto'; }
      else per[k] = { nome: p.nome, compagno: V(p.compagno, ''), volte: 0, da: 'iscritto' };
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
    var box = crea('div', 'passo');
    box.appendChild(crea('h3', null, '1 · Chi gioca'));
    box.appendChild(crea('p', 'aiuto',
      'Tocca i nomi di chi c\'è. Ci sono gli iscritti e chi ha già giocato altre volte; ' +
      'i nuovi si scrivono qui sotto, anche tutti insieme.'));

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
    inp.placeholder = 'Gianpaolo Zarletti\nVeronica Sarti\nLaura Bini, Serena Rossi';
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
    var box = crea('div', 'passo');
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
    var box = crea('div', 'passo');
    box.appendChild(crea('h3', null, '3 · Le coppie'));
    box.appendChild(crea('p', 'aiuto',
      'Chi si era dichiarato un compagno è già insieme. Per cambiare, tocca due nomi: si scambiano.'));

    var presa = null;
    var elenco = crea('div');
    box.appendChild(elenco);

    function ridisegna() {
      elenco.textContent = '';
      N.coppie.forEach(function (c, i) {
        var r = crea('div', 'coppia-r');
        r.appendChild(crea('span', 'n', (i + 1) + '.'));
        ['a', 'b'].forEach(function (lato) {
          var b = crea('button', 'btn btn-piccolo ' +
            (presa && presa.i === i && presa.lato === lato ? 'btn-p' : 'btn-chiaro'),
            c[lato] || '— libero —');
          b.style.flex = '1';
          b.addEventListener('click', function () {
            if (!presa) { presa = { i: i, lato: lato }; ridisegna(); return; }
            var altro = N.coppie[presa.i];
            var tmp = altro[presa.lato];
            altro[presa.lato] = c[lato];
            c[lato] = tmp;
            [altro, c].forEach(function (x) {
              x.nome = (x.a || '(vuoto)') + ' – ' + (x.b || '(da abbinare)');
            });
            presa = null;
            ridisegna();
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
    var coppie = N.coppie.filter(function (c) { return c.a; });
    if (coppie.length < 2) { avvisa('Servono almeno due coppie.'); return; }

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
  function giroEliminazione(coppie) {
    var out = [], k = 0;
    for (var i = 0; i + 1 < coppie.length; i += 2) {
      k++;
      out.push({
        id: 'm' + k, turno: 'Primo turno', a: coppie[i].id, b: coppie[i + 1].id,
        tavolo: k, puntiA: '', puntiB: '', mani: []
      });
    }
    return out;
  }

  window.TV = { apri: apri, chiudi: chiudi };
})();
