/* =========================================================================
   iscrizione.js — il percorso guidato di iscrizione, uguale per tutte e tre
   le sezioni (giochi in acqua, giochi all'italiana, burraco).

   La pagina che lo carica deve dichiarare PRIMA:
       window.ISCR = { area:'ragazzi' }
       window.ISCR = { area:'adulti', gruppo:'italiana' }
       window.ISCR = { area:'adulti', gruppo:'burraco' }

   Regole imparate dal sito della festa, da non ripetere:
   1. l'iscrizione parte SUBITO alla conferma, non su un pulsante finale:
      la gente vede il pass e chiude la pagina;
   2. se resta in sospeso, alla riapertura della pagina riprova da sola;
   3. l'esito si vede sempre, con un banner grande sopra il pass.
   ========================================================================= */
(function () {
  'use strict';

  var $ = CA.$, V = CA.V, testo = CA.testo, crea = CA.crea;
  var DATI = {};
  var CFG = window.ISCR || { area: 'ragazzi' };
  var GRUPPO = null;          /* solo per le carte */
  var PASSO = 1, NPASSI = 3;
  var FATTA = null;           /* l'iscrizione confermata */
  var CHIAVE = 'ca_iscr_' + CFG.area + (CFG.gruppo ? '_' + CFG.gruppo : '');

  /* ------------------------------ avvio -------------------------------- */
  CA.carica().then(function (d) {
    DATI = d;
    GRUPPO = trovaGruppo();
    intesta();
    costruisci();
    CA.segnaPagina();
    CA.disegnaPiede('piede');
    CA.avviaContatori(mostraPosti);
    controllaIscrizioneSalvata();
    if (CA.iscrizioniChiuse()) chiudi();
  }).catch(function (e) {
    CA.toast('Non riesco a leggere i contenuti del sito: ' + e.message, 9000);
  });

  function trovaGruppo() {
    if (CFG.area !== 'adulti') return null;
    var g = V(DATI.gruppiCarte, []).filter(function (x) { return x.id === CFG.gruppo; })[0];
    return g || null;
  }
  function areaDati() { return V(V(DATI.aree, {})[CFG.area], {}); }

  /* i tornei di questa sezione (solo per le carte) */
  function torneiSezione() {
    if (!GRUPPO) return [];
    var ids = V(GRUPPO.tornei, []);
    return V(DATI.tornei, []).filter(function (t) { return ids.indexOf(t.id) >= 0; });
  }
  /* le gare individuali facoltative (solo per i ragazzi) */
  function gareIndividuali() {
    return V(DATI.giochi, []).filter(function (g) { return g.tipo === 'individuale'; });
  }

  /* ---------------------------- intestazione ---------------------------- */
  function intesta() {
    var t = V(DATI.tema, {}), ev = V(DATI.evento, {}), a = areaDati();
    var titolo = GRUPPO ? V(GRUPPO.nome, '') : V(a.titoloLungo, V(a.nome, ''));
    var emoji = GRUPPO ? V(GRUPPO.emoji, '🃏') : V(a.emoji, '🤽');
    document.title = 'Iscrizione — ' + titolo;
    testo('marchioNome', V(t.titolo, 'Certamen Aquaticum'));
    testo('heroTitolo', 'Iscrizione');
    testo('heroSezione', emoji + ' ' + titolo);
    testo('heroSottotitolo', GRUPPO ? V(GRUPPO.sottotitolo, '') : V(a.sottotitolo, ''));
    testo('heroQuando', '📅 ' + CA.dataIt(ev.data, true) + ' · ' + V(ev.orario, '') + '–' + V(ev.orarioFine, ''));
    var foto = V(DATI.fotoHero, (V(DATI.foto, [])[0] || ''));
    if (foto) { var s = $('heroSfondo'); if (s) s.style.backgroundImage = 'url("' + encodeURI(foto) + '")'; }
    var q = V(DATI.quota, {});
    testo('heroQuota', q.attiva === true
      ? ('🎟️ quota ' + CA.eur(q.importo) + ' a persona, si consegna all\'accoglienza')
      : '🎟️ iscrizione gratuita');
  }

  function mostraPosti(c) {
    var a = areaDati();
    var quanti = GRUPPO ? V(c[GRUPPO.id], 0) : V(c[CFG.area], 0);
    var posti = GRUPPO ? V(GRUPPO.postiTotali, 0) : V(a.postiTotali, 0);
    CA.mostraContatore('posti', quanti, posti);
  }

  function chiudi() {
    var p = $('pannelloPassi');
    if (p) p.style.display = 'none';
    var av = $('chiuse');
    if (av) av.style.display = '';
  }

  /* ====================== costruzione dei passi ========================= */
  function costruisci() {
    NPASSI = 3;
    disegnaPallini();
    if (CFG.area === 'ragazzi') { passoRagazzi1(); passoRagazzi2(); }
    else { passoAdulti1(); passoAdulti2(); }
    vaiA(1);
    $('btnAvanti').addEventListener('click', avanti);
    $('btnIndietro').addEventListener('click', indietro);
    $('btnConferma').addEventListener('click', conferma);
  }

  function disegnaPallini() {
    var el = $('passi');
    el.textContent = '';
    var nomi = (CFG.area === 'ragazzi')
      ? ['Chi partecipa', 'Le gare in più', 'Conferma']
      : ['Chi gioca', 'Tornei e compagno', 'Conferma'];
    for (var i = 1; i <= NPASSI; i++) {
      var d = crea('div', 'passo-pallino');
      d.id = 'pal' + i;
      d.appendChild(crea('span', 'b', String(i)));
      d.appendChild(crea('span', null, nomi[i - 1]));
      el.appendChild(d);
    }
  }

  /* --------------------------- moduli: pezzi ---------------------------- */
  function campo(id, etichetta, aiuto, tipo, extra) {
    var d = crea('div', 'campo');
    var l = document.createElement('label');
    l.setAttribute('for', id);
    l.textContent = etichetta;
    d.appendChild(l);
    if (aiuto) d.appendChild(crea('div', 'aiuto', aiuto));
    var i;
    if (tipo === 'textarea') { i = document.createElement('textarea'); }
    else if (tipo === 'select') {
      i = document.createElement('select');
      (extra || []).forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        i.appendChild(op);
      });
    } else {
      i = document.createElement('input');
      i.type = tipo || 'text';
      if (tipo === 'number' && extra) { i.min = extra[0]; i.max = extra[1]; }
    }
    i.id = id;
    if (tipo === 'tel') i.autocomplete = 'tel';
    d.appendChild(i);
    var e = crea('div', 'errore');
    e.id = 'e_' + id;
    d.appendChild(e);
    return d;
  }

  function scelta(id, titolo, sotto, tipoInput, nomeGruppo, valore) {
    var l = document.createElement('label');
    l.className = 'scelta';
    l.setAttribute('for', id);
    var i = document.createElement('input');
    i.type = tipoInput; i.id = id;
    if (nomeGruppo) i.name = nomeGruppo;
    if (valore !== undefined) i.value = valore;
    l.appendChild(i);
    var box = crea('div');
    box.appendChild(crea('div', 't', titolo));
    if (sotto) box.appendChild(crea('div', 's', sotto));
    l.appendChild(box);
    i.addEventListener('change', function () { l.classList.toggle('presa', i.checked); aggiornaPresa(nomeGruppo); });
    return l;
  }
  function aggiornaPresa(nomeGruppo) {
    if (!nomeGruppo) return;
    var v = document.querySelectorAll('input[name="' + nomeGruppo + '"]');
    for (var i = 0; i < v.length; i++) {
      v[i].parentNode.classList.toggle('presa', v[i].checked);
    }
  }

  function mostraErrore(id, msg) {
    var e = $('e_' + id), c = $(id);
    if (e) { e.textContent = msg; e.className = 'errore visibile'; }
    if (c) { c.classList.add('ko'); c.focus(); }
  }
  function nascondiErrore(id) {
    var e = $('e_' + id), c = $(id);
    if (e) e.className = 'errore';
    if (c) c.classList.remove('ko');
  }
  function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }

  /* --------------------------- passi: ragazzi --------------------------- */
  function passoRagazzi1() {
    var box = $('p1');
    var a = areaDati();
    box.appendChild(intro('Chi partecipa ai giochi in acqua',
      'Serve qualche informazione in più del solito: l\'età e quanto se la cava in acqua ' +
      'ci servono per fare squadre equilibrate e per la sicurezza. ' + V(V(DATI.iscrizione, {}).notaRagazzi, '')));

    box.appendChild(campo('fNome', 'Nome e cognome del ragazzo o della ragazza *', '', 'text'));
    box.appendChild(campo('fEta', 'Quanti anni ha *',
      'Serve a formare squadre equilibrate: si gioca ' + V(a.eta, 'dagli 8 anni in su') +
      ', e i più piccoli non finiscono tutti nella stessa squadra.', 'number', [8, 19]));
    box.appendChild(campo('fNuoto', 'Come se la cava in acqua *',
      'Nessuno viene escluso: serve solo a stargli vicino e a bilanciare le squadre.', 'select', [
        ['', '— scegli —'],
        ['bene', 'Nuota bene, anche dove non tocca'],
        ['media', 'Se la cava, ma preferisce dove tocca'],
        ['poco', 'Nuota poco: meglio se resta nella parte bassa']
      ]));
    box.appendChild(campo('fSesso', 'Categoria (facoltativo)',
      'Serve solo a distribuire in modo equilibrato le squadre.', 'select', [
        ['', 'Preferisco non dirlo'],
        ['f', 'Ragazza'],
        ['m', 'Ragazzo']
      ]));
    box.appendChild(campo('fGenitore', 'Nome di un genitore *', '', 'text'));
    box.appendChild(campo('fTel', 'Telefono del genitore *', 'Ci serve solo per avvisarvi se cambia qualcosa.', 'tel'));
    if (V(DATI.iscrizione, {}).chiediAppartamento !== false) {
      box.appendChild(campo('fApp', 'Appartamento', 'Se siete ospiti del residence.', 'text'));
    }
    box.appendChild(campo('fAmico', 'Vorrebbe stare in squadra con… (facoltativo)',
      'Scrivi pure il nome di un amico o di un fratello: lo leggiamo. Le squadre però le formiamo ' +
      'per età e capacità in acqua, così le gare sono belle per tutti, e quasi sempre gli amici ' +
      'finiscono in squadre diverse.', 'text'));
    box.appendChild(campo('fNote', 'Qualcosa che dobbiamo sapere?',
      'Allergie, terapie, paure dell\'acqua, qualsiasi cosa.', 'textarea'));
  }

  function passoRagazzi2() {
    var box = $('p2');
    box.appendChild(intro('Le gare in più',
      'A tutti i giochi a squadre partecipa tutta la squadra: non devi scegliere niente. ' +
      'Queste invece sono le gare individuali, facoltative: spunta quelle a cui vuole partecipare.'));

    var gare = gareIndividuali();
    var sc = crea('div', 'scelte');
    gare.forEach(function (g) {
      sc.appendChild(scelta('gara_' + g.id, V(g.emoji, '🙋') + ' ' + V(g.nome, ''),
        V(g.descrizione, '').slice(0, 120) + '…', 'checkbox', 'gare', g.id));
    });
    box.appendChild(sc);

    var n = crea('p', null, 'Puoi anche non spuntarne nessuna: si decide sul momento, a bordo vasca.');
    n.style.cssText = 'margin-top:14px;color:var(--muted);font-size:.92rem';
    box.appendChild(n);
  }

  /* --------------------------- passi: adulti ---------------------------- */
  function passoAdulti1() {
    var box = $('p1');
    box.appendChild(intro('Chi gioca', 'Poche cose: come ti chiami e come ti troviamo.'));
    box.appendChild(campo('fNome', 'Nome e cognome *', '', 'text'));
    box.appendChild(campo('fTel', 'Telefono *', 'Serve solo per avvisarti se cambia l\'orario del tuo tavolo.', 'tel'));
    if (V(DATI.iscrizione, {}).chiediAppartamento !== false) {
      box.appendChild(campo('fApp', 'Appartamento', 'Se sei ospite del residence.', 'text'));
    }
    box.appendChild(campo('fLivello', 'Quanto giochi? *',
      'Non è una gara di bravura: serve a fare tavoli equilibrati e a non far annoiare nessuno.', 'select', [
        ['', '— scegli —'],
        ['principiante', 'Poco: conosco le regole ma gioco raramente'],
        ['medio', 'Il giusto: qualche partita ogni tanto'],
        ['esperto', 'Tanto: gioco spesso e sul serio']
      ]));
    box.appendChild(campo('fNote', 'Note per gli organizzatori', 'Facoltativo.', 'textarea'));
  }

  function passoAdulti2() {
    var box = $('p2');
    var tornei = torneiSezione();
    box.appendChild(intro('A quali tornei ti iscrivi',
      tornei.length > 1
        ? 'Puoi sceglierne anche più di uno, ma non due dello stesso blocco orario: si giocano in contemporanea.'
        : 'Questa sezione ha un torneo solo.'));

    var sc = crea('div', 'scelte');
    tornei.forEach(function (t) {
      var sotto = 'Blocco ' + V(t.blocco, '') + ' · dalle ' + V(t.orario, '') +
        ' · ' + V(t.partita, V(t.formula, ''));
      var l = scelta('tor_' + t.id, V(t.emoji, '🃏') + ' ' + V(t.nome, ''), sotto, 'checkbox', 'tornei', t.id);
      sc.appendChild(l);
    });
    box.appendChild(sc);
    var eT = crea('div', 'errore');
    eT.id = 'e_tornei';
    box.appendChild(eT);

    /* se il torneo è uno solo, è già spuntato */
    if (tornei.length === 1) {
      setTimeout(function () {
        var i = $('tor_' + tornei[0].id);
        if (i) { i.checked = true; aggiornaPresa('tornei'); }
      }, 0);
    }

    /* ---- il compagno di coppia ---- */
    var h = crea('h3', null, '👥 Da solo o in coppia?');
    h.style.cssText = 'margin:30px 0 6px;font-size:1.15rem';
    box.appendChild(h);
    box.appendChild(crea('p', 'aiuto', V(V(DATI.iscrizione, {}).notaAdulti, '')));

    var sc2 = crea('div', 'scelte');
    sc2.style.marginTop = '10px';
    sc2.appendChild(scelta('cSolo', '🙋 Mi iscrivo da solo',
      'Gli organizzatori mi abbinano a un compagno il giorno stesso.', 'radio', 'coppia', 'solo'));
    sc2.appendChild(scelta('cCoppia', '👥 Ho già il compagno',
      'Scrivo qui sotto il suo nome: giochiamo insieme.', 'radio', 'coppia', 'coppia'));
    box.appendChild(sc2);

    var dc = crea('div');
    dc.id = 'boxCompagno';
    dc.style.cssText = 'display:none;margin-top:16px';
    dc.appendChild(campo('fCompagno', 'Nome e cognome del compagno *',
      'Se anche lui si iscrive da questa pagina, scrivete lo stesso nome a vicenda: vi mettiamo insieme.', 'text'));
    box.appendChild(dc);

    $('cSolo').addEventListener('change', function () { dc.style.display = 'none'; });
    $('cCoppia').addEventListener('change', function () { dc.style.display = ''; });
    setTimeout(function () { $('cSolo').checked = true; aggiornaPresa('coppia'); }, 0);
  }

  function intro(titolo, sotto) {
    var d = crea('div');
    var h = crea('h2', null, titolo);
    h.style.cssText = 'font-size:1.35rem;margin-bottom:8px';
    d.appendChild(h);
    if (sotto) {
      var p = crea('p', null, sotto);
      p.style.cssText = 'color:var(--muted);margin-bottom:22px';
      d.appendChild(p);
    }
    return d;
  }

  /* ============================== navigazione =========================== */
  function vaiA(n, senzaScorrere) {
    PASSO = Math.max(1, Math.min(NPASSI, n));
    for (var i = 1; i <= NPASSI; i++) {
      var p = $('p' + i);
      if (p) p.className = 'passo' + (i === PASSO ? ' visibile' : '');
      var pal = $('pal' + i);
      if (pal) pal.className = 'passo-pallino' + (i === PASSO ? ' attivo' : (i < PASSO ? ' fatto' : ''));
    }
    $('btnIndietro').style.visibility = (PASSO === 1) ? 'hidden' : 'visible';
    $('btnAvanti').style.display = (PASSO === NPASSI) ? 'none' : '';
    $('btnConferma').style.display = (PASSO === NPASSI) ? '' : 'none';
    if (PASSO === NPASSI) disegnaRiepilogo();
    if (!senzaScorrere) {
      var box = $('pannelloPassi');
      if (box) window.scrollTo({ top: box.offsetTop - 70, behavior: 'smooth' });
    }
  }
  function avanti() { if (valida(PASSO)) vaiA(PASSO + 1); }
  function indietro() { vaiA(PASSO - 1); }

  function valida(n) {
    if (n !== 1 && n !== 2) return true;

    if (n === 1) {
      if (!val('fNome')) { mostraErrore('fNome', 'Scrivi il nome e il cognome.'); return false; }
      nascondiErrore('fNome');
      if (!val('fTel') || val('fTel').replace(/\D/g, '').length < 8) {
        mostraErrore('fTel', 'Scrivi un numero di telefono valido.'); return false;
      }
      nascondiErrore('fTel');

      if (CFG.area === 'ragazzi') {
        var eta = Number(val('fEta'));
        if (!eta || eta < 8 || eta > 19) { mostraErrore('fEta', 'Scrivi l\'età, fra 8 e 19 anni.'); return false; }
        nascondiErrore('fEta');
        if (!val('fNuoto')) { mostraErrore('fNuoto', 'Scegli una risposta: serve per la sicurezza.'); return false; }
        nascondiErrore('fNuoto');
        if (!val('fGenitore')) { mostraErrore('fGenitore', 'Scrivi il nome di un genitore.'); return false; }
        nascondiErrore('fGenitore');
      } else {
        if (!val('fLivello')) { mostraErrore('fLivello', 'Scegli quanto giochi di solito.'); return false; }
        nascondiErrore('fLivello');
      }
      return true;
    }

    /* passo 2: solo le carte hanno controlli */
    if (CFG.area !== 'adulti') return true;

    var scelti = torneiScelti();
    var eT = $('e_tornei');
    if (!scelti.length) {
      eT.textContent = 'Scegli almeno un torneo.';
      eT.className = 'errore visibile';
      return false;
    }
    var blocchi = {};
    for (var i = 0; i < scelti.length; i++) {
      var b = String(scelti[i].blocco || '').toUpperCase();
      if (blocchi[b]) {
        eT.textContent = 'Non puoi iscriverti a due tornei del blocco ' + b + ': si giocano in contemporanea.';
        eT.className = 'errore visibile';
        return false;
      }
      blocchi[b] = true;
    }
    eT.className = 'errore';

    if ($('cCoppia').checked && !val('fCompagno')) {
      mostraErrore('fCompagno', 'Scrivi il nome del compagno, oppure scegli “mi iscrivo da solo”.');
      return false;
    }
    nascondiErrore('fCompagno');
    return true;
  }

  function torneiScelti() {
    var out = [];
    torneiSezione().forEach(function (t) {
      var i = $('tor_' + t.id);
      if (i && i.checked) out.push(t);
    });
    return out;
  }
  function gareScelte() {
    var out = [];
    gareIndividuali().forEach(function (g) {
      var i = $('gara_' + g.id);
      if (i && i.checked) out.push(g);
    });
    return out;
  }

  /* ============================== riepilogo ============================= */
  function disegnaRiepilogo() {
    var el = $('riepilogo');
    el.textContent = '';
    var q = V(DATI.quota, {});

    function sez(titolo) {
      var d = crea('div', 'riep');
      d.style.marginBottom = '16px';
      d.appendChild(crea('h4', null, titolo));
      el.appendChild(d);
      return d;
    }
    function riga(dove, sinistra, destra) {
      var r = crea('div', 'riga');
      r.appendChild(crea('span', null, sinistra));
      r.appendChild(crea('span', 'd', destra));
      dove.appendChild(r);
    }

    var s1 = sez(CFG.area === 'ragazzi' ? 'Chi partecipa' : 'Chi gioca');
    riga(s1, 'Nome', val('fNome'));
    if (CFG.area === 'ragazzi') {
      riga(s1, 'Età', val('fEta') + ' anni');
      riga(s1, 'In acqua', etichettaNuoto(val('fNuoto')));
      riga(s1, 'Genitore', val('fGenitore'));
    } else {
      riga(s1, 'Esperienza', val('fLivello') || '—');
    }
    riga(s1, 'Telefono', val('fTel'));
    if ($('fApp')) riga(s1, 'Appartamento', val('fApp') || '—');

    if (CFG.area === 'ragazzi') {
      var s2 = sez('Le gare');
      riga(s2, 'Giochi a squadre', 'tutti quelli in programma');
      var g = gareScelte();
      riga(s2, 'Gare individuali', g.length ? g.map(function (x) { return x.nome; }).join(', ') : 'nessuna');
      if (val('fAmico')) riga(s2, 'Vorrebbe stare con', val('fAmico'));
      if (val('fNote')) riga(s2, 'Note', val('fNote'));
    } else {
      var s3 = sez('I tornei');
      torneiScelti().forEach(function (t) {
        riga(s3, V(t.emoji, '') + ' ' + t.nome, 'blocco ' + V(t.blocco, '') + ' · ' + V(t.orario, ''));
      });
      riga(s3, 'Come giochi', $('cCoppia').checked ? ('in coppia con ' + val('fCompagno')) : 'da solo: mi abbinate voi');
      if (val('fNote')) riga(s3, 'Note', val('fNote'));
    }

    if (q.attiva === true) {
      var s4 = sez('Quota');
      riga(s4, V(q.etichetta, 'Quota'), CA.eur(q.importo) + ' a persona');
      riga(s4, 'Quando si paga', 'il giorno stesso, all\'accoglienza');
    }
  }

  function etichettaNuoto(v) {
    if (v === 'bene') return 'nuota bene';
    if (v === 'media') return 'se la cava';
    if (v === 'poco') return 'nuota poco';
    return '—';
  }

  /* ============================== conferma ============================== */
  function codice() {
    var base = (val('fNome') + val('fTel') + Date.now()).toUpperCase();
    var h = 0;
    for (var i = 0; i < base.length; i++) { h = ((h << 5) - h + base.charCodeAt(i)) | 0; }
    var lettere = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    var n = Math.abs(h);
    for (var k = 0; k < 4; k++) { out += lettere[n % lettere.length]; n = Math.floor(n / lettere.length) + k * 7 + 13; }
    var pre = V(V(DATI.iscrizione, {}).prefissoCodice, 'CA');
    var sig = CFG.area === 'ragazzi' ? 'RG' : (CFG.gruppo === 'burraco' ? 'BU' : 'IT');
    return pre + '-' + sig + '-' + out;
  }

  function conferma() {
    if (!$('fConsenso').checked) {
      var e = $('e_fConsenso');
      e.textContent = 'Spunta la casella per confermare l\'iscrizione.';
      e.className = 'errore visibile';
      return;
    }
    $('e_fConsenso').className = 'errore';

    var ev = V(DATI.evento, {});
    FATTA = {
      codice: codice(),
      area: CFG.area,
      gruppo: CFG.gruppo || '',
      sezione: GRUPPO ? V(GRUPPO.nome, '') : V(areaDati().nome, ''),
      nome: val('fNome'),
      telefono: val('fTel'),
      appartamento: $('fApp') ? val('fApp') : '',
      note: val('fNote'),
      dataEvento: V(ev.data, ''),
      creatoIl: new Date().toISOString()
    };

    if (CFG.area === 'ragazzi') {
      FATTA.eta = Number(val('fEta')) || 0;
      FATTA.nuoto = val('fNuoto');
      FATTA.sesso = val('fSesso');
      FATTA.genitore = val('fGenitore');
      FATTA.amico = val('fAmico');
      FATTA.gare = gareScelte().map(function (g) { return { id: g.id, nome: g.nome }; });
    } else {
      FATTA.livello = val('fLivello');
      FATTA.tornei = torneiScelti().map(function (t) {
        return { id: t.id, nome: t.nome, blocco: t.blocco };
      });
      FATTA.inCoppia = !!$('cCoppia').checked;
      FATTA.compagno = FATTA.inCoppia ? val('fCompagno') : '';
    }

    CA.memScrivi(CHIAVE, JSON.stringify(FATTA));
    mostraPass();
    /* parte SUBITO: se chiude la pagina, l'iscrizione è comunque arrivata */
    registra(FATTA);
  }

  /* ---------------- invio: cloud + Telegram + contatore ----------------
     Sono due strade indipendenti e vanno tenute distinte:
       · il registro nel database è quello che conta (l'admin legge da lì);
       · il messaggio Telegram è l'avviso immediato all'organizzatore.
     Se passa solo Telegram l'iscrizione NON è persa, ma non è nemmeno
     completa: si dice com'è andata e si riprova da soli alla prossima
     apertura della pagina. Dire «tutto a posto» quando il registro non ha
     ricevuto niente sarebbe il modo migliore per perdere un iscritto.   */
  function registra(p) {
    if (!p) return Promise.resolve(false);
    if (p.salvataCloud) { avviso('ok'); return Promise.resolve(true); }
    avviso('corso');

    return contatore(p)
      .then(function () {
        return Promise.all([telegram(p), cloud(p)]);
      })
      .then(function (esiti) {
        var tg = esiti[0], db = esiti[1];
        avviso(db ? 'ok' : (tg ? 'parziale' : 'ko'));
        return db || tg;
      })
      .catch(function () { avviso('ko'); return false; });
  }

  function contatore(p) {
    if (p.contato || !window.FB || !FB.attivo()) return Promise.resolve(true);
    var lavori = [FB.incrementaContatore(p.area, 1)];
    if (p.gruppo) lavori.push(FB.incrementaContatore(p.gruppo, 1));
    return Promise.all(lavori).then(function (esiti) {
      /* solo se è andata davvero: altrimenti si riprova al prossimo giro */
      if (esiti.every(Boolean)) {
        p.contato = true;
        CA.memScrivi(CHIAVE, JSON.stringify(p));
      }
      return CA.leggiContatori();
    }).catch(function () { return true; });
  }

  function cloud(p) {
    if (p.salvataCloud) return Promise.resolve(true);
    if (!window.FB || !FB.attivo()) return Promise.resolve(false);
    return FB.creaIscrizione({
      nome: p.nome,
      area: p.area,
      gruppo: p.gruppo || '',
      codice: p.codice,
      stato: 'attiva',
      creatoIl: p.creatoIl,
      json: JSON.stringify(p)
    }).then(function () {
      p.salvataCloud = true;
      CA.memScrivi(CHIAVE, JSON.stringify(p));
      return true;
    }).catch(function () { return false; });
  }

  function telegram(p) {
    if (p.inviata) return Promise.resolve(true);
    var n = V(DATI.notifiche, {});
    var token = String(V(n.telegramBotToken, '')).trim();
    var chat = String(V(n.telegramChatId, '')).trim();
    if (!token || !chat) return Promise.resolve(false);

    return fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: messaggio(p), disable_web_page_preview: true })
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          p.inviata = true;
          CA.memScrivi(CHIAVE, JSON.stringify(p));
          return true;
        }
        return false;
      }).catch(function () { return false; });
  }

  function messaggio(p) {
    var r = [];
    r.push('🏊 CERTAMEN AQUATICUM — nuova iscrizione');
    r.push('');
    r.push('Sezione: ' + p.sezione);
    r.push('Codice: ' + p.codice);
    r.push('Nome: ' + p.nome);
    if (p.area === 'ragazzi') {
      r.push('Età: ' + p.eta + ' anni');
      r.push('In acqua: ' + etichettaNuoto(p.nuoto));
      if (p.sesso) r.push('Categoria: ' + (p.sesso === 'f' ? 'ragazza' : 'ragazzo'));
      r.push('Genitore: ' + p.genitore);
      if (p.amico) r.push('Vorrebbe stare con: ' + p.amico);
      r.push('Gare individuali: ' + (p.gare.length ? p.gare.map(function (g) { return g.nome; }).join(', ') : 'nessuna'));
    } else {
      r.push('Esperienza: ' + p.livello);
      r.push('Tornei: ' + p.tornei.map(function (t) { return t.nome + ' (bl. ' + t.blocco + ')'; }).join(', '));
      r.push('Coppia: ' + (p.inCoppia ? p.compagno : 'da abbinare'));
    }
    r.push('Telefono: ' + p.telefono);
    if (p.appartamento) r.push('Appartamento: ' + p.appartamento);
    if (p.note) r.push('Note: ' + p.note);
    var c = CA.contatori();
    if (c) {
      r.push('');
      r.push('Totali: ' + V(c.ragazzi, 0) + ' ragazzi · ' + V(c.adulti, 0) + ' adulti');
    }
    return r.join('\n');
  }

  function avviso(stato) {
    var el = $('invioAvviso');
    if (!el) return;
    el.style.display = '';
    /* «parziale» usa i colori dell'attesa: è andata, ma non del tutto */
    el.className = 'avviso-invio ' + (stato === 'parziale' ? 'corso' : stato);
    if (stato === 'corso') {
      testo('invioTitolo', '⏳ Sto inviando l\'iscrizione…');
      testo('invioSotto', 'Un secondo, non chiudere la pagina.');
    } else if (stato === 'ok') {
      testo('invioTitolo', '✅ Iscrizione inviata: puoi chiudere la pagina');
      testo('invioSotto', 'Non devi fare altro. Conserva il pass qui sotto e mostralo all\'accoglienza.');
    } else if (stato === 'parziale') {
      testo('invioTitolo', '✅ Gli organizzatori hanno ricevuto la tua iscrizione');
      testo('invioSotto', 'Il registro del sito però non l\'ha ancora presa: ci riprova da solo. ' +
        'Tieni il pass qui sotto e mostralo all\'accoglienza, è sufficiente.');
    } else {
      testo('invioTitolo', '⚠️ Non sono riuscito a inviarla');
      testo('invioSotto', 'Fai uno screenshot del pass e mandalo agli organizzatori, oppure riapri questa pagina più tardi: riproverà da sola.');
    }
  }

  /* ================================ pass =============================== */
  function mostraPass() {
    var p = FATTA;
    if (!p) return;
    var ev = V(DATI.evento, {}), res = V(DATI.residence, {}), t = V(DATI.tema, {});
    var q = V(DATI.quota, {});

    $('pannelloPassi').style.display = 'none';
    $('areaPass').style.display = '';
    var gf = $('giaFatto');
    if (gf) gf.className = 'gia-fatto';

    testo('passTitolo', V(t.titolo, 'Certamen Aquaticum'));
    testo('passSezione', p.sezione);
    testo('passCodice', p.codice);
    testo('passNome', p.nome);
    testo('passQuando', CA.dataIt(ev.data, true) + ' · ' + V(ev.orario, '') + '–' + V(ev.orarioFine, ''));
    testo('passDove', V(ev.luogo, '') + (res.localita ? ' — ' + res.localita : ''));

    var det = $('passDettagli');
    det.textContent = '';
    function riga(a, b) {
      var r = crea('div', 'riga');
      r.appendChild(crea('span', null, a));
      r.appendChild(crea('span', 'd', b));
      det.appendChild(r);
    }
    if (p.area === 'ragazzi') {
      riga('Età', p.eta + ' anni');
      riga('In acqua', etichettaNuoto(p.nuoto));
      riga('Gare individuali', p.gare.length ? p.gare.map(function (g) { return g.nome; }).join(', ') : 'nessuna');
      riga('Genitore', p.genitore + ' · ' + p.telefono);
    } else {
      p.tornei.forEach(function (x) { riga(x.nome, 'blocco ' + x.blocco); });
      riga('Coppia', p.inCoppia ? p.compagno : 'da abbinare all\'accoglienza');
      riga('Telefono', p.telefono);
    }
    if (p.appartamento) riga('Appartamento', p.appartamento);
    if (q.attiva === true) riga(V(q.etichetta, 'Quota'), CA.eur(q.importo) + ' a persona');

    disegnaQr(p);
  }

  function testoQr(p) {
    var ev = V(DATI.evento, {});
    var url = V(V(DATI.condivisione, {}).urlSito, '');
    return 'CERTAMEN AQUATICUM\n' +
      'Pass: ' + p.codice + '\n' +
      'Nome: ' + p.nome + '\n' +
      'Sezione: ' + p.sezione + '\n' +
      CA.dataIt(ev.data, true) + ' ' + V(ev.orario, '') + '\n' +
      (url || '');
  }

  function disegnaQr(p) {
    var c = $('passQr');
    if (!c || !window.QR) return;
    try {
      QR.draw(c, testoQr(p), { size: 260, margin: 3, ecc: 'M', dark: '#0a2540', light: '#ffffff' });
    } catch (e) {
      c.style.display = 'none';
    }
  }

  /* --------------------- iscrizione già fatta / recupero ---------------- */
  function controllaIscrizioneSalvata() {
    var grezzo = CA.memLeggi(CHIAVE);
    if (!grezzo) return;
    var p = null;
    try { p = JSON.parse(grezzo); } catch (e) { CA.memCancella(CHIAVE); return; }
    if (!p || !p.codice) { CA.memCancella(CHIAVE); return; }

    /* se è di un'altra edizione non vale più */
    var data = V(V(DATI.evento, {}).data, '');
    if (data && p.dataEvento && p.dataEvento !== data) { CA.memCancella(CHIAVE); return; }

    FATTA = p;
    testo('giaCodice', p.codice);
    testo('giaNome', p.nome);
    var gf = $('giaFatto');
    if (gf) gf.className = 'gia-fatto visibile';

    /* Recupero automatico: finché il registro non l'ha presa si riprova, anche
       se il messaggio Telegram era già partito. Prima bastava uno dei due e
       un'iscrizione poteva restare fuori dal registro per sempre. */
    if (!p.salvataCloud) {
      setTimeout(function () {
        registra(p).then(function (ok) {
          if (ok && p.salvataCloud) {
            CA.toast('✅ La tua iscrizione ' + p.codice + ' è ora registrata.', 8000);
          }
        });
      }, 1200);
    }
  }

  /* --------------------------- pulsanti del pass ------------------------ */
  window.addEventListener('DOMContentLoaded', function () {
    var st = $('btnStampa');
    if (st) st.addEventListener('click', function () { window.print(); });
    var nu = $('btnNuova');
    if (nu) nu.addEventListener('click', function () {
      if (!confirm('Vuoi iscrivere un\'altra persona? Il pass appena creato resta valido.')) return;
      CA.memCancella(CHIAVE);
      location.reload();
    });
    var ri = $('btnRivedi');
    if (ri) ri.addEventListener('click', function () {
      if (!FATTA) return;
      mostraPass();
      avviso(FATTA.salvataCloud ? 'ok' : (FATTA.inviata ? 'parziale' : 'ko'));
    });
  });
})();
