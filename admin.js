/* =========================================================================
   admin.js — l'area organizzatori del Certamen Aquaticum.

   Tutto quello che conta vive nel database (Firestore), come per le
   prenotazioni della festa:
     · iscrizioni            -> collezione "iscrizioni"
     · squadre e punteggi    -> documento "stato_certamen/gara"
     · classifiche pubbliche -> documento "pubblico_certamen/classifica"
     · contatori pubblici    -> documento "pubblico_certamen/contatore"
   Nel browser non resta niente di importante: si può lavorare dal telefono
   a bordo piscina e ritrovare tutto sul computer.
   ========================================================================= */
(function () {
  'use strict';

  var $ = CA.$, V = CA.V, crea = CA.crea, testo = CA.testo;
  var PASSWORD = 'holiday2026';

  var DATI = {};            /* contenuti.json (modificabile) */
  var ISCR = [];            /* le iscrizioni lette dal database */
  var STATO = statoVuoto(); /* squadre, punteggi, tornei */
  var SESS = null;          /* sessione Firebase */
  var CARICATO = false;     /* ho letto davvero i contenuti? */
  var STOSCRIVENDO = false; /* sospende l'aggiornamento automatico */
  var FILTRO = 'tutti', FILTRO_PUNTI = 'ragazzi';
  var TORNEO_APERTO = null;
  var SCELTA = null;        /* pedina selezionata col dito */
  var sqToccato = false;    /* ho già scelto io quante squadre fare? */

  var COLORI_SQ = ['#0b7fd4', '#ff6b6b', '#ffc233', '#14c4b4', '#7c4dff', '#1f8a5b', '#e8734a', '#8d5ac2'];
  var NOMI_SQ = ['Delfini', 'Squali', 'Tartarughe', 'Meduse', 'Orche', 'Piovre', 'Granchi', 'Stelle marine'];

  function statoVuoto() {
    return { squadre: [], configSquadre: {}, risultati: {}, titoli: [], tornei: {}, bonus: {} };
  }

  /* ========================= ACCESSO ALLA PAGINA ======================== */
  $('btnEntra').addEventListener('click', entra);
  $('pwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') entra(); });

  function entra() {
    if ($('pwd').value !== PASSWORD) {
      var e = $('e_pwd');
      e.textContent = 'Password sbagliata.';
      e.className = 'errore visibile';
      return;
    }
    CA.memScrivi('ca_admin_ok', '1');
    apri();
  }
  function apri() {
    $('cancello').style.display = 'none';
    $('pannello').style.display = '';
    avvia();
  }
  if (CA.memLeggi('ca_admin_ok') === '1') { apri(); }

  /* ============================== AVVIO ================================ */
  function avvia() {
    CA.carica().then(function (d) {
      DATI = d;
      CARICATO = true;
      riempiContenuti();
      collega();
      controllaBozza();
      var s = sessLeggi();
      if (s) { SESS = s; dopoLogin(); } else { mostraLogin(); }
      disegnaTutto();
    }).catch(function (e) {
      CA.toast('⚠️ Non riesco a leggere contenuti.json: ' + e.message, 9000);
    });
  }

  function collega() {
    /* linguette */
    var b = document.querySelectorAll('[data-vista]');
    for (var i = 0; i < b.length; i++) {
      b[i].addEventListener('click', function () {
        for (var j = 0; j < b.length; j++) b[j].classList.remove('attiva');
        this.classList.add('attiva');
        var v = this.getAttribute('data-vista');
        var viste = document.querySelectorAll('.vista');
        for (var k = 0; k < viste.length; k++) viste[k].classList.remove('attiva');
        $('v-' + v).classList.add('attiva');
        window.scrollTo(0, 0);
        if (v === 'squadre') disegnaSquadre();
        if (v === 'tornei') disegnaTornei();
        if (v === 'punteggi') disegnaPunteggi();
      });
    }

    $('btnDiagnosi').addEventListener('click', diagnosi);
    $('btnCopiaRegole').addEventListener('click', function () {
      var t = $('regoleFirestore');
      t.select(); t.setSelectionRange(0, 99999);
      var fatto = false;
      try { fatto = document.execCommand('copy'); } catch (e) { }
      if (!fatto && navigator.clipboard) {
        navigator.clipboard.writeText(t.value).then(function () { CA.toast('📋 Regole copiate.', 4000); });
        return;
      }
      CA.toast(fatto ? '📋 Regole copiate: incollale nella console di Firebase.' : '⚠️ Copiale a mano dal riquadro.', 6000);
    });

    $('btnLogin').addEventListener('click', login);
    $('fbPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('btnEsci').addEventListener('click', esci);
    $('btnRicarica').addEventListener('click', function () { ricarica(true); });

    /* filtri del registro */
    var fi = document.querySelectorAll('[data-fi]');
    for (var n = 0; n < fi.length; n++) {
      fi[n].addEventListener('click', function () {
        for (var m = 0; m < fi.length; m++) fi[m].className = 'btn btn-chiaro btn-piccolo';
        this.className = 'btn btn-p btn-piccolo';
        FILTRO = this.getAttribute('data-fi');
        disegnaIscritti();
      });
    }
    $('cerca').addEventListener('input', disegnaIscritti);
    $('cerca').addEventListener('focus', function () { STOSCRIVENDO = true; });
    $('cerca').addEventListener('blur', function () { STOSCRIVENDO = false; });
    $('btnAggiungi').addEventListener('click', apriFormManuale);
    $('btnImportaTg').addEventListener('click', apriImportaTelegram);
    $('btnLeggiTg').addEventListener('click', leggiTestoTelegram);
    $('btnChiudiTg').addEventListener('click', function () {
      $('importaTg').style.display = 'none';
      $('anteprimaTg').textContent = '';
    });
    $('btnCsv').addEventListener('click', esportaCsv);
    $('btnSincronizza').addEventListener('click', sincronizzaContatori);

    /* squadre */
    ['sqNumero', 'sqPer'].forEach(function (id) {
      $(id).addEventListener('input', function () { sqToccato = true; });
    });
    $('btnGeneraSquadre').addEventListener('click', generaSquadre);
    $('btnSvuotaSquadre').addEventListener('click', function () {
      if (!confirm('Sicuro? Cancello le squadre e ricomincio da capo.')) return;
      STATO.squadre = [];
      salvaStato();
      disegnaSquadre();
    });
    $('btnSalvaSquadre').addEventListener('click', function () {
      salvaStato(true);
    });

    /* punteggi */
    var fp = document.querySelectorAll('[data-fp]');
    for (var p = 0; p < fp.length; p++) {
      fp[p].addEventListener('click', function () {
        for (var q = 0; q < fp.length; q++) fp[q].className = 'btn btn-chiaro btn-piccolo';
        this.className = 'btn btn-p btn-piccolo';
        FILTRO_PUNTI = this.getAttribute('data-fp');
        $('puntiRagazzi').style.display = FILTRO_PUNTI === 'ragazzi' ? '' : 'none';
        $('puntiCarte').style.display = FILTRO_PUNTI === 'carte' ? '' : 'none';
        $('puntiTitoli').style.display = FILTRO_PUNTI === 'titoli' ? '' : 'none';
      });
    }

    /* pubblicazione */
    $('btnPubblicaClass').addEventListener('click', pubblicaClassifiche);
    var auto = $('autoPubblica');
    auto.checked = CA.memLeggi('ca_autopubblica') !== '0';
    auto.addEventListener('change', function () {
      CA.memScrivi('ca_autopubblica', auto.checked ? '1' : '0');
      if (auto.checked) { aggiornaBachecaSePuoi(); CA.toast('🔄 La bacheca si aggiornerà da sola.', 5000); }
    });
    $('btnPubblicaContenuti').addEventListener('click', pubblicaContenuti);
    $('btnScarica').addEventListener('click', scaricaContenuti);
    $('btnSalvaGh').addEventListener('click', salvaGh);
    $('btnVaiPubblica').addEventListener('click', function () {
      document.querySelector('[data-vista="pubblica"]').click();
    });
    $('btnRiprendiBozza').addEventListener('click', riprendiBozza);
    $('btnButtaBozza').addEventListener('click', function () {
      if (!confirm('Butto via le modifiche non pubblicate?')) return;
      buttaBozza();
      CA.toast('Bozza eliminata.', 4000);
    });
    /* ogni modifica ai contenuti finisce subito nella bozza. Anche il token
       e la chat di Telegram sono contenuti, benché stiano in un'altra scheda. */
    $('v-contenuti').addEventListener('change', salvaBozzaFraPoco);
    $('sec-telegram').addEventListener('change', salvaBozzaFraPoco);

    /* avvisi su Telegram */
    $('btnProvaTg').addEventListener('click', provaTelegram);
    $('btnChiId').addEventListener('click', chiId);

    /* invito da far girare */
    $('msgInvito').value = CA.messaggioInvito();
    $('admWa').href = CA.linkWhatsApp();
    $('admTg').href = CA.linkTelegram();
    $('btnCopiaMsg').addEventListener('click', function () {
      var t = $('msgInvito');
      t.select();
      t.setSelectionRange(0, 99999);
      var fatto = false;
      try { fatto = document.execCommand('copy'); } catch (e) { }
      if (!fatto && navigator.clipboard) {
        navigator.clipboard.writeText(t.value).then(function () {
          CA.toast('📋 Messaggio copiato.', 4000);
        });
        return;
      }
      CA.toast(fatto ? '📋 Messaggio copiato: incollalo nel gruppo.' : '⚠️ Copialo a mano dal riquadro.', 5000);
    });

    caricaGh();

    /* stampe */
    var st = document.querySelectorAll('[data-stampa]');
    for (var s = 0; s < st.length; s++) {
      st[s].addEventListener('click', function () { stampa(this.getAttribute('data-stampa')); });
    }
    $('btnChiudiFoglio').addEventListener('click', chiudiFoglio);
    $('btnStampaFoglio').addEventListener('click', function () {
      document.body.classList.add('stampa-foglio');
      window.print();
      setTimeout(function () { document.body.classList.remove('stampa-foglio'); }, 600);
    });

    /* mentre scrivo nei campi, l'aggiornamento automatico si ferma */
    document.addEventListener('focusin', function (e) {
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') STOSCRIVENDO = true;
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () {
        var a = document.activeElement;
        var t = a ? a.tagName : '';
        STOSCRIVENDO = (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT');
      }, 60);
    });

    /* aggiornamento automatico del registro: ogni minuto, mai mentre scrivo */
    setInterval(function () {
      if (document.hidden || STOSCRIVENDO || !SESS) return;
      ricarica(false);
    }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && SESS && !STOSCRIVENDO) ricarica(false);
    });
  }

  /* ============================== LOGIN ================================ */
  function sessSalva() { CA.memScrivi('ca_fbsess', JSON.stringify(SESS)); }
  function sessLeggi() {
    try {
      var s = JSON.parse(CA.memLeggi('ca_fbsess') || 'null');
      return (s && s.refreshToken) ? s : null;
    } catch (e) { return null; }
  }

  function login() {
    var email = $('fbEmail').value.trim(), pwd = $('fbPwd').value;
    if (!email || !pwd) { erroreLogin('Scrivi email e password.'); return; }
    var b = $('btnLogin');
    b.disabled = true; b.textContent = '⏳ Entro…';
    FB.signIn(email, pwd).then(function (s) {
      SESS = { idToken: s.idToken, refreshToken: s.refreshToken, scadenza: s.scadenza, email: s.email };
      sessSalva();
      erroreLogin('');
      dopoLogin();
    }).catch(function (e) {
      erroreLogin(messaggioFirebase(e.message));
    }).then(function () {
      b.disabled = false; b.textContent = 'Entra nel database';
    });
  }
  function erroreLogin(m) {
    var e = $('e_login');
    e.textContent = m || '';
    e.className = 'errore' + (m ? ' visibile' : '');
  }
  function messaggioFirebase(m) {
    if (/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(m)) return 'Email o password sbagliate.';
    if (/TOO_MANY_ATTEMPTS/.test(m)) return 'Troppi tentativi: aspetta qualche minuto.';
    return 'Non riesco a entrare: ' + m;
  }
  function esci() {
    SESS = null;
    CA.memCancella('ca_fbsess');
    mostraLogin();
    ISCR = [];
    disegnaTutto();
  }
  function mostraLogin() {
    $('boxLogin').style.display = '';
    $('boxConnesso').style.display = 'none';
    testo('statoCloud', 'non collegato al database');
  }
  function dopoLogin() {
    $('boxLogin').style.display = 'none';
    $('boxConnesso').style.display = '';
    testo('chiSono', V(SESS.email, ''));
    testo('statoCloud', '✅ collegato');
    ricarica(false);
  }

  /* il token dura un'ora: si rinnova da solo */
  function token() {
    if (!SESS) return Promise.reject(new Error('non collegato'));
    if (SESS.idToken && SESS.scadenza && Date.now() < SESS.scadenza - 60000) {
      return Promise.resolve(SESS.idToken);
    }
    return FB.refresh(SESS.refreshToken).then(function (s) {
      SESS.idToken = s.idToken;
      SESS.refreshToken = s.refreshToken || SESS.refreshToken;
      SESS.scadenza = s.scadenza;
      sessSalva();
      return SESS.idToken;
    });
  }

  /* ====================== LETTURA DAL DATABASE ========================= */
  function ricarica(conAvviso) {
    if (!SESS) { if (conAvviso) CA.toast('Prima entra nel database.', 5000); return; }
    return token().then(function (t) {
      return Promise.all([FB.elenco(t), FB.leggiStato(t)]);
    }).then(function (r) {
      ISCR = (r[0] || []).map(leggiIscrizione).filter(Boolean);
      ISCR.sort(function (a, b) { return String(a.creatoIl) < String(b.creatoIl) ? 1 : -1; });
      var s = r[1];
      if (s) {
        STATO = {
          squadre: V(s.squadre, []), configSquadre: V(s.configSquadre, {}),
          risultati: V(s.risultati, {}), titoli: V(s.titoli, []),
          tornei: V(s.tornei, {}), bonus: V(s.bonus, {})
        };
      }
      var d = new Date();
      testo('quandoAgg', '· letto alle ' + due(d.getHours()) + ':' + due(d.getMinutes()));
      disegnaTutto();
      if (conAvviso) CA.toast('✅ Registro aggiornato: ' + ISCR.length + ' iscrizioni.', 4000);
    }).catch(function (e) {
      if (permessiNegati(e)) {
        /* è il caso più frequente e il messaggio di Firestore non aiuta:
           lo traduco e porto l'utente dove si risolve */
        testo('statoCloud', '⛔ database bloccato');
        CA.toast('⛔ Il database non ti lascia entrare: mancano le regole di sicurezza. Te le preparo qui sotto.', 10000);
        var s = $('sec-diagnosi');
        if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
        diagnosi();
        return;
      }
      if (conAvviso) CA.toast('⚠️ ' + e.message, 8000);
    });
  }
  function due(n) { return (n < 10 ? '0' : '') + n; }

  function leggiIscrizione(doc) {
    var o = {};
    try { o = JSON.parse(doc.json || '{}'); } catch (e) { o = {}; }
    o._id = doc._id;
    o.stato = V(doc.stato, 'attiva');
    o.nome = V(o.nome, doc.nome);
    o.area = V(o.area, doc.area);
    o.gruppo = V(o.gruppo, doc.gruppo);
    o.codice = V(o.codice, doc.codice);
    o.creatoIl = V(o.creatoIl, doc.creatoIl);
    if (!o.nome) return null;
    return o;
  }

  function attive(filtro) {
    return ISCR.filter(function (p) {
      if (p.stato === 'cestino') return false;
      if (!filtro) return true;
      if (filtro === 'ragazzi') return p.area === 'ragazzi';
      if (filtro === 'adulti') return p.area === 'adulti';
      return p.gruppo === filtro;
    });
  }

  /* =========================== SALVATAGGIO ============================= */
  var timerSalva = null, salvataggioInSospeso = false;
  function salvaStato(conAvviso) {
    if (!SESS) { if (conAvviso) CA.toast('⚠️ Non sei collegato: non posso salvare.', 7000); return; }
    salvataggioInSospeso = true;
    if (timerSalva) clearTimeout(timerSalva);
    timerSalva = setTimeout(function () { salvaAdesso(conAvviso); }, conAvviso ? 0 : 600);
  }
  function salvaAdesso(conAvviso) {
    if (!SESS) return;
    salvataggioInSospeso = false;
    token().then(function (t) { return FB.scriviStato(t, STATO); })
      .then(function () {
        testo('statoCloud', '✅ salvato nel database');
        if (conAvviso) CA.toast('💾 Salvato nel database.', 4000);
        /* la bacheca pubblica segue da sola: chi guarda le classifiche dal
           telefono vede il punteggio nuovo senza che io prema niente */
        aggiornaBachecaSePuoi();
      })
      .catch(function (e) {
        salvataggioInSospeso = true;
        if (permessiNegati(e)) {
          testo('statoCloud', '⛔ database bloccato');
          CA.toast('⛔ Non riesco a salvare: mancano le regole di sicurezza del database. Vai su 📊 Cruscotto → Stato del database.', 10000);
        } else {
          CA.toast('⚠️ Non ho salvato: ' + e.message, 8000);
        }
      });
  }
  /* se chiudo o metto via il telefono mentre il salvataggio è ancora in coda,
     lo mando subito: mezzo secondo di ritardo non deve costare un punteggio */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && salvataggioInSospeso) {
      if (timerSalva) clearTimeout(timerSalva);
      salvaAdesso(false);
    }
  });

  /* ============================== DISEGNO ============================== */
  function disegnaTutto() {
    disegnaCruscotto();
    disegnaIscritti();
    disegnaSquadre();
    disegnaTornei();
    disegnaPunteggi();
  }

  /* ----------------------------- cruscotto ---------------------------- */
  function disegnaCruscotto() {
    var el = $('numeroni');
    el.textContent = '';
    var rag = attive('ragazzi'), ita = attive('italiana'), bur = attive('burraco');
    var cest = ISCR.filter(function (p) { return p.stato === 'cestino'; });
    var q = V(DATI.quota, {});

    function n(cls, numero, eti) {
      var d = crea('div', 'numerone ' + cls);
      d.appendChild(crea('b', null, String(numero)));
      d.appendChild(crea('span', null, eti));
      el.appendChild(d);
    }
    n('verde', rag.length, 'ragazzi in acqua');
    n('', ita.length, 'giochi all\'italiana');
    n('', bur.length, 'burraco');
    n('giallo', STATO.squadre.length, 'squadre formate');
    if (q.attiva === true) {
      n('giallo', CA.eur((rag.length + ita.length + bur.length) * (Number(q.importo) || 0)), 'quote da incassare');
    }
    if (cest.length) n('grigio', cest.length, 'nel cestino');

    testo('notaCruscotto', SESS
      ? ('Ultima lettura dal database: ' + ISCR.length + ' iscrizioni in tutto.')
      : 'Entra nel database qui sopra per vedere i numeri veri.');

    /* cosa manca */
    var lista = $('checklist');
    lista.textContent = '';
    var voci = [];
    if (!SESS) voci.push('Collegati al database per vedere le iscrizioni.');
    if (rag.length && !STATO.squadre.length) voci.push('Forma le squadre dei ragazzi (scheda 🚩 Squadre).');
    var senzaTab = [];
    torneiAttivi().forEach(function (t) {
      var quanti = iscrittiTorneo(t.id).length;
      if (quanti >= 4 && !(STATO.tornei[t.id] && (STATO.tornei[t.id].incontri || []).length)) senzaTab.push(t.nome);
    });
    if (senzaTab.length) voci.push('Genera il tabellone di: ' + senzaTab.join(', ') + ' (scheda 🃏 Tornei).');
    var nonAss = daAssegnare().length;
    if (STATO.squadre.length && nonAss) voci.push(nonAss + ' ragazzi non sono ancora in nessuna squadra.');
    var senzaCap = STATO.squadre.filter(function (s) { return !s.capitano; });
    if (senzaCap.length) {
      voci.push('Manca il capitano a: ' + senzaCap.map(function (s) { return s.nome; }).join(', ') +
        ' (tocca il ○ accanto a un nome).');
    }
    var senzaMotto = STATO.squadre.filter(function (s) { return !s.motto; });
    if (STATO.squadre.length && senzaMotto.length === STATO.squadre.length) {
      voci.push('Nessuna squadra ha ancora il suo grido di battaglia: fattelo dire dai ragazzi.');
    }
    if (!voci.length) voci.push('Tutto a posto: si può giocare. 🎉');
    voci.forEach(function (v) { lista.appendChild(crea('li', null, v)); });
  }

  /* ---------------------------- iscrizioni ---------------------------- */
  function disegnaIscritti() {
    var el = $('elencoIscritti');
    el.textContent = '';
    var cerca = $('cerca').value.trim().toLowerCase();

    var lista = ISCR.filter(function (p) {
      if (FILTRO === 'cestino') return p.stato === 'cestino';
      if (p.stato === 'cestino') return false;
      if (FILTRO === 'ragazzi') return p.area === 'ragazzi';
      if (FILTRO === 'italiana' || FILTRO === 'burraco') return p.gruppo === FILTRO;
      return true;
    }).filter(function (p) {
      if (!cerca) return true;
      return (String(p.nome) + ' ' + String(p.codice) + ' ' + String(p.appartamento || '') + ' ' +
        String(p.telefono || '')).toLowerCase().indexOf(cerca) >= 0;
    });

    if (!lista.length) {
      el.appendChild(crea('p', 'aiuto', SESS ? 'Nessuna iscrizione in questa selezione.' : 'Entra nel database per vedere le iscrizioni.'));
      return;
    }

    var conta = crea('p', 'aiuto', lista.length + (lista.length === 1 ? ' iscrizione' : ' iscrizioni'));
    el.appendChild(conta);

    lista.forEach(function (p) {
      var r = crea('div', 'riga-iscr' + (p.stato === 'cestino' ? ' cestinata' : ''));
      var c = crea('div', 'cnt');

      var t = crea('div');
      t.appendChild(crea('span', 'tag ' + tagClasse(p), tagTesto(p)));
      var nb = crea('b', null, p.nome);
      nb.style.display = 'inline';
      t.appendChild(nb);
      c.appendChild(t);

      c.appendChild(crea('small', null, dettaglio(p)));
      c.appendChild(crea('small', null, '🎟️ ' + V(p.codice, '—') + ' · ☎️ ' + V(p.telefono, '—') +
        (p.appartamento ? ' · 🏠 ' + p.appartamento : '')));
      if (p.note) c.appendChild(crea('small', null, '📝 ' + p.note));
      r.appendChild(c);

      var az = crea('div', 'azioni-r');
      if (p.stato === 'cestino') {
        az.appendChild(bottone('↩️ Ripristina', 'verde', function () { cambiaStato(p, 'attiva'); }));
        az.appendChild(bottone('🗑️ Elimina', 'rosso', function () { eliminaDavvero(p); }));
      } else {
        az.appendChild(bottone('✏️ Modifica', '', function () { apriModifica(p); }));
        az.appendChild(bottone('🗑️ Cestino', 'rosso', function () { cambiaStato(p, 'cestino'); }));
      }
      r.appendChild(az);
      el.appendChild(r);
    });
  }

  function tagClasse(p) {
    if (p.area === 'ragazzi') return 'rag';
    return p.gruppo === 'burraco' ? 'bur' : 'ita';
  }
  function tagTesto(p) {
    if (p.area === 'ragazzi') return '🤽 ragazzi';
    return p.gruppo === 'burraco' ? '🃟 burraco' : '🂡 italiana';
  }
  function dettaglio(p) {
    if (p.area === 'ragazzi') {
      var g = V(p.gare, []).map(function (x) { return x.nome; }).join(', ');
      return p.eta + ' anni · ' + etichettaNuoto(p.nuoto) +
        (p.genitore ? ' · genitore: ' + p.genitore : '') +
        (p.amico ? ' · con: ' + p.amico : '') +
        (g ? ' · gare: ' + g : '');
    }
    var tt = V(p.tornei, []).map(function (x) { return x.nome; }).join(', ');
    return tt + ' · ' + (p.inCoppia ? ('in coppia con ' + p.compagno) : 'da abbinare') +
      (p.livello ? ' · ' + p.livello : '');
  }
  function etichettaNuoto(v) {
    if (v === 'bene') return 'nuota bene';
    if (v === 'media') return 'se la cava';
    if (v === 'poco') return 'nuota poco';
    return '—';
  }
  function bottone(txt, cls, fn) {
    var b = crea('button', 'bottoncino ' + (cls || ''), txt);
    b.addEventListener('click', fn);
    return b;
  }

  function cambiaStato(p, stato) {
    if (!SESS) { CA.toast('Non sei collegato.', 5000); return; }
    token().then(function (t) { return FB.aggiorna(t, p._id, { stato: stato }); })
      .then(function () {
        p.stato = stato;
        disegnaTutto();
        sincronizzaContatori(true);
        CA.toast(stato === 'cestino' ? '🗑️ Spostata nel cestino.' : '↩️ Ripristinata.', 4000);
      }).catch(function (e) { CA.toast('⚠️ ' + e.message, 8000); });
  }
  function eliminaDavvero(p) {
    if (!confirm('Elimino definitivamente ' + p.nome + '? Non si torna indietro.')) return;
    token().then(function (t) { return FB.elimina(t, p._id); })
      .then(function () {
        ISCR = ISCR.filter(function (x) { return x._id !== p._id; });
        disegnaTutto();
        CA.toast('Eliminata.', 4000);
      }).catch(function (e) { CA.toast('⚠️ ' + e.message, 8000); });
  }

  /* aggiunta e modifica a mano */
  function apriFormManuale(pre) {
    var box = $('formManuale');
    box.style.display = '';
    box.textContent = '';
    var p = (pre && pre.nome) ? pre : null;

    var c = crea('div', 'card');
    c.appendChild(crea('h3', null, p ? ('✏️ Modifica: ' + p.nome) : '➕ Nuova iscrizione a mano'));

    var g = crea('div', 'griglia2');
    function campo(id, eti, valore, tipo) {
      var d = crea('div', 'campo');
      var l = document.createElement('label'); l.setAttribute('for', id); l.textContent = eti;
      d.appendChild(l);
      var i = document.createElement(tipo === 'textarea' ? 'textarea' : 'input');
      if (tipo && tipo !== 'textarea') i.type = tipo;
      i.id = id; i.className = 'mini'; i.value = valore || '';
      d.appendChild(i);
      g.appendChild(d);
      return i;
    }
    var selArea = crea('div', 'campo');
    var la = document.createElement('label'); la.textContent = 'Sezione'; selArea.appendChild(la);
    var sa = document.createElement('select'); sa.id = 'mSezione'; sa.className = 'mini';
    [['ragazzi', '🤽 Giochi in acqua'], ['italiana', '🂡 Giochi all\'italiana'], ['burraco', '🃟 Burraco']]
      .forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
        sa.appendChild(op);
      });
    sa.value = p ? (p.area === 'ragazzi' ? 'ragazzi' : p.gruppo) : 'ragazzi';
    selArea.appendChild(sa);
    g.appendChild(selArea);

    campo('mNome', 'Nome e cognome', p ? p.nome : '');
    campo('mTel', 'Telefono', p ? p.telefono : '');
    campo('mApp', 'Appartamento', p ? p.appartamento : '');
    campo('mEta', 'Età (solo ragazzi)', p ? p.eta : '', 'number');
    var sn = crea('div', 'campo');
    var ln = document.createElement('label'); ln.textContent = 'In acqua (solo ragazzi)'; sn.appendChild(ln);
    var ss = document.createElement('select'); ss.id = 'mNuoto'; ss.className = 'mini';
    [['', '—'], ['bene', 'Nuota bene'], ['media', 'Se la cava'], ['poco', 'Nuota poco']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; ss.appendChild(op);
    });
    ss.value = p ? V(p.nuoto, '') : '';
    sn.appendChild(ss); g.appendChild(sn);
    campo('mCompagno', 'Compagno (solo carte)', p ? p.compagno : '');
    campo('mNote', 'Note', p ? p.note : '');
    c.appendChild(g);

    var az = crea('div', 'azioni');
    az.style.justifyContent = 'flex-start';
    var salva = crea('button', 'btn btn-p', p ? '💾 Salva le modifiche' : '➕ Aggiungi');
    salva.addEventListener('click', function () { salvaManuale(p); });
    var chiudi = crea('button', 'btn btn-chiaro', 'Annulla');
    chiudi.addEventListener('click', function () { box.style.display = 'none'; box.textContent = ''; });
    az.appendChild(salva); az.appendChild(chiudi);
    c.appendChild(az);
    box.appendChild(c);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function apriModifica(p) { apriFormManuale(p); }

  function salvaManuale(vecchia) {
    if (!SESS) { CA.toast('Non sei collegato al database.', 6000); return; }
    var sez = $('mSezione').value;
    var nome = $('mNome').value.trim();
    if (!nome) { CA.toast('Scrivi almeno il nome.', 5000); return; }

    var p = vecchia ? JSON.parse(JSON.stringify(vecchia)) : {};
    p.nome = nome;
    p.area = (sez === 'ragazzi') ? 'ragazzi' : 'adulti';
    p.gruppo = (sez === 'ragazzi') ? '' : sez;
    p.sezione = (sez === 'ragazzi') ? 'Giochi in acqua'
      : (sez === 'burraco' ? 'Torneo di Burraco' : 'Torneo dei giochi all\'italiana');
    p.telefono = $('mTel').value.trim();
    p.appartamento = $('mApp').value.trim();
    p.note = $('mNote').value.trim();
    if (p.area === 'ragazzi') {
      p.eta = Number($('mEta').value) || 0;
      p.nuoto = $('mNuoto').value;
      p.gare = V(p.gare, []);
    } else {
      p.compagno = $('mCompagno').value.trim();
      p.inCoppia = !!p.compagno;
      if (!V(p.tornei, []).length) {
        p.tornei = torneiDelGruppo(p.gruppo).slice(0, 1).map(function (t) {
          return { id: t.id, nome: t.nome, blocco: t.blocco };
        });
      }
    }
    if (!p.codice) p.codice = nuovoCodice(p);
    if (!p.creatoIl) p.creatoIl = new Date().toISOString();
    p.aggiuntaAMano = true;

    var campi = {
      nome: p.nome, area: p.area, gruppo: p.gruppo || '', codice: p.codice,
      stato: 'attiva', creatoIl: p.creatoIl, json: JSON.stringify(pulita(p))
    };

    var lavoro = vecchia
      ? token().then(function (t) { return FB.aggiorna(t, vecchia._id, campi); })
      : token().then(function (t) { return FB.creaIscrizione(campi); });

    lavoro.then(function () {
      $('formManuale').style.display = 'none';
      $('formManuale').textContent = '';
      return ricarica(false);
    }).then(function () {
      sincronizzaContatori(true);
      CA.toast(vecchia ? '💾 Modifica salvata.' : '➕ Iscrizione aggiunta.', 4000);
    }).catch(function (e) { CA.toast('⚠️ ' + e.message, 8000); });
  }
  function pulita(p) {
    var o = JSON.parse(JSON.stringify(p));
    delete o._id; delete o.stato;
    return o;
  }
  function nuovoCodice(p) {
    var sig = p.area === 'ragazzi' ? 'RG' : (p.gruppo === 'burraco' ? 'BU' : 'IT');
    var lettere = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 4; i++) s += lettere[Math.floor(Math.random() * lettere.length)];
    return V(V(DATI.iscrizione, {}).prefissoCodice, 'CA') + '-' + sig + '-' + s;
  }

  /* ============ RECUPERO DA UN MESSAGGIO DI TELEGRAM ==================
     Se il database era bloccato quando qualcuno si e' iscritto, l'avviso
     Telegram e' partito lo stesso: quel messaggio contiene tutto. Qui lo si
     rilegge e si ricostruisce l'iscrizione, senza ricopiarla a mano.       */
  function apriImportaTelegram() {
    $('importaTg').style.display = '';
    $('anteprimaTg').textContent = '';
    $('importaTg').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { try { $('testoTg').focus(); } catch (e) { } }, 400);
  }

  function interpretaTelegram(testoIntero) {
    /* più messaggi incollati di seguito: si separano sull'intestazione */
    var pezzi = String(testoIntero || '')
      .split(/(?=🏊\s*CERTAMEN AQUATICUM)/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 20; });
    if (!pezzi.length) pezzi = [String(testoIntero || '')];

    return pezzi.map(leggiUnMessaggio).filter(Boolean);
  }

  function leggiUnMessaggio(testoMsg) {
    var campi = {};
    String(testoMsg).split('\n').forEach(function (r) {
      var m = r.match(/^\s*([A-Za-zÀ-ÿ' ]+?)\s*:\s*(.+?)\s*$/);
      if (m) campi[m[1].toLowerCase()] = m[2];
    });
    var nome = campi['nome'];
    if (!nome) return null;

    var sezione = V(campi['sezione'], '');
    var gruppo = '';
    if (/burraco/i.test(sezione)) gruppo = 'burraco';
    else if (/italiana/i.test(sezione)) gruppo = 'italiana';
    var area = gruppo ? 'adulti' : 'ragazzi';

    var p = {
      nome: nome,
      area: area,
      gruppo: gruppo,
      sezione: sezione || (area === 'ragazzi' ? 'Giochi in acqua' : 'Tornei di carte'),
      codice: V(campi['codice'], ''),
      telefono: V(campi['telefono'], ''),
      appartamento: V(campi['appartamento'], ''),
      note: V(campi['note'], ''),
      dataEvento: V(V(DATI.evento, {}).data, ''),
      creatoIl: new Date().toISOString(),
      recuperataDaTelegram: true
    };

    if (area === 'ragazzi') {
      p.eta = Number(String(V(campi['età'], campi['eta'] || '')).replace(/\D/g, '')) || 0;
      var acqua = String(V(campi['in acqua'], '')).toLowerCase();
      p.nuoto = /bene/.test(acqua) ? 'bene' : (/poco/.test(acqua) ? 'poco' : (/cava/.test(acqua) ? 'media' : ''));
      p.genitore = V(campi['genitore'], '');
      p.amico = V(campi['vorrebbe stare con'], '');
      var gare = String(V(campi['gare individuali'], ''));
      p.gare = (!gare || /nessuna/i.test(gare)) ? [] : gare.split(',').map(function (n) {
        var pulito = n.trim();
        var g = V(DATI.giochi, []).filter(function (x) { return x.nome === pulito; })[0];
        return { id: g ? g.id : pulito.toLowerCase().replace(/\s+/g, '-'), nome: pulito };
      });
    } else {
      p.livello = V(campi['esperienza'], '');
      var tornei = String(V(campi['tornei'], ''));
      p.tornei = tornei ? tornei.split(',').map(function (t) {
        var nomeT = t.replace(/\(.*?\)/, '').trim();
        var bl = (t.match(/bl\.?\s*([AB])/i) || [])[1] || '';
        var vero = V(DATI.tornei, []).filter(function (x) { return x.nome === nomeT; })[0];
        return { id: vero ? vero.id : nomeT.toLowerCase(), nome: nomeT, blocco: vero ? vero.blocco : bl };
      }) : [];
      var coppia = String(V(campi['coppia'], ''));
      p.inCoppia = !!coppia && !/abbinare/i.test(coppia);
      p.compagno = p.inCoppia ? coppia : '';
    }
    if (!p.codice) p.codice = nuovoCodice(p);
    return p;
  }

  function leggiTestoTelegram() {
    var trovate = interpretaTelegram($('testoTg').value);
    var box = $('anteprimaTg');
    box.textContent = '';
    if (!trovate.length) {
      box.appendChild(crea('p', 'aiuto', '⚠️ Non ho riconosciuto nessuna iscrizione. Assicurati di aver copiato tutto il messaggio, comprese le righe «Nome:» e «Sezione:».'));
      return;
    }

    box.appendChild(crea('h3', null, 'Ho letto ' + trovate.length +
      (trovate.length === 1 ? ' iscrizione:' : ' iscrizioni:')));

    trovate.forEach(function (p) {
      var r = crea('div', 'riga-iscr');
      var c = crea('div', 'cnt');
      var t = crea('div');
      t.appendChild(crea('span', 'tag ' + tagClasse(p), tagTesto(p)));
      var b = crea('b', null, p.nome); b.style.display = 'inline';
      t.appendChild(b);
      c.appendChild(t);
      c.appendChild(crea('small', null, dettaglio(p)));
      c.appendChild(crea('small', null, '🎟️ ' + p.codice + ' · ☎️ ' + (p.telefono || '—')));
      var gia = ISCR.filter(function (x) {
        return x.stato !== 'cestino' &&
          (x.codice === p.codice || normalizza(x.nome) === normalizza(p.nome));
      })[0];
      if (gia) c.appendChild(crea('small', null, '⚠️ Sembra già nel registro: non la aggiungo due volte.'));
      r.appendChild(c);
      box.appendChild(r);
    });

    var nuove = trovate.filter(function (p) {
      return !ISCR.some(function (x) {
        return x.stato !== 'cestino' &&
          (x.codice === p.codice || normalizza(x.nome) === normalizza(p.nome));
      });
    });

    var az = crea('div', 'azioni');
    az.style.cssText = 'justify-content:flex-start;margin-top:14px';
    if (nuove.length) {
      var b2 = crea('button', 'btn btn-p', '✅ Aggiungi al registro (' + nuove.length + ')');
      b2.addEventListener('click', function () { salvaRecuperate(nuove); });
      az.appendChild(b2);
    } else {
      az.appendChild(crea('p', 'aiuto', 'Sono già tutte nel registro: non c\'è niente da aggiungere.'));
    }
    box.appendChild(az);
  }

  function salvaRecuperate(elenco) {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    CA.toast('Aggiungo…', 20000);
    var lavori = elenco.map(function (p) {
      return token().then(function (t) {
        return FB.creaIscrizione({
          nome: p.nome, area: p.area, gruppo: p.gruppo || '', codice: p.codice,
          stato: 'attiva', creatoIl: p.creatoIl, json: JSON.stringify(p)
        });
      });
    });
    Promise.all(lavori).then(function () {
      $('importaTg').style.display = 'none';
      $('testoTg').value = '';
      return ricarica(false);
    }).then(function () {
      sincronizzaContatori(true);
      CA.toast('✅ Aggiunte ' + elenco.length + (elenco.length === 1 ? ' iscrizione.' : ' iscrizioni.'), 6000);
    }).catch(function (e) { CA.toast('⚠️ ' + e.message, 9000); });
  }

  function esportaCsv() {
    var righe = [['Sezione', 'Nome', 'Codice', 'Telefono', 'Appartamento', 'Età', 'In acqua',
      'Tornei/Gare', 'Compagno/Amico', 'Note', 'Iscritto il']];
    attive().forEach(function (p) {
      righe.push([
        p.area === 'ragazzi' ? 'Ragazzi' : (p.gruppo === 'burraco' ? 'Burraco' : 'All\'italiana'),
        p.nome, p.codice, p.telefono || '', p.appartamento || '',
        p.eta || '', p.area === 'ragazzi' ? etichettaNuoto(p.nuoto) : (p.livello || ''),
        p.area === 'ragazzi' ? V(p.gare, []).map(function (g) { return g.nome; }).join(' + ')
          : V(p.tornei, []).map(function (t) { return t.nome; }).join(' + '),
        p.area === 'ragazzi' ? V(p.amico, '') : V(p.compagno, ''),
        (p.note || '').replace(/\n/g, ' '),
        String(p.creatoIl || '').slice(0, 16).replace('T', ' ')
      ]);
    });
    var csv = righe.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    scaricaFile('iscrizioni-certamen.csv', '﻿' + csv, 'text/csv');
  }
  function scaricaFile(nome, contenuto, tipo) {
    var b = new Blob([contenuto], { type: (tipo || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* i contatori pubblici si ricalcolano dal registro, che è la verità */
  function sincronizzaContatori(zitto) {
    if (!SESS) { if (!zitto) CA.toast('Non sei collegato.', 5000); return; }
    var v = {
      ragazzi: attive('ragazzi').length,
      adulti: attive('adulti').length,
      italiana: attive('italiana').length,
      burraco: attive('burraco').length
    };
    token().then(function (t) { return FB.scriviContatori(t, v); })
      .then(function (ok) {
        if (!zitto) CA.toast(ok ? '🔢 Contatori pubblici aggiornati.' : '⚠️ Non sono riuscito ad aggiornarli.', 5000);
      }).catch(function () { });
  }

  /* ======================== SQUADRE DEI RAGAZZI ======================== */
  function ragazziIscritti() { return attive('ragazzi'); }

  function assegnati() {
    var s = {};
    STATO.squadre.forEach(function (sq) {
      V(sq.componenti, []).forEach(function (id) { s[id] = sq.id; });
    });
    return s;
  }
  function daAssegnare() {
    var a = assegnati();
    return ragazziIscritti().filter(function (p) { return !a[p._id]; });
  }
  function perId(id) {
    for (var i = 0; i < ISCR.length; i++) if (ISCR[i]._id === id) return ISCR[i];
    return null;
  }

  function consiglioNumeroSquadre(n) {
    var r = V(V(DATI.formatiSquadre, {}).regole, []);
    for (var i = 0; i < r.length; i++) {
      if (n >= r[i].min && n <= r[i].max) return r[i];
    }
    if (n < 8) return { squadre: 2, descrizione: 'Pochissimi iscritti: due squadre e sfide dirette.' };
    return r.length ? r[r.length - 1] : { squadre: 4, descrizione: '' };
  }

  function disegnaSquadre() {
    var rag = ragazziIscritti();
    var c = consiglioNumeroSquadre(rag.length);
    var f = V(DATI.formatiSquadre, {});

    testo('consiglioSquadre', rag.length
      ? ('Ci sono ' + rag.length + ' ragazzi iscritti. Consiglio: ' + c.squadre +
        ' squadre da circa ' + Math.round(rag.length / c.squadre) + ' componenti. ' + V(c.descrizione, ''))
      : 'Non ci sono ancora ragazzi iscritti: appena arrivano, qui compare il consiglio sul numero di squadre.');

    /* Il consiglio si aggiorna finché non lo tocco io: al primo disegno le
       iscrizioni non sono ancora arrivate, e senza questo il campo resterebbe
       fermo sul numero calcolato a registro vuoto. */
    if (!sqToccato) {
      $('sqNumero').value = V(STATO.configSquadre.numero, c.squadre);
      $('sqPer').value = V(STATO.configSquadre.perSquadra,
        rag.length ? Math.max(2, Math.round(rag.length / c.squadre)) : V(f.perSquadraIdeale, 6));
    }
    testo('sqPerNota', 'Indicativo: le squadre si riempiono comunque in modo uniforme.');

    var rb = $('regoleBilanciamento');
    if (rb && !rb.childNodes.length) {
      V(f.criteriBilanciamento, []).forEach(function (v) { rb.appendChild(crea('li', null, v)); });
    }

    disegnaTavoloSquadre();
    disegnaSerbatoio();
    mostraEquilibrio();
  }

  function generaSquadre() {
    var rag = ragazziIscritti();
    if (!rag.length) { CA.toast('Non ci sono ragazzi iscritti.', 5000); return; }
    var n = Math.max(2, Math.min(8, Number($('sqNumero').value) || 4));
    var criterio = $('sqCriterio').value;

    STATO.configSquadre = { numero: n, perSquadra: Number($('sqPer').value) || 0 };
    STATO.squadre = [];
    for (var i = 0; i < n; i++) {
      STATO.squadre.push({
        id: 'sq' + (i + 1),
        nome: NOMI_SQ[i % NOMI_SQ.length],
        motto: '',
        colore: COLORI_SQ[i % COLORI_SQ.length],
        capitano: '',
        componenti: []
      });
    }

    if (criterio === 'auto') {
      distribuisciBilanciato(rag, STATO.squadre);
      CA.toast('🎲 Squadre generate: età bilanciate, chi nuota poco sparpagliato, ' +
        ESITO_PREFERENZE.fatte.length + ' preferenze rispettate.', 7000);
    } else {
      CA.toast('Squadre vuote create: ora trascina i nomi.', 5000);
    }
    salvaStato();
    disegnaSquadre();
  }

  /* ============ FORMAZIONE DELLE SQUADRE: I TRE CRITERI ================
     Si tiene conto di tutte e tre le cose chieste all'iscrizione:
       1. la PREFERENZA — «vorrei stare in squadra con...»: chi si è scelto
          resta insieme, e chi si è scelto a vicenda ha la precedenza;
       2. l'ETÀ — distribuita a serpentina, così le medie restano vicine;
       3. la CAPACITÀ IN ACQUA — chi nuota poco viene sparpagliato, mai tutti
          nella stessa squadra.
     L'ordine conta: prima si formano i gruppetti di amici, poi si spalmano
     come fossero singoli giocatori. Un gruppo non può superare la metà di una
     squadra, altrimenti una comitiva sbilancerebbe tutto.                  */
  var ESITO_PREFERENZE = { fatte: [], saltate: [] };
  var LEGATI = {};          /* chi non va separato dai riequilibri */

  function distribuisciBilanciato(persone, squadre) {
    var n = squadre.length;
    squadre.forEach(function (s) { s.componenti = []; });

    var perSquadra = Math.ceil(persone.length / n);
    var maxGruppo = Math.max(2, Math.floor(perSquadra / 2) + 1);
    var blocchi = gruppiDiPreferenza(persone, maxGruppo);

    /* i gruppi più numerosi si piazzano per primi: sono i più difficili */
    blocchi.sort(function (a, b) {
      if (b.persone.length !== a.persone.length) return b.persone.length - a.persone.length;
      return b.eta - a.eta;
    });
    var grossi = blocchi.filter(function (b) { return b.persone.length > 1; });
    var singoli = blocchi.filter(function (b) { return b.persone.length === 1; })
      .sort(function (a, b) { return b.eta - a.eta; });

    /* i gruppi vanno dove c'è più posto, per non gonfiare una squadra sola */
    grossi.forEach(function (b) {
      var meno = 0;
      for (var k = 1; k < n; k++) {
        if (squadre[k].componenti.length < squadre[meno].componenti.length) meno = k;
      }
      b.persone.forEach(function (p) { squadre[meno].componenti.push(p._id); });
    });

    /* i singoli a serpentina sull'età: 1-2-3-4, poi 4-3-2-1 */
    var giro = 0, i = 0;
    while (i < singoli.length) {
      var ordine = [];
      for (var k2 = 0; k2 < n; k2++) ordine.push(k2);
      if (giro % 2 === 1) ordine.reverse();
      /* si salta chi è già pieno per colpa di un gruppo */
      ordine = ordine.filter(function (idx) { return squadre[idx].componenti.length < perSquadra; });
      if (!ordine.length) { ordine = [0]; for (var k3 = 1; k3 < n; k3++) ordine.push(k3); }
      for (var j = 0; j < ordine.length && i < singoli.length; j++) {
        squadre[ordine[j]].componenti.push(singoli[i].persone[0]._id);
        i++;
      }
      giro++;
    }

    pareggiaDimensioni(squadre);
    sparpagliaDeboli(squadre);
    affinaEta(squadre);
    scegliCapitani(squadre);
  }

  /* I gruppi di amici entrano tutti insieme e possono gonfiare una squadra.
     Qui si rimette a posto il numero, spostando chi non è legato a nessuno
     dalla squadra più affollata a quella più vuota. */
  function pareggiaDimensioni(squadre) {
    for (var giro = 0; giro < 40; giro++) {
      var max = 0, min = 0;
      for (var i = 1; i < squadre.length; i++) {
        if (squadre[i].componenti.length > squadre[max].componenti.length) max = i;
        if (squadre[i].componenti.length < squadre[min].componenti.length) min = i;
      }
      if (squadre[max].componenti.length - squadre[min].componenti.length <= 1) break;
      var liberi = squadre[max].componenti.filter(function (id) { return !LEGATI[id]; });
      if (!liberi.length) break;          /* solo gruppi legati: non si tocca */
      /* si sposta quello la cui età serve di più alla squadra che lo riceve */
      var mediaMin = mediaEta(squadre[min]);
      liberi.sort(function (a, b) {
        return Math.abs(etaDi(perId(a)) - mediaMin) - Math.abs(etaDi(perId(b)) - mediaMin);
      });
      var chi = liberi[0];
      squadre[max].componenti = squadre[max].componenti.filter(function (x) { return x !== chi; });
      if (squadre[max].capitano === chi) squadre[max].capitano = '';
      squadre[min].componenti.push(chi);
    }
  }

  /* capitano: il più grande fra quelli che nuotano bene */
  function scegliCapitani(squadre) {
    squadre.forEach(function (s) {
      if (s.capitano || !s.componenti.length) return;
      var mig = null;
      s.componenti.forEach(function (id) {
        var p = perId(id);
        if (!p) return;
        if (!mig) { mig = p; return; }
        var meglio = (!nuotaPoco(p) && nuotaPoco(mig)) ||
          (nuotaPoco(p) === nuotaPoco(mig) && etaDi(p) > etaDi(mig));
        if (meglio) mig = p;
      });
      if (mig) s.capitano = mig._id;
    });
  }

  function etaDi(p) { return Number(p && p.eta) || 13; }
  function nuotaPoco(p) { return p && p.nuoto === 'poco'; }

  /* Trova la persona nominata nella preferenza. All'iscrizione si scrive
     quello che viene: «Sofia», «Sofia Greco», «sofia greco». Si prova prima
     il nome intero, poi il solo nome di battesimo se non è ambiguo. */
  function trovaPersona(nome, persone) {
    var cercato = normalizza(nome);
    if (!cercato) return null;
    var esatto = persone.filter(function (p) { return normalizza(p.nome) === cercato; });
    if (esatto.length === 1) return esatto[0];
    var soloNome = persone.filter(function (p) {
      return normalizza(p.nome).split(' ')[0] === cercato.split(' ')[0];
    });
    if (soloNome.length === 1) return soloNome[0];
    var contiene = persone.filter(function (p) { return normalizza(p.nome).indexOf(cercato) >= 0; });
    if (contiene.length === 1) return contiene[0];
    return null;
  }

  /* Mette insieme chi si è scelto, senza far crescere troppo i gruppi. */
  function gruppiDiPreferenza(persone, maxGruppo) {
    var padre = {}, quanti = {};
    persone.forEach(function (p) { padre[p._id] = p._id; quanti[p._id] = 1; });
    function radice(x) {
      while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; }
      return x;
    }

    /* tutti i desideri espressi, i reciproci per primi */
    var desideri = [];
    persone.forEach(function (p) {
      if (!p.amico) return;
      var altro = trovaPersona(p.amico, persone);
      if (!altro || altro._id === p._id) {
        desideri.push({ a: p, testo: p.amico, reciproco: false, sconosciuto: true });
        return;
      }
      var reciproco = normalizza(V(altro.amico, '')) &&
        (trovaPersona(altro.amico, persone) || {})._id === p._id;
      desideri.push({ a: p, b: altro, testo: altro.nome, reciproco: !!reciproco });
    });
    desideri.sort(function (x, y) { return (y.reciproco ? 1 : 0) - (x.reciproco ? 1 : 0); });

    ESITO_PREFERENZE = { fatte: [], saltate: [] };
    desideri.forEach(function (d) {
      if (d.sconosciuto) {
        ESITO_PREFERENZE.saltate.push(d.a.nome + ' → «' + d.testo + '»: non l\'ho trovato fra gli iscritti');
        return;
      }
      var ra = radice(d.a._id), rb = radice(d.b._id);
      if (ra === rb) { ESITO_PREFERENZE.fatte.push(d.a.nome + ' con ' + d.b.nome); return; }
      if (quanti[ra] + quanti[rb] > maxGruppo) {
        ESITO_PREFERENZE.saltate.push(d.a.nome + ' con ' + d.b.nome +
          ': sarebbe diventato un gruppo di ' + (quanti[ra] + quanti[rb]) + ', troppo per una squadra sola');
        return;
      }
      padre[rb] = ra;
      quanti[ra] += quanti[rb];
      ESITO_PREFERENZE.fatte.push(d.a.nome + ' con ' + d.b.nome + (d.reciproco ? ' (scelta reciproca)' : ''));
    });

    /* dai legami ai gruppetti veri e propri */
    var gruppi = {};
    persone.forEach(function (p) {
      var r = radice(p._id);
      (gruppi[r] = gruppi[r] || []).push(p);
    });
    /* chi è legato a qualcun altro non va più spostato dai riequilibri:
       altrimenti la preferenza appena soddisfatta verrebbe disfatta subito */
    LEGATI = {};
    Object.keys(gruppi).forEach(function (k) {
      if (gruppi[k].length > 1) gruppi[k].forEach(function (p) { LEGATI[p._id] = true; });
    });

    return Object.keys(gruppi).map(function (k) {
      var g = gruppi[k];
      var somma = 0;
      g.forEach(function (p) { somma += etaDi(p); });
      return { persone: g, eta: somma / g.length };
    });
  }
  function normalizza(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* chi nuota poco non deve finire tutto nella stessa squadra */
  function sparpagliaDeboli(squadre) {
    var conta = squadre.map(function (s) {
      return s.componenti.filter(function (id) { return nuotaPoco(perId(id)); }).length;
    });
    for (var giro = 0; giro < 20; giro++) {
      var max = 0, min = 0;
      for (var i = 1; i < conta.length; i++) {
        if (conta[i] > conta[max]) max = i;
        if (conta[i] < conta[min]) min = i;
      }
      if (conta[max] - conta[min] <= 1) break;
      /* non si tocca chi è legato a un amico: la preferenza viene prima */
      var debole = squadre[max].componenti.filter(function (id) { return nuotaPoco(perId(id)) && !LEGATI[id]; })[0];
      var forte = squadre[min].componenti.filter(function (id) { return !nuotaPoco(perId(id)) && !LEGATI[id]; })[0];
      if (!debole || !forte) break;
      scambia(squadre[max], squadre[min], debole, forte);
      conta[max]--; conta[min]++;
    }
  }
  function scambia(sa, sb, ida, idb) {
    sa.componenti = sa.componenti.filter(function (x) { return x !== ida; }).concat([idb]);
    sb.componenti = sb.componenti.filter(function (x) { return x !== idb; }).concat([ida]);
    if (sa.capitano === ida) sa.capitano = '';
    if (sb.capitano === idb) sb.capitano = '';
  }

  /* qualche scambio per avvicinare le età medie */
  function affinaEta(squadre) {
    function media(s) {
      if (!s.componenti.length) return 0;
      var t = 0;
      s.componenti.forEach(function (id) { t += etaDi(perId(id)); });
      return t / s.componenti.length;
    }
    function scarto() {
      var m = squadre.map(media);
      return Math.max.apply(null, m) - Math.min.apply(null, m);
    }
    for (var giro = 0; giro < 60; giro++) {
      var prima = scarto();
      if (prima < 0.35) break;
      var m = squadre.map(media);
      var alta = 0, bassa = 0;
      for (var i = 1; i < m.length; i++) {
        if (m[i] > m[alta]) alta = i;
        if (m[i] < m[bassa]) bassa = i;
      }
      var migliore = null;
      squadre[alta].componenti.forEach(function (ia) {
        if (LEGATI[ia]) return;                       /* è con un amico: fermo lì */
        squadre[bassa].componenti.forEach(function (ib) {
          if (LEGATI[ib]) return;
          var ea = etaDi(perId(ia)), eb = etaDi(perId(ib));
          if (ea <= eb) return;
          if (nuotaPoco(perId(ia)) !== nuotaPoco(perId(ib))) return;
          scambia(squadre[alta], squadre[bassa], ia, ib);
          var dopo = scarto();
          scambia(squadre[alta], squadre[bassa], ib, ia);   /* rimetto a posto */
          if (dopo < prima && (!migliore || dopo < migliore.v)) migliore = { a: ia, b: ib, v: dopo };
        });
      });
      if (!migliore) break;
      scambia(squadre[alta], squadre[bassa], migliore.a, migliore.b);
    }
  }

  function disegnaTavoloSquadre() {
    var el = $('tavoloSquadre');
    el.textContent = '';
    if (!STATO.squadre.length) {
      el.appendChild(crea('p', 'aiuto', 'Nessuna squadra: usa la procedura guidata qui sopra.'));
      return;
    }
    STATO.squadre.forEach(function (sq) {
      var col = crea('div', 'colonna-sq');
      col.style.borderColor = sq.colore;

      var h = crea('h4');
      var pall = crea('span');
      pall.style.cssText = 'width:16px;height:16px;border-radius:50%;display:inline-block;background:' + sq.colore;
      h.appendChild(pall);
      var nome = document.createElement('input');
      nome.type = 'text'; nome.value = V(sq.nome, ''); nome.className = 'mini';
      nome.style.cssText = 'flex:1;font-weight:bold;min-height:38px;padding:6px 9px';
      nome.addEventListener('change', function () { sq.nome = nome.value.trim(); salvaStato(); });
      h.appendChild(nome);
      col.appendChild(h);

      var motto = document.createElement('input');
      motto.type = 'text'; motto.value = V(sq.motto, ''); motto.className = 'mini';
      motto.placeholder = 'grido di battaglia…';
      motto.style.cssText = 'min-height:36px;padding:6px 9px;font-size:.85rem;margin-bottom:8px';
      motto.addEventListener('change', function () { sq.motto = motto.value.trim(); salvaStato(); });
      col.appendChild(motto);

      var eta = mediaEta(sq);
      col.appendChild(crea('div', 'dati-sq',
        sq.componenti.length + ' componenti · età media ' + (eta ? eta.toFixed(1) : '—') +
        ' · ' + sq.componenti.filter(function (id) { return nuotaPoco(perId(id)); }).length + ' nuotano poco'));

      sq.componenti.forEach(function (id) {
        col.appendChild(pedina(id, sq));
      });

      /* zona di rilascio */
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('sopra'); });
      col.addEventListener('dragleave', function () { col.classList.remove('sopra'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('sopra');
        muovi(e.dataTransfer.getData('text/plain'), sq.id);
      });
      col.addEventListener('click', function (e) {
        if (SCELTA && !e.target.closest('.pedina') && !e.target.closest('input')) {
          muovi(SCELTA, sq.id);
        }
      });
      el.appendChild(col);
    });
  }

  function mediaEta(sq) {
    if (!sq.componenti.length) return 0;
    var t = 0, n = 0;
    sq.componenti.forEach(function (id) { var p = perId(id); if (p) { t += etaDi(p); n++; } });
    return n ? t / n : 0;
  }

  function pedina(id, sq) {
    var p = perId(id);
    var d = crea('div', 'pedina' + (sq && sq.capitano === id ? ' capitano' : '') + (SCELTA === id ? ' scelta' : ''));
    d.draggable = true;
    d.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', id); });

    if (sq) {
      var cap = crea('span', 'cap', sq.capitano === id ? '🧢' : '○');
      cap.title = 'Rendi capitano';
      cap.addEventListener('click', function (e) {
        e.stopPropagation();
        sq.capitano = (sq.capitano === id) ? '' : id;
        salvaStato();
        disegnaTavoloSquadre();
      });
      d.appendChild(cap);
    }
    d.appendChild(crea('span', null, p ? p.nome : '(sconosciuto)'));
    if (p && nuotaPoco(p)) d.appendChild(crea('span', null, '🛟'));
    d.appendChild(crea('span', 'eta-p', p ? (etaDi(p) + 'a') : ''));

    d.addEventListener('click', function (e) {
      e.stopPropagation();
      SCELTA = (SCELTA === id) ? null : id;
      disegnaTavoloSquadre();
      disegnaSerbatoio();
      if (SCELTA) CA.toast('Ora tocca la squadra dove spostarlo.', 3500);
    });
    return d;
  }

  function disegnaSerbatoio() {
    var el = $('serbatoio');
    el.textContent = '';
    var liberi = daAssegnare();
    if (!liberi.length) {
      el.appendChild(crea('p', 'aiuto', 'Tutti assegnati. 👍'));
    } else {
      liberi.forEach(function (p) { el.appendChild(pedina(p._id, null)); });
    }
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('sopra'); });
    el.addEventListener('dragleave', function () { el.classList.remove('sopra'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); el.classList.remove('sopra');
      muovi(e.dataTransfer.getData('text/plain'), null);
    });
    el.addEventListener('click', function (e) {
      if (SCELTA && !e.target.closest('.pedina')) muovi(SCELTA, null);
    });
  }

  function muovi(idPersona, idSquadra) {
    if (!idPersona) return;
    STATO.squadre.forEach(function (s) {
      s.componenti = s.componenti.filter(function (x) { return x !== idPersona; });
      if (s.capitano === idPersona) s.capitano = '';
    });
    if (idSquadra) {
      var sq = STATO.squadre.filter(function (s) { return s.id === idSquadra; })[0];
      if (sq) sq.componenti.push(idPersona);
    }
    SCELTA = null;
    salvaStato();
    disegnaTavoloSquadre();
    disegnaSerbatoio();
    mostraEquilibrio();
    disegnaCruscotto();
  }

  function mostraEquilibrio() {
    var box = $('equilibrio');
    if (!STATO.squadre.length) { box.style.display = 'none'; return; }
    var medie = STATO.squadre.map(mediaEta).filter(function (x) { return x > 0; });
    if (!medie.length) { box.style.display = 'none'; return; }
    var scarto = Math.max.apply(null, medie) - Math.min.apply(null, medie);
    var dim = STATO.squadre.map(function (s) { return s.componenti.length; });
    var diffDim = Math.max.apply(null, dim) - Math.min.apply(null, dim);
    var deboli = STATO.squadre.map(function (s) {
      return s.componenti.filter(function (id) { return nuotaPoco(perId(id)); }).length;
    });

    box.style.display = '';
    box.textContent = '';

    function riga(t) {
      var d = crea('div', null, t);
      d.style.marginBottom = '4px';
      box.appendChild(d);
      return d;
    }
    riga('⚖️ Età medie da ' + Math.min.apply(null, medie).toFixed(1) + ' a ' +
      Math.max.apply(null, medie).toFixed(1) + ' anni (scarto ' + scarto.toFixed(1) + ')');
    riga('👥 Componenti da ' + Math.min.apply(null, dim) + ' a ' + Math.max.apply(null, dim) +
      ' · chi nuota poco: ' + deboli.join(', ') + ' per squadra');

    /* come sono andate le preferenze espresse all'iscrizione */
    var fatte = ESITO_PREFERENZE.fatte, saltate = ESITO_PREFERENZE.saltate;
    if (fatte.length || saltate.length) {
      var r = riga('🤝 Preferenze: ' + fatte.length + ' rispettate' +
        (saltate.length ? ', ' + saltate.length + ' no' : ''));
      r.style.fontWeight = 'bold';
      if (fatte.length) {
        var d1 = document.createElement('details');
        var s1 = document.createElement('summary');
        s1.style.cssText = 'cursor:pointer;font-size:.88rem';
        s1.textContent = 'Chi è insieme come voleva';
        d1.appendChild(s1);
        var u1 = document.createElement('ul');
        u1.style.margin = '6px 0 0 18px';
        fatte.forEach(function (x) { u1.appendChild(crea('li', null, x)); });
        d1.appendChild(u1);
        box.appendChild(d1);
      }
      if (saltate.length) {
        var d2 = document.createElement('details');
        var s2 = document.createElement('summary');
        s2.style.cssText = 'cursor:pointer;font-size:.88rem';
        s2.textContent = 'Preferenze che non sono riuscito a rispettare';
        d2.appendChild(s2);
        var u2 = document.createElement('ul');
        u2.style.margin = '6px 0 0 18px';
        saltate.forEach(function (x) { u2.appendChild(crea('li', null, x)); });
        d2.appendChild(u2);
        box.appendChild(d2);
      }
    }

    var esito = riga(scarto <= 1 && diffDim <= 1
      ? '👍 Squadre equilibrate.'
      : '💡 Si può fare di meglio: prova a rigenerare o sposta qualcuno a mano.');
    esito.style.marginTop = '6px';
  }

  /* ============================ TORNEI DI CARTE ======================== */
  function torneiDelGruppo(idGruppo) {
    var g = V(DATI.gruppiCarte, []).filter(function (x) { return x.id === idGruppo; })[0];
    if (!g) return [];
    return V(DATI.tornei, []).filter(function (t) { return V(g.tornei, []).indexOf(t.id) >= 0; });
  }
  function iscrittiTorneo(idTorneo) {
    return attive('adulti').filter(function (p) {
      return V(p.tornei, []).some(function (t) { return t.id === idTorneo; });
    });
  }
  /* i giochi e i tornei che si fanno davvero: quelli esclusi dall'organizzatore
     spariscono da punteggi, tabelloni, classifiche e stampe */
  function giochiAttivi() {
    return V(DATI.giochi, []).filter(function (g) { return !g.escluso; });
  }
  function torneiAttivi() {
    return V(DATI.tornei, []).filter(function (t) { return !t.escluso; });
  }

  function torneoDati(id) {
    return V(DATI.tornei, []).filter(function (t) { return t.id === id; })[0] || {};
  }

  function disegnaTornei() {
    var sc = $('scegliTorneo');
    sc.textContent = '';
    var tornei = torneiAttivi();
    if (tornei.length && !tornei.some(function (t) { return t.id === TORNEO_APERTO; })) {
      TORNEO_APERTO = tornei[0].id;
    }
    tornei.forEach(function (t) {
      var n = iscrittiTorneo(t.id).length;
      var b = crea('button', 'btn btn-piccolo ' + (t.id === TORNEO_APERTO ? 'btn-p' : 'btn-chiaro'),
        V(t.emoji, '🃏') + ' ' + t.nome + ' (' + n + ')');
      b.addEventListener('click', function () { TORNEO_APERTO = t.id; disegnaTornei(); });
      sc.appendChild(b);
    });
    disegnaPannelloTorneo();
  }

  function disegnaPannelloTorneo() {
    var el = $('pannelloTorneo');
    el.textContent = '';
    if (!TORNEO_APERTO) return;
    var t = torneoDati(TORNEO_APERTO);
    var stato = STATO.tornei[TORNEO_APERTO] || {};
    var iscritti = iscrittiTorneo(TORNEO_APERTO);

    /* ---- procedura guidata ---- */
    var g = crea('div', 'guidata');
    g.appendChild(crea('h3', null, '🗂️ Procedura guidata: ' + V(t.nome, '')));
    var coppie = V(stato.coppie, []);
    g.appendChild(crea('p', 'mini',
      'Passo 1 — le coppie. Ci sono ' + iscritti.length + ' iscritti a questo torneo: ' +
      (coppie.length ? ('sono già formate ' + coppie.length + ' coppie.') : 'le coppie non sono ancora state formate.')));

    var az1 = crea('div', 'azioni');
    az1.style.cssText = 'justify-content:flex-start;margin:10px 0 18px';
    var bC = crea('button', 'btn btn-p btn-piccolo', '👥 Forma le coppie');
    bC.addEventListener('click', function () { formaCoppie(TORNEO_APERTO); });
    az1.appendChild(bC);
    g.appendChild(az1);

    /* passo 2: formula */
    var c = consiglioFormato(coppie.length);
    g.appendChild(crea('p', 'mini', 'Passo 2 — la formula, in base a quante coppie ci sono.'));
    var cons = crea('div', 'consiglio', coppie.length
      ? ('Con ' + coppie.length + ' coppie il consiglio è: ' + V(c.nome, '') + '. ' + V(c.descrizione, ''))
      : 'Forma prima le coppie: poi ti dico quale formula conviene.');
    g.appendChild(cons);

    var sf = crea('div', 'scelte-formato');
    V(V(DATI.formatiTorneo, {}).regole, []).forEach(function (r) {
      var b = crea('button', 'scelta-f' + ((stato.formato || c.formato) === r.formato ? ' presa' : ''));
      b.appendChild(crea('b', null, r.nome));
      b.appendChild(crea('small', null, r.descrizione));
      b.addEventListener('click', function () {
        STATO.tornei[TORNEO_APERTO] = STATO.tornei[TORNEO_APERTO] || {};
        STATO.tornei[TORNEO_APERTO].formato = r.formato;
        salvaStato();
        disegnaPannelloTorneo();
      });
      sf.appendChild(b);
    });
    g.appendChild(sf);

    var az2 = crea('div', 'azioni');
    az2.style.cssText = 'justify-content:flex-start;margin-top:16px';
    var bG = crea('button', 'btn btn-p', '🎲 Genera il tabellone');
    bG.addEventListener('click', function () { generaTabellone(TORNEO_APERTO); });
    az2.appendChild(bG);
    var bZ = crea('button', 'btn btn-chiaro btn-piccolo', '↩️ Cancella il tabellone');
    bZ.addEventListener('click', function () {
      if (!confirm('Cancello il tabellone di ' + t.nome + '?')) return;
      if (STATO.tornei[TORNEO_APERTO]) STATO.tornei[TORNEO_APERTO].incontri = [];
      salvaStato();
      disegnaPannelloTorneo();
    });
    az2.appendChild(bZ);
    g.appendChild(az2);
    el.appendChild(g);

    /* ---- le coppie ---- */
    if (coppie.length) {
      var cc = crea('div', 'card');
      cc.appendChild(crea('h2', null, '👥 Le coppie (' + coppie.length + ')'));
      cc.appendChild(crea('p', 'aiuto', 'Puoi cambiare il nome di una coppia: è quello che finisce sul tabellone pubblico.'));
      coppie.forEach(function (cp, i) {
        var r = crea('div', 'riga-iscr');
        var cnt = crea('div', 'cnt');
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = cp.nome; inp.className = 'mini';
        inp.addEventListener('change', function () { cp.nome = inp.value.trim(); salvaStato(); });
        cnt.appendChild(inp);
        cnt.appendChild(crea('small', null, 'coppia ' + (i + 1) + (cp.spaiata ? ' · abbinata dagli organizzatori' : '')));
        r.appendChild(cnt);
        cc.appendChild(r);
      });
      el.appendChild(cc);
    }

    /* ---- il tabellone ---- */
    var inc = V(stato.incontri, []);
    if (inc.length) {
      var ci = crea('div', 'card');
      ci.appendChild(crea('h2', null, '🗓️ Tabellone e risultati'));
      ci.appendChild(crea('p', 'aiuto', 'Scrivi i punteggi: la classifica si ricalcola da sola e si salva nel database.'));
      var turni = {};
      inc.forEach(function (m) {
        var k = V(m.turno, 'Incontri');
        (turni[k] = turni[k] || []).push(m);
      });
      Object.keys(turni).forEach(function (k) {
        ci.appendChild(crea('h3', null, k));
        turni[k].forEach(function (m) { ci.appendChild(rigaIncontroAdmin(m, coppie, TORNEO_APERTO)); });
      });
      el.appendChild(ci);

      var cl = crea('div', 'card');
      cl.appendChild(crea('h2', null, '📊 Classifica di ' + V(t.nome, '')));
      var dentroCl = crea('div');
      dentroCl.id = 'classificaTorneo';
      dentroCl.appendChild(tabellaClassificaAdmin(classificaTorneo(TORNEO_APERTO)));
      cl.appendChild(dentroCl);
      el.appendChild(cl);
    }
  }

  function consiglioFormato(n) {
    var r = V(V(DATI.formatiTorneo, {}).regole, []);
    for (var i = 0; i < r.length; i++) if (n >= r[i].min && n <= r[i].max) return r[i];
    return r.length ? r[r.length - 1] : { formato: 'italiana', nome: 'Girone all\'italiana', descrizione: '' };
  }

  /* Forma le coppie: prima quelle che si sono dichiarate a vicenda, poi
     quelle dichiarate a senso unico, infine si abbinano i rimasti mettendo
     insieme un esperto e un principiante quando si può. */
  function formaCoppie(idTorneo) {
    var iscritti = iscrittiTorneo(idTorneo);
    if (iscritti.length < 2) { CA.toast('Servono almeno due iscritti.', 5000); return; }

    var perNome = {};
    iscritti.forEach(function (p) { perNome[normalizza(p.nome)] = p; });
    var usati = {}, coppie = [];

    function aggiungi(a, b, spaiata) {
      usati[a._id] = true;
      if (b) usati[b._id] = true;
      coppie.push({
        id: 'c' + (coppie.length + 1),
        a: a._id, b: b ? b._id : '',
        nome: b ? (cognomino(a.nome) + ' – ' + cognomino(b.nome)) : (cognomino(a.nome) + ' – (da abbinare)'),
        spaiata: !!spaiata
      });
    }

    /* 1. reciproci */
    iscritti.forEach(function (p) {
      if (usati[p._id] || !p.compagno) return;
      var altro = perNome[normalizza(p.compagno)];
      if (!altro || usati[altro._id] || altro._id === p._id) return;
      if (normalizza(V(altro.compagno, '')) !== normalizza(p.nome)) return;
      aggiungi(p, altro, false);
    });
    /* 2. a senso unico */
    iscritti.forEach(function (p) {
      if (usati[p._id] || !p.compagno) return;
      var altro = perNome[normalizza(p.compagno)];
      if (!altro || usati[altro._id] || altro._id === p._id) return;
      aggiungi(p, altro, false);
    });
    /* 3. i rimasti: esperto con principiante */
    var rimasti = iscritti.filter(function (p) { return !usati[p._id]; });
    var peso = { esperto: 3, medio: 2, principiante: 1 };
    rimasti.sort(function (a, b) { return (peso[b.livello] || 2) - (peso[a.livello] || 2); });
    while (rimasti.length >= 2) {
      aggiungi(rimasti.shift(), rimasti.pop(), true);
    }
    if (rimasti.length === 1) aggiungi(rimasti[0], null, true);

    STATO.tornei[idTorneo] = STATO.tornei[idTorneo] || {};
    STATO.tornei[idTorneo].coppie = coppie;
    STATO.tornei[idTorneo].incontri = [];
    salvaStato();
    disegnaPannelloTorneo();
    disegnaCruscotto();
    CA.toast('👥 Formate ' + coppie.length + ' coppie.', 5000);
  }
  function cognomino(nome) {
    var p = String(nome || '').trim().split(/\s+/);
    return p.length > 1 ? (p[0] + ' ' + p[p.length - 1][0] + '.') : p[0];
  }

  /* --------- generazione del calendario secondo la formula scelta ------- */
  function generaTabellone(idTorneo) {
    var st = STATO.tornei[idTorneo] || {};
    var coppie = V(st.coppie, []);
    if (coppie.length < 2) { CA.toast('Forma prima le coppie.', 5000); return; }
    var formato = st.formato || consiglioFormato(coppie.length).formato;

    var incontri = [];
    if (formato === 'sfida') incontri = calendarioSfida(coppie);
    else if (formato === 'italiana') incontri = calendarioItaliana(coppie);
    else if (formato === 'gironi') incontri = calendarioGironi(coppie);
    else incontri = calendarioEliminazione(coppie);

    /* nei tornei a piu' prove (il Trittico) ogni turno ha il suo gioco */
    var td = torneoDati(idTorneo);
    incontri = assegnaProve(incontri, V(td.prove, []), V(td.provaFinale, ''));

    STATO.tornei[idTorneo] = STATO.tornei[idTorneo] || {};
    STATO.tornei[idTorneo].formato = formato;
    STATO.tornei[idTorneo].incontri = incontri;
    salvaStato();
    disegnaPannelloTorneo();
    disegnaPunteggi();
    disegnaCruscotto();
    CA.toast('🎲 Tabellone generato: ' + incontri.length + ' partite.', 5000);
  }

  function calendarioSfida(coppie) {
    var out = [];
    for (var i = 1; i <= 3; i++) {
      out.push({ id: 'm' + i, turno: 'Partita ' + i, a: coppie[0].id, b: coppie[1].id, tavolo: 1, puntiA: '', puntiB: '' });
    }
    return out;
  }

  /* girone all'italiana con il metodo del cerchio: tutti contro tutti */
  function calendarioItaliana(coppie, prefisso, tavoloBase) {
    var ids = coppie.map(function (c) { return c.id; });
    if (ids.length % 2) ids.push(null);           /* chi riposa */
    var n = ids.length, turni = n - 1, meta = n / 2;
    var out = [], k = 0;
    for (var t = 0; t < turni; t++) {
      var tavolo = tavoloBase || 1;
      for (var i = 0; i < meta; i++) {
        var a = ids[i], b = ids[n - 1 - i];
        if (a === null || b === null) continue;
        k++;
        out.push({
          id: 'm' + (prefisso || '') + k,
          turno: (prefisso ? ('Girone ' + prefisso + ' — turno ') : 'Turno ') + (t + 1),
          a: a, b: b, tavolo: tavolo++, puntiA: '', puntiB: ''
        });
      }
      ids.splice(1, 0, ids.pop());                /* si ruota tenendo fermo il primo */
    }
    return out;
  }

  /* due gironi, poi semifinali incrociate e finale */
  function calendarioGironi(coppie) {
    var a = [], b = [];
    coppie.forEach(function (c, i) { (i % 2 ? b : a).push(c); });
    var out = calendarioItaliana(a, 'A', 1).concat(calendarioItaliana(b, 'B', 3));
    out.push({ id: 'sf1', turno: 'Semifinali', a: '1A', b: '2B', tavolo: 1, puntiA: '', puntiB: '', segnaposto: true });
    out.push({ id: 'sf2', turno: 'Semifinali', a: '1B', b: '2A', tavolo: 2, puntiA: '', puntiB: '', segnaposto: true });
    out.push({ id: 'fin', turno: 'Finale', a: 'Vincente semifinale 1', b: 'Vincente semifinale 2', tavolo: 1, puntiA: '', puntiB: '', segnaposto: true });
    out.push({ id: 'fin3', turno: 'Finale 3º posto', a: 'Perdente semifinale 1', b: 'Perdente semifinale 2', tavolo: 2, puntiA: '', puntiB: '', segnaposto: true });
    return out;
  }

  /* tabellone a eliminazione: le coppie in eccesso riposano al primo turno */
  function calendarioEliminazione(coppie) {
    var n = coppie.length;
    var pot = 1;
    while (pot * 2 <= n) pot *= 2;
    var quanteSfide = n - pot;                    /* chi gioca il turno preliminare */
    var out = [], k = 0, tavolo = 1;
    var i = 0;
    for (var s = 0; s < quanteSfide; s++) {
      k++;
      out.push({
        id: 'p' + k, turno: 'Turno preliminare',
        a: coppie[i].id, b: coppie[i + 1].id, tavolo: tavolo++, puntiA: '', puntiB: ''
      });
      i += 2;
    }
    var restano = coppie.slice(i).map(function (c) { return c.id; });
    for (var q = 0; q < quanteSfide; q++) restano.push('Vincente preliminare ' + (q + 1));

    var turno = 1;
    while (restano.length > 1) {
      var prossimi = [], tav = 1;
      var nomeTurno = restano.length === 2 ? 'Finale' : (restano.length === 4 ? 'Semifinali' : 'Turno ' + turno);
      /* al singolare, per scrivere «Vincente semifinale 1» e non «semifinali 1» */
      var singolare = restano.length === 4 ? 'semifinale' : (restano.length === 2 ? 'finale' : 'turno ' + turno);
      for (var j = 0; j < restano.length; j += 2) {
        k++;
        var idm = 't' + turno + '_' + j;
        out.push({
          id: idm, turno: nomeTurno, a: restano[j], b: restano[j + 1],
          tavolo: tav++, puntiA: '', puntiB: '',
          segnaposto: String(restano[j]).indexOf('Vincente') === 0 || String(restano[j + 1]).indexOf('Vincente') === 0
        });
        prossimi.push('Vincente ' + singolare + ' ' + (prossimi.length + 1));
      }
      restano = prossimi;
      turno++;
      if (turno > 8) break;
    }
    return out;
  }

  /* Il Trittico e' un torneo solo con tre giochi dentro: a ogni turno di
     girone se ne gioca uno, a rotazione. Qui si scrive nel nome del turno
     quale prova tocca, cosi' al tavolo non ci sono dubbi.
     Le fasi finali (semifinali, finale, finalina) giocano tutte la prova
     scelta come "provaFinale": per il Trittico e' lo scopone. */
  function assegnaProve(incontri, prove, idProvaFinale) {
    if (!prove.length) return incontri;
    var finale = prove.filter(function (p) { return p.id === idProvaFinale; })[0]
      || prove[prove.length - 1];
    var turni = [];
    incontri.forEach(function (m) {
      if (turni.indexOf(m.turno) < 0) turni.push(m.turno);
    });
    var soloGironi = turni.filter(function (t) { return !/final/i.test(t); });
    var mappa = {};
    soloGironi.forEach(function (t, i) { mappa[t] = prove[i % prove.length]; });
    turni.forEach(function (t) {
      if (!mappa[t]) mappa[t] = finale;
    });
    incontri.forEach(function (m) {
      var p = mappa[m.turno];
      if (p) {
        m.prova = p.id;
        m.turno = m.turno + ' — ' + V(p.emoji, '') + ' ' + V(p.nome, '');
      }
    });
    return incontri;
  }

  function nomeCoppia(id, coppie) {
    var c = coppie.filter(function (x) { return x.id === id; })[0];
    if (c) return c.nome;
    return String(id || '—');
  }

  /* Una riga di incontro con i due punteggi. Volutamente NON ridisegna tutto
     il pannello a ogni cifra: a bordo piscina si scrive col telefono, e un
     ridisegno fa perdere il campo sotto il dito. Si aggiorna solo la
     classifica, che è l'unica cosa che cambia davvero. */
  function rigaIncontroAdmin(m, coppie, idTorneo) {
    var d = crea('div', 'incontro-adm');
    d.appendChild(crea('b', null, nomeCoppia(m.a, coppie)));

    var cc = crea('div', 'cc');
    var ia = document.createElement('input');
    ia.type = 'number'; ia.value = V(m.puntiA, ''); ia.inputMode = 'numeric';
    ia.setAttribute('aria-label', 'Punti di ' + nomeCoppia(m.a, coppie));
    var ib = document.createElement('input');
    ib.type = 'number'; ib.value = V(m.puntiB, ''); ib.inputMode = 'numeric';
    ib.setAttribute('aria-label', 'Punti di ' + nomeCoppia(m.b, coppie));
    function cambia() {
      m.puntiA = ia.value === '' ? '' : Number(ia.value);
      m.puntiB = ib.value === '' ? '' : Number(ib.value);
      salvaStato();
      aggiornaClassificaAVideo(idTorneo || TORNEO_APERTO);
      evidenziaVincente();
    }
    function evidenziaVincente() {
      var a = Number(m.puntiA), b = Number(m.puntiB);
      var vale = m.puntiA !== '' && m.puntiB !== '' && isFinite(a) && isFinite(b);
      d.querySelectorAll('b').forEach(function (x) { x.style.color = ''; });
      if (!vale) return;
      if (a > b) d.querySelectorAll('b')[0].style.color = '#0f7a4a';
      if (b > a) d.querySelectorAll('b')[1].style.color = '#0f7a4a';
    }
    ia.addEventListener('change', cambia);
    ib.addEventListener('change', cambia);
    cc.appendChild(ia);
    cc.appendChild(crea('span', null, '–'));
    cc.appendChild(ib);
    d.appendChild(cc);

    d.appendChild(crea('b', 'dx', nomeCoppia(m.b, coppie)));
    setTimeout(evidenziaVincente, 0);
    return d;
  }

  /* rifà solo la tabella della classifica, lasciando stare il resto */
  function aggiornaClassificaAVideo(idTorneo) {
    var box = document.getElementById('classificaTorneo');
    if (!box || !idTorneo) return;
    box.textContent = '';
    box.appendChild(tabellaClassificaAdmin(classificaTorneo(idTorneo)));
  }

  function classificaTorneo(idTorneo) {
    var st = STATO.tornei[idTorneo] || {};
    var coppie = V(st.coppie, []);
    var pun = V(V(V(DATI.aree, {}).adulti, {}).punteggio, {});
    var vv = V(pun.vittoria, 3), pp = V(pun.pareggio, 1);
    var tab = {};
    coppie.forEach(function (c) {
      tab[c.id] = { coppia: c.nome, id: c.id, g: 0, v: 0, n: 0, p: 0, punti: 0, fatti: 0, subiti: 0 };
    });
    V(st.incontri, []).forEach(function (m) {
      if (m.puntiA === '' || m.puntiB === '' || m.puntiA === undefined || m.puntiB === undefined) return;
      var a = tab[m.a], b = tab[m.b];
      if (!a || !b) return;
      var pa = Number(m.puntiA), pb = Number(m.puntiB);
      a.g++; b.g++;
      a.fatti += pa; a.subiti += pb;
      b.fatti += pb; b.subiti += pa;
      if (pa > pb) { a.v++; b.p++; a.punti += vv; }
      else if (pb > pa) { b.v++; a.p++; b.punti += vv; }
      else { a.n++; b.n++; a.punti += pp; b.punti += pp; }
    });
    return Object.keys(tab).map(function (k) { return tab[k]; })
      .sort(function (x, y) {
        if (y.punti !== x.punti) return y.punti - x.punti;
        return (y.fatti - y.subiti) - (x.fatti - x.subiti);
      });
  }

  function tabellaClassificaAdmin(righe) {
    var scroll = crea('div', 'tabella-scroll');
    var t = document.createElement('table');
    t.className = 'tab';
    var th = document.createElement('thead');
    var tr = document.createElement('tr');
    ['#', 'Coppia', 'G', 'V', 'N', 'P', 'Punti'].forEach(function (x, i) {
      var c = document.createElement('th');
      c.textContent = x;
      if (i >= 2) c.className = 'n';
      tr.appendChild(c);
    });
    th.appendChild(tr); t.appendChild(th);
    var tb = document.createElement('tbody');
    righe.forEach(function (r, i) {
      var row = document.createElement('tr');
      if (i < 3) row.className = 'podio' + (i + 1);
      [String(i + 1), r.coppia, r.g, r.v, r.n, r.p, r.punti].forEach(function (v, k) {
        var td = document.createElement('td');
        td.textContent = String(v);
        if (k >= 2) td.className = 'n';
        row.appendChild(td);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    scroll.appendChild(t);
    return scroll;
  }

  /* ============================== PUNTEGGI ============================= */
  function disegnaPunteggi() {
    disegnaPuntiRagazzi();
    disegnaPuntiCarte();
    disegnaTitoli();
  }

  function disegnaPuntiRagazzi() {
    var el = $('puntiRagazzi');
    el.textContent = '';
    if (!STATO.squadre.length) {
      var c0 = crea('div', 'card');
      c0.appendChild(crea('p', 'aiuto', 'Prima forma le squadre nella scheda 🚩 Squadre.'));
      el.appendChild(c0);
      return;
    }
    var pun = V(V(V(DATI.aree, {}).ragazzi, {}).punteggio, {});
    var scala = [V(pun.primo, 5), V(pun.secondo, 3), V(pun.terzo, 2), V(pun.quarto, 1)];

    /* classifica generale in cima, così si vede sempre come sta andando */
    var cc = crea('div', 'card');
    cc.appendChild(crea('h2', null, '🏆 Classifica generale'));
    var gen = classificaRagazzi();
    var ul = crea('div');
    gen.forEach(function (r, i) {
      var d = crea('div', 'riga-iscr');
      var s = crea('div', 'cnt');
      var b = crea('b', null, (['🥇', '🥈', '🥉'][i] || (i + 1) + '°') + ' ' + r.nome);
      s.appendChild(b);
      s.appendChild(crea('small', null, r.dettaglio));
      d.appendChild(s);
      d.appendChild(crea('span', 'tondo-punti', String(r.punti)));
      ul.appendChild(d);
    });
    cc.appendChild(ul);

    /* bonus fair play */
    cc.appendChild(crea('h3', null, '🤝 Punti bonus (fair play)'));
    STATO.squadre.forEach(function (sq) {
      var d = crea('div', 'posto-riga');
      d.style.marginBottom = '8px';
      d.appendChild(crea('span', null, sq.nome));
      var i = document.createElement('input');
      i.type = 'number'; i.className = 'mini'; i.style.width = '90px';
      i.value = V(STATO.bonus[sq.id], '');
      i.addEventListener('change', function () {
        STATO.bonus[sq.id] = Number(i.value) || 0;
        salvaStato();
        disegnaPuntiRagazzi();
      });
      d.appendChild(i);
      cc.appendChild(d);
    });
    el.appendChild(cc);

    /* una scheda per gioco (saltando quelli esclusi dal programma) */
    V(DATI.giochi, []).forEach(function (g) {
      if (g.escluso) return;
      if (g.tipo === 'riscaldamento') return;
      if (g.tipo === 'individuale') return;
      var c = crea('div', 'gioco-punti');
      var doppio = (g.tipo === 'finale');
      var h = crea('h3', null, V(g.emoji, '🎯') + ' ' + g.nome + (doppio ? '  (punti doppi)' : ''));
      c.appendChild(h);

      var ordine = V(STATO.risultati[g.id], []);
      var box = crea('div', 'ordine-sq');
      for (var pos = 0; pos < STATO.squadre.length; pos++) {
        (function (pos) {
          var riga = crea('div', 'posto-riga');
          riga.appendChild(crea('span', 'medaglia', ['🥇', '🥈', '🥉'][pos] || (pos + 1) + '°'));
          var sel = document.createElement('select');
          var vuota = document.createElement('option');
          vuota.value = ''; vuota.textContent = '— chi è arrivato ' + (pos + 1) + '° —';
          sel.appendChild(vuota);
          STATO.squadre.forEach(function (sq) {
            var op = document.createElement('option');
            op.value = sq.id; op.textContent = sq.nome;
            sel.appendChild(op);
          });
          var gia = ordine[pos];
          sel.value = gia ? gia.squadra : '';
          sel.addEventListener('change', function () {
            var nuovo = V(STATO.risultati[g.id], []).slice();
            /* la stessa squadra non può essere prima e terza: se la scelgo
               qui, la tolgo dalla posizione in cui stava prima */
            if (sel.value) {
              for (var k = 0; k < nuovo.length; k++) {
                if (k !== pos && nuovo[k] && nuovo[k].squadra === sel.value) nuovo[k] = null;
              }
            }
            nuovo[pos] = sel.value ? {
              squadra: sel.value, posizione: pos + 1,
              punti: (scala[pos] !== undefined ? scala[pos] : 1) * (doppio ? 2 : 1)
            } : null;
            STATO.risultati[g.id] = nuovo;
            salvaStato();
            var dove = window.pageYOffset;
            disegnaPuntiRagazzi();
            window.scrollTo(0, dove);      /* non far saltare la pagina sotto le dita */
          });
          riga.appendChild(sel);
          riga.appendChild(crea('span', 'tondo-punti',
            String((scala[pos] !== undefined ? scala[pos] : 1) * (doppio ? 2 : 1))));
          box.appendChild(riga);
        })(pos);
      }
      c.appendChild(box);
      el.appendChild(c);
    });
  }

  function classificaRagazzi() {
    var tot = {};
    STATO.squadre.forEach(function (s) { tot[s.id] = { nome: s.nome, id: s.id, punti: Number(STATO.bonus[s.id]) || 0, gare: 0 }; });
    Object.keys(STATO.risultati).forEach(function (idGioco) {
      V(STATO.risultati[idGioco], []).forEach(function (r) {
        if (!r || !tot[r.squadra]) return;
        tot[r.squadra].punti += Number(r.punti) || 0;
        tot[r.squadra].gare++;
      });
    });
    return Object.keys(tot).map(function (k) {
      var x = tot[k];
      x.dettaglio = x.gare + (x.gare === 1 ? ' gara' : ' gare') +
        (Number(STATO.bonus[k]) ? ' · ' + STATO.bonus[k] + ' punti bonus' : '');
      return x;
    }).sort(function (a, b) { return b.punti - a.punti; });
  }

  function disegnaPuntiCarte() {
    var el = $('puntiCarte');
    el.textContent = '';
    var qualcosa = false;
    torneiAttivi().forEach(function (t) {
      var st = STATO.tornei[t.id] || {};
      var inc = V(st.incontri, []);
      if (!inc.length) return;
      qualcosa = true;
      var c = crea('div', 'card');
      c.appendChild(crea('h2', null, V(t.emoji, '🃏') + ' ' + t.nome));
      var turni = {};
      inc.forEach(function (m) { (turni[V(m.turno, 'Incontri')] = turni[V(m.turno, 'Incontri')] || []).push(m); });
      Object.keys(turni).forEach(function (k) {
        c.appendChild(crea('h3', null, k));
        turni[k].forEach(function (m) { c.appendChild(rigaIncontroAdmin(m, V(st.coppie, []), t.id)); });
      });
      el.appendChild(c);
    });
    if (!qualcosa) {
      var v = crea('div', 'card');
      v.appendChild(crea('p', 'aiuto', 'Nessun tabellone generato: vai nella scheda 🃏 Tornei.'));
      el.appendChild(v);
    }
  }

  function disegnaTitoli() {
    var el = $('puntiTitoli');
    el.textContent = '';
    var c = crea('div', 'card');
    c.appendChild(crea('h2', null, '⭐ Titoli e premi'));
    c.appendChild(crea('p', 'aiuto', 'Chi ha vinto cosa. Compare nella pagina pubblica delle classifiche.'));

    V(DATI.premi, []).forEach(function (p) {
      var riga = crea('div', 'posto-riga');
      riga.style.marginBottom = '10px';
      riga.appendChild(crea('span', 'medaglia', V(p.emoji, '🏅')));
      var eti = crea('span', null, p.nome);
      eti.style.cssText = 'flex:0 0 190px;font-weight:bold;font-size:.92rem';
      riga.appendChild(eti);
      var i = document.createElement('input');
      i.type = 'text'; i.className = 'mini'; i.placeholder = 'chi ha vinto…';
      i.style.flex = '1';
      var gia = STATO.titoli.filter(function (x) { return x.premio === p.nome; })[0];
      i.value = gia ? gia.chi : '';
      i.addEventListener('change', function () {
        STATO.titoli = STATO.titoli.filter(function (x) { return x.premio !== p.nome; });
        if (i.value.trim()) STATO.titoli.push({ premio: p.nome, chi: i.value.trim(), emoji: V(p.emoji, '🏅'), area: p.area });
        salvaStato();
      });
      riga.appendChild(i);
      c.appendChild(riga);
    });
    el.appendChild(c);
  }

  /* ====================== PUBBLICAZIONE CLASSIFICHE =================== */
  function nomePubblico(p, modo) {
    if (!p) return '';
    var parti = String(p.nome || '').trim().split(/\s+/);
    if (modo === 'nome') return parti[0];
    if (modo === 'intero') return p.nome;
    if (parti.length > 1) return parti[0] + ' ' + parti[parti.length - 1][0] + '.';
    return parti[0];
  }

  function costruisciPubblico() {
    var modo = $('pubNomi').value;
    var out = { aggiornato: new Date().toISOString() };

    /* ragazzi */
    var gen = classificaRagazzi();
    var mappaPunti = {};
    gen.forEach(function (g) { mappaPunti[g.id] = g.punti; });
    out.ragazzi = {
      squadre: STATO.squadre.map(function (s) {
        return {
          nome: s.nome, motto: s.motto, colore: s.colore,
          capitano: modo === 'niente' ? '' : nomePubblico(perId(s.capitano), modo),
          punti: V(mappaPunti[s.id], 0),
          componenti: modo === 'niente' ? [] : s.componenti.map(function (id) {
            return nomePubblico(perId(id), modo);
          }).filter(Boolean)
        };
      }),
      gare: [],
      titoli: STATO.titoli.filter(function (t) { return t.area === 'ragazzi'; })
    };
    giochiAttivi().forEach(function (g) {
      var r = V(STATO.risultati[g.id], []).filter(Boolean);
      if (!r.length) return;
      out.ragazzi.gare.push({
        nome: g.nome, emoji: g.emoji,
        ordine: r.map(function (x) {
          var sq = STATO.squadre.filter(function (s) { return s.id === x.squadra; })[0];
          return { squadra: sq ? sq.nome : '—', punti: x.punti };
        })
      });
    });

    /* carte */
    var tornei = [], generale = {};
    torneiAttivi().forEach(function (t) {
      var st = STATO.tornei[t.id] || {};
      if (!V(st.coppie, []).length) return;
      var cl = classificaTorneo(t.id);
      tornei.push({
        id: t.id, nome: t.nome, emoji: t.emoji,
        formato: V(st.formato, ''),
        stato: V(st.incontri, []).some(function (m) { return m.puntiA === '' || m.puntiA === undefined; })
          ? 'in corso' : 'concluso',
        classifica: cl.map(function (r) {
          return { coppia: r.coppia, g: r.g, v: r.v, n: r.n, p: r.p, punti: r.punti };
        }),
        incontri: V(st.incontri, []).map(function (m) {
          return {
            turno: m.turno, tavolo: m.tavolo,
            a: nomeCoppia(m.a, V(st.coppie, [])), b: nomeCoppia(m.b, V(st.coppie, [])),
            puntiA: m.puntiA, puntiB: m.puntiB
          };
        })
      });
      if (t.gruppo === 'italiana') {
        cl.forEach(function (r) {
          generale[r.coppia] = (generale[r.coppia] || 0) + r.punti;
        });
      }
    });
    /* la classifica combinata serve solo se nel gruppo ci sono più tornei:
       col Trittico il torneo è già uno solo e sarebbe una copia inutile */
    var quantiItaliana = torneiAttivi().filter(function (t) { return t.gruppo === 'italiana'; }).length;
    out.carte = {
      tornei: tornei,
      generale: quantiItaliana > 1
        ? Object.keys(generale).map(function (k) { return { coppia: k, punti: generale[k] }; })
          .sort(function (a, b) { return b.punti - a.punti; })
        : [],
      titoli: STATO.titoli.filter(function (t) { return t.area === 'adulti'; })
    };
    return out;
  }

  /* ---- bacheca pubblica aggiornata da sola ----
     Si accoda per qualche secondo: se sto inserendo tre punteggi di fila,
     la bacheca si aggiorna una volta sola alla fine, non tre.            */
  var timerBacheca = null;
  function aggiornaBachecaSePuoi() {
    var s = $('autoPubblica');
    if (!s || !s.checked || !SESS) return;
    if (timerBacheca) clearTimeout(timerBacheca);
    timerBacheca = setTimeout(function () {
      token().then(function (t) { return FB.scriviClassifica(t, costruisciPubblico()); })
        .then(function (ok) {
          if (!ok) return;
          var d = new Date();
          testo('statoPubblicazione', '🔄 Bacheca aggiornata da sola alle ' +
            due(d.getHours()) + ':' + due(d.getMinutes()) + '.');
        })
        .catch(function () { /* riprova al prossimo salvataggio */ });
    }, 2500);
  }

  function pubblicaClassifiche() {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var doc = costruisciPubblico();
    CA.toast('Pubblico…', 20000);
    token().then(function (t) { return FB.scriviClassifica(t, doc); })
      .then(function (ok) {
        testo('statoPubblicazione', ok
          ? ('✅ Pubblicate alle ' + new Date().toLocaleTimeString('it-IT').slice(0, 5) + '. Chi apre la pagina classifiche le vede subito.')
          : '⚠️ Non sono riuscito a pubblicarle.');
        CA.toast(ok ? '📣 Classifiche pubblicate!' : '⚠️ Pubblicazione non riuscita.', 6000);
      }).catch(function (e) { CA.toast('⚠️ ' + e.message, 8000); });
  }

  /* ======================= CONTENUTI E GITHUB ========================= */
  function riempiContenuti() {
    var t = V(DATI.tema, {}), ev = V(DATI.evento, {}), con = V(DATI.contatti, {});
    var aree = V(DATI.aree, {}), q = V(DATI.quota, {});
    $('c_titolo').value = V(t.titolo, '');
    $('c_sotto').value = V(t.sottotitolo, '');
    $('c_data').value = V(ev.data, '');
    $('c_chiusura').value = V(ev.chiusuraIscrizioni, '');
    $('c_ora').value = V(ev.orario, '');
    $('c_oraFine').value = V(ev.orarioFine, '');
    $('c_luogo').value = V(ev.luogo, '');
    $('c_tel').value = V(con.telefono, '');
    $('c_desc').value = V(ev.descrizione, '');
    $('c_col1').value = V(t.colorePrimario, '');
    $('c_col2').value = V(t.coloreSecondario, '');
    $('c_col3').value = V(t.coloreAccento, '');
    $('c_postiRag').value = V((aree.ragazzi || {}).postiTotali, '');
    $('c_postiAdu').value = V((aree.adulti || {}).postiTotali, '');
    $('c_quotaAttiva').checked = (q.attiva === true);
    $('c_quotaImporto').value = V(q.importo, '');
    $('c_quotaEtichetta').value = V(q.etichetta, '');
    $('c_quotaSpiega').value = V(q.spiegazione, '');
    $('c_musicaAttiva').checked = (DATI.musicaAttiva !== false);
    var n = V(DATI.notifiche, {});
    $('tg_token').value = V(n.telegramBotToken, '');
    $('tg_chat').value = V(n.telegramChatId, '');
    $('c_sicurezza').value = V(DATI.sicurezza, []).join('\n');
    $('c_regolamento').value = V(DATI.regolamento, []).join('\n');
    $('c_foto').value = V(DATI.foto, []).join('\n');
    $('c_programma').value = V(DATI.programma, []).map(function (r) {
      return [V(r.ora, ''), V(r.area, 'tutti'), V(r.titolo, ''), V(r.nota, '')].join(' | ');
    }).join('\n');

    disegnaEditMusica();
    disegnaEditGiochi();
    disegnaEditTornei();
  }

  function disegnaEditMusica() {
    var el = $('editMusica');
    el.textContent = '';
    V(DATI.giochi, []).filter(function (g) { return !g.escluso; }).forEach(function (g) {
      g.musica = g.musica || { titolo: '', artista: '', url: '', ricerca: '' };
      var d = crea('div', 'voce-edit');
      var h = crea('div');
      h.style.cssText = 'font-weight:bold;margin-bottom:8px';
      h.textContent = V(g.emoji, '🎯') + ' ' + g.nome;
      d.appendChild(h);
      var gr = crea('div', 'griglia3');
      gr.appendChild(campoMini('Titolo', g.musica.titolo, function (v) { g.musica.titolo = v; aggiornaRicerca(g); }));
      gr.appendChild(campoMini('Artista', g.musica.artista, function (v) { g.musica.artista = v; aggiornaRicerca(g); }));
      gr.appendChild(campoMini('Collegamento YouTube (facoltativo)', g.musica.url, function (v) { g.musica.url = v.trim(); }));
      d.appendChild(gr);
      var prova = crea('a', 'bottoncino', '▶ Prova il collegamento');
      prova.target = '_blank'; prova.rel = 'noopener';
      prova.href = CA.linkMusica(g.musica) || '#';
      prova.style.display = 'inline-block';
      d.appendChild(prova);
      el.appendChild(d);
    });
  }
  function aggiornaRicerca(g) {
    g.musica.ricerca = (V(g.musica.titolo, '') + ' ' + V(g.musica.artista, '')).trim();
  }

  function campoMini(eti, valore, alCambio) {
    var d = crea('div', 'campo');
    var l = document.createElement('label');
    l.textContent = eti;
    d.appendChild(l);
    var i = document.createElement('input');
    i.type = 'text'; i.className = 'mini'; i.value = V(valore, '');
    i.addEventListener('change', function () { alCambio(i.value); });
    d.appendChild(i);
    return d;
  }
  function areaMini(eti, valore, alCambio) {
    var d = crea('div', 'campo');
    var l = document.createElement('label');
    l.textContent = eti;
    d.appendChild(l);
    var i = document.createElement('textarea');
    i.value = V(valore, '');
    i.addEventListener('change', function () { alCambio(i.value); });
    d.appendChild(i);
    return d;
  }

  /* ============ elenchi riordinabili: quali giochi e in che ordine ========
     Si sposta trascinando la maniglia ⠿, ma anche con le frecce ▲▼: dal
     telefono il trascinamento è scomodo e a bordo piscina si lavora col dito.
     Ogni voce ha tre stati: in programma, di riserva, escluso dal sito.     */
  var TRASCINO = null;      /* indice della voce che sto spostando */

  function statoVoce(v) {
    if (v.escluso) return 'escluso';
    return v.riserva ? 'riserva' : 'programma';
  }
  function impostaStato(v, s) {
    v.escluso = (s === 'escluso');
    v.riserva = (s === 'riserva');
  }

  /* costruisce un elenco riordinabile; "dettagli" riempie la parte apribile */
  function elencoOrdinabile(contenitore, elenco, dettagli, ridisegna) {
    contenitore.textContent = '';

    elenco.forEach(function (v, i) {
      var box = crea('div', 'voce-ord ' + statoVoce(v));
      box.draggable = true;

      /* --- riga della testa: maniglia, numero, nome, frecce --- */
      var testa = crea('div', 'testa-ord');
      var man = crea('span', 'maniglia', '⠿');
      man.title = 'Trascina per spostare';
      testa.appendChild(man);
      testa.appendChild(crea('span', 'num-ord', v.escluso ? '—' : String(numeroInProgramma(elenco, i))));
      testa.appendChild(crea('span', 'nome-ord', V(v.emoji, '🎯') + ' ' + V(v.nome, '')));

      var frecce = crea('div', 'frecce');
      var su = crea('button', null, '▲');
      su.title = 'Sposta più in alto';
      su.disabled = (i === 0);
      su.addEventListener('click', function () { sposta(elenco, i, i - 1, ridisegna); });
      var giu = crea('button', null, '▼');
      giu.title = 'Sposta più in basso';
      giu.disabled = (i === elenco.length - 1);
      giu.addEventListener('click', function () { sposta(elenco, i, i + 1, ridisegna); });
      frecce.appendChild(su); frecce.appendChild(giu);
      testa.appendChild(frecce);
      box.appendChild(testa);

      /* --- i tre stati --- */
      var stati = crea('div', 'stati');
      [['programma', '✅ In programma'], ['riserva', '🔄 Di riserva'], ['escluso', '🚫 Escluso']]
        .forEach(function (s) {
          var b = crea('button', statoVoce(v) === s[0] ? 'presa' : '', s[1]);
          b.setAttribute('data-s', s[0]);
          b.addEventListener('click', function () {
            impostaStato(v, s[0]);
            ridisegna();
            salvaBozzaFraPoco();
          });
          stati.appendChild(b);
        });
      box.appendChild(stati);

      /* --- i campi da modificare --- */
      var det = document.createElement('details');
      det.style.marginTop = '10px';
      var sum = document.createElement('summary');
      sum.style.cssText = 'cursor:pointer;font-size:.9rem;color:var(--muted);padding:6px 0';
      sum.textContent = 'Modifica testi, orario e regole';
      det.appendChild(sum);
      dettagli(det, v);
      box.appendChild(det);

      /* --- trascinamento --- */
      box.addEventListener('dragstart', function (e) {
        TRASCINO = i;
        box.classList.add('trascino');
        try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) { }
        e.dataTransfer.effectAllowed = 'move';
      });
      box.addEventListener('dragend', function () {
        TRASCINO = null;
        box.classList.remove('trascino');
      });
      box.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        box.classList.add('bersaglio');
      });
      box.addEventListener('dragleave', function () { box.classList.remove('bersaglio'); });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        box.classList.remove('bersaglio');
        var da = TRASCINO;
        if (da === null || da === undefined) {
          da = Number(e.dataTransfer.getData('text/plain'));
        }
        if (isFinite(da) && da !== i) sposta(elenco, da, i, ridisegna);
      });

      contenitore.appendChild(box);
    });
  }

  /* numero d'ordine contando solo le voci non escluse */
  function numeroInProgramma(elenco, indice) {
    var n = 0;
    for (var i = 0; i <= indice; i++) if (!elenco[i].escluso) n++;
    return n;
  }

  function sposta(elenco, da, a, ridisegna) {
    if (da === a || da < 0 || a < 0 || da >= elenco.length || a >= elenco.length) return;
    var v = elenco.splice(da, 1)[0];
    elenco.splice(a, 0, v);
    ridisegna();
    salvaBozzaFraPoco();
  }

  function disegnaEditGiochi() {
    var lista = V(DATI.giochi, []);
    elencoOrdinabile($('editGiochi'), lista, function (det, g) {
      var gr = crea('div', 'griglia3');
      gr.appendChild(campoMini('Nome', g.nome, function (v) { g.nome = v; disegnaEditGiochi(); }));
      gr.appendChild(campoMini('Orario', g.orario, function (v) { g.orario = v; }));
      gr.appendChild(campoMini('Durata (minuti)', g.durata, function (v) {
        g.durata = Number(v) || 0; contaGiochi();
      }));
      gr.appendChild(campoMini('Chi partecipa', g.partecipanti, function (v) { g.partecipanti = v; }));
      det.appendChild(gr);
      det.appendChild(areaMini('Descrizione', g.descrizione, function (v) { g.descrizione = v; }));
      det.appendChild(areaMini('Regole (una per riga)', V(g.regole, []).join('\n'), function (v) { g.regole = righe(v); }));
      det.appendChild(areaMini('Varianti (una per riga)', V(g.varianti, []).join('\n'), function (v) { g.varianti = righe(v); }));
    }, disegnaEditGiochi);
    contaGiochi();
    disegnaEditMusica();
  }

  function contaGiochi() {
    var lista = V(DATI.giochi, []);
    var inProg = lista.filter(function (g) { return !g.riserva && !g.escluso; });
    var ris = lista.filter(function (g) { return g.riserva && !g.escluso; });
    var esc = lista.filter(function (g) { return g.escluso; });
    var el = $('conteggiGiochi');
    if (el) {
      el.textContent = '';
      el.appendChild(etichettaConteggio('✅ in programma', inProg.length));
      el.appendChild(etichettaConteggio('🔄 di riserva', ris.length));
      el.appendChild(etichettaConteggio('🚫 esclusi', esc.length));
    }
    var min = 0;
    inProg.forEach(function (g) { min += Number(g.durata) || 0; });
    var ore = Math.floor(min / 60), resto = min % 60;
    var ev = V(DATI.evento, {});
    var finestra = minutiFra(V(ev.orario, ''), V(ev.orarioFine, ''));
    var t = $('durataTotale');
    if (t) {
      t.textContent = (ore ? ore + 'h ' : '') + resto + ' min' +
        (finestra ? (min > finestra
          ? ' — più delle ' + Math.round(finestra / 60) + ' ore dell\'evento: sposta qualche gioco «di riserva»'
          : ' — ci sta nelle ' + Math.round(finestra / 60) + ' ore dell\'evento') : '');
      t.style.color = (finestra && min > finestra) ? '#a30f1a' : '';
    }
  }
  function etichettaConteggio(testoEti, n) {
    var s = crea('span');
    s.appendChild(crea('b', null, String(n)));
    s.appendChild(document.createTextNode(' ' + testoEti));
    return s;
  }
  function minutiFra(a, b) {
    var pa = String(a).split(':'), pb = String(b).split(':');
    if (pa.length < 2 || pb.length < 2) return 0;
    var m = (Number(pb[0]) * 60 + Number(pb[1])) - (Number(pa[0]) * 60 + Number(pa[1]));
    return isFinite(m) && m > 0 ? m : 0;
  }

  function disegnaEditTornei() {
    var lista = V(DATI.tornei, []);
    elencoOrdinabile($('editTornei'), lista, function (det, t) {
      var gr = crea('div', 'griglia3');
      gr.appendChild(campoMini('Nome', t.nome, function (v) { t.nome = v; disegnaEditTornei(); }));
      gr.appendChild(campoMini('Blocco (A o B)', t.blocco, function (v) { t.blocco = String(v).toUpperCase(); }));
      gr.appendChild(campoMini('Orario', t.orario, function (v) { t.orario = v; }));
      gr.appendChild(campoMini('Posti', t.postiTotali, function (v) { t.postiTotali = Number(v) || 0; }));
      gr.appendChild(campoMini('Minuti a partita', t.durataPartita, function (v) { t.durataPartita = Number(v) || 0; }));
      /* nei tornei a più prove si sceglie con quale si gioca la finale */
      if (V(t.prove, []).length) {
        var d2 = crea('div', 'campo');
        var l2 = document.createElement('label');
        l2.textContent = 'Con quale prova si gioca la finale';
        d2.appendChild(l2);
        var sel = document.createElement('select');
        sel.className = 'mini';
        t.prove.forEach(function (pr) {
          var op = document.createElement('option');
          op.value = pr.id;
          op.textContent = V(pr.emoji, '') + ' ' + V(pr.nome, '');
          sel.appendChild(op);
        });
        sel.value = V(t.provaFinale, t.prove[t.prove.length - 1].id);
        sel.addEventListener('change', function () { t.provaFinale = sel.value; });
        d2.appendChild(sel);
        gr.appendChild(d2);
      }
      det.appendChild(gr);
      det.appendChild(areaMini('Descrizione', t.descrizione, function (v) { t.descrizione = v; }));
      det.appendChild(areaMini('Come si gioca la partita', t.partita, function (v) { t.partita = v; }));
      det.appendChild(areaMini('Regole (una per riga)', V(t.regole, []).join('\n'), function (v) { t.regole = righe(v); }));
      det.appendChild(areaMini('Varianti (una per riga)', V(t.varianti, []).join('\n'), function (v) { t.varianti = righe(v); }));
    }, disegnaEditTornei);

    var lista2 = V(DATI.tornei, []);
    var el = $('conteggiTornei');
    if (el) {
      el.textContent = '';
      el.appendChild(etichettaConteggio('✅ si giocano', lista2.filter(function (t) { return !t.escluso; }).length));
      el.appendChild(etichettaConteggio('🚫 esclusi', lista2.filter(function (t) { return t.escluso; }).length));
    }
  }

  function righe(v) {
    return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* raccoglie i contenuti leggendo PRIMA dai campi del modulo */
  function raccogli() {
    var d = JSON.parse(JSON.stringify(DATI));
    d.tema = d.tema || {};
    d.tema.titolo = $('c_titolo').value.trim();
    d.tema.sottotitolo = $('c_sotto').value.trim();
    d.tema.colorePrimario = $('c_col1').value.trim();
    d.tema.coloreSecondario = $('c_col2').value.trim();
    d.tema.coloreAccento = $('c_col3').value.trim();
    d.evento = d.evento || {};
    d.evento.data = $('c_data').value;
    d.evento.chiusuraIscrizioni = $('c_chiusura').value;
    d.evento.orario = $('c_ora').value.trim();
    d.evento.orarioFine = $('c_oraFine').value.trim();
    d.evento.luogo = $('c_luogo').value.trim();
    d.evento.descrizione = $('c_desc').value.trim();
    d.contatti = d.contatti || {};
    d.contatti.telefono = $('c_tel').value.trim();
    d.aree = d.aree || {};
    d.aree.ragazzi = d.aree.ragazzi || {};
    d.aree.adulti = d.aree.adulti || {};
    d.aree.ragazzi.postiTotali = Number($('c_postiRag').value) || 0;
    d.aree.adulti.postiTotali = Number($('c_postiAdu').value) || 0;
    d.quota = d.quota || {};
    d.quota.attiva = $('c_quotaAttiva').checked;
    d.quota.importo = Number($('c_quotaImporto').value) || 0;
    d.quota.etichetta = $('c_quotaEtichetta').value.trim();
    d.quota.spiegazione = $('c_quotaSpiega').value.trim();
    d.musicaAttiva = $('c_musicaAttiva').checked;
    d.notifiche = d.notifiche || {};
    d.notifiche.telegramBotToken = $('tg_token').value.trim();
    d.notifiche.telegramChatId = $('tg_chat').value.trim();
    d.sicurezza = righe($('c_sicurezza').value);
    d.regolamento = righe($('c_regolamento').value);
    d.foto = righe($('c_foto').value);
    d.programma = righe($('c_programma').value).map(function (r) {
      var p = r.split('|').map(function (x) { return x.trim(); });
      return { ora: p[0] || '', area: p[1] || 'tutti', titolo: p[2] || '', nota: p[3] || '' };
    }).filter(function (r) { return r.titolo; });
    /* giochi e tornei sono già stati modificati in DATI dai campi */
    d.giochi = DATI.giochi;
    d.tornei = DATI.tornei;
    return d;
  }

  function scaricaContenuti() {
    scaricaFile('contenuti.json', JSON.stringify(raccogli(), null, 2), 'application/json');
  }

  /* ====================== DIAGNOSI DEL DATABASE ========================
     Il messaggio che Firestore restituisce quando mancano le regole è
     «Missing or insufficient permissions»: giusto per un programmatore,
     inutile per chi deve organizzare una festa. Qui si controlla una per
     una ogni strada e si dice in italiano cosa è bloccato e come si aggiusta.
  */
  /* Da AGGIUNGERE alle regole esistenti, non da sostituire: parla solo di
     percorsi nuovi (iscrizioni, pubblico_certamen, stato_certamen), quindi
     non puo' toccare in nessun modo le regole della festa in piscina. */
  var REGOLE = [
    '    // ===================== CERTAMEN AQUATICUM =====================',
    '    // Blocco da aggiungere: riguarda solo percorsi nuovi e non modifica',
    '    // in alcun modo le regole gia presenti (prenotazioni, pubblico...).',
    '',
    '    // Chiunque puo iscriversi; nomi e recapiti si leggono solo col login.',
    '    match /iscrizioni/{id} {',
    '      allow create: if request.resource.data.nome is string',
    '                    && request.resource.data.nome.size() < 200',
    "                    && request.resource.data.area in ['ragazzi', 'adulti'];",
    '      allow read, update, delete: if request.auth != null;',
    '    }',
    '',
    '    // Solo quattro numeri: quanti iscritti per sezione. Nessun dato',
    '    // personale, e nessun altro campo puo essere aggiunto.',
    '    match /pubblico_certamen/contatore {',
    '      allow read: if true;',
    '      allow write: if request.auth != null',
    "                   || request.resource.data.keys().hasOnly(['ragazzi', 'adulti', 'italiana', 'burraco']);",
    '    }',
    '',
    '    // Classifiche e tabellone: li legge chiunque, li scrive solo',
    "    // l'organizzatore dopo il login.",
    '    match /pubblico_certamen/classifica {',
    '      allow read: if true;',
    '      allow write: if request.auth != null;',
    '    }',
    '',
    '    // Squadre, punteggi e tabelloni: contengono i nomi veri.',
    '    match /stato_certamen/{doc} {',
    '      allow read, write: if request.auth != null;',
    '    }',
    '    // =================== fine Certamen Aquaticum ==================='
  ].join('\n');

  function permessiNegati(e) {
    return /permission|insufficient|PERMISSION_DENIED/i.test(String(e && e.message ? e.message : e));
  }

  function diagnosi() {
    var el = $('esitoDiagnosi');
    el.textContent = '';
    el.appendChild(crea('li', null, '⏳ Controllo in corso…'));
    var mancanoRegole = false;

    function riga(testoRiga) {
      var li = crea('li', null, testoRiga);
      el.appendChild(li);
    }

    /* 1. il contatore pubblico, che deve leggere chiunque */
    FB.leggiContatori().then(function (c) {
      el.textContent = '';
      if (c) {
        riga('✅ Contatori pubblici leggibili: ' + V(c.ragazzi, 0) + ' ragazzi, ' +
          V(c.adulti, 0) + ' adulti.');
      } else {
        mancanoRegole = true;
        riga('⛔ I contatori pubblici non si leggono: la home mostrerà «—» invece dei numeri.');
      }
      /* 2. il registro delle iscrizioni, che serve il login */
      if (!SESS) {
        riga('ℹ️ Non sei collegato al database: entra qui sopra con email e password per controllare anche il registro.');
        chiudiDiagnosi(mancanoRegole);
        return;
      }
      return token().then(function (t) { return FB.elenco(t); })
        .then(function (lista) {
          riga('✅ Registro delle iscrizioni leggibile: ' + lista.length +
            (lista.length === 1 ? ' iscrizione trovata.' : ' iscrizioni trovate.'));
          return token().then(function (t) { return FB.leggiStato(t); })
            .then(function (s) {
              riga(s ? '✅ Squadre e punteggi leggibili.'
                : 'ℹ️ Squadre e punteggi non ancora salvati: normale se non hai ancora formato le squadre.');
              chiudiDiagnosi(mancanoRegole);
            });
        })
        .catch(function (e) {
          if (permessiNegati(e)) {
            mancanoRegole = true;
            riga('⛔ Il registro delle iscrizioni è bloccato: le iscrizioni che arrivano NON vengono salvate.');
          } else {
            riga('⚠️ Errore leggendo il registro: ' + e.message);
          }
          chiudiDiagnosi(mancanoRegole);
        });
    }).catch(function (e) {
      el.textContent = '';
      riga('⚠️ ' + e.message);
      chiudiDiagnosi(true);
    });
  }

  function chiudiDiagnosi(mancanoRegole) {
    var box = $('boxRegole');
    if (mancanoRegole) {
      box.style.display = '';
      $('regoleFirestore').value = REGOLE;
      $('esitoDiagnosi').appendChild(crea('li', null,
        '👉 Sotto trovi le regole da incollare: è l\'unica cosa che manca.'));
    } else {
      box.style.display = 'none';
      $('esitoDiagnosi').appendChild(crea('li', null, '🎉 Tutto collegato: non manca niente.'));
    }
  }

  /* ======================= AVVISI SU TELEGRAM ==========================
     A ogni iscrizione parte un messaggio al bot. Qui si controlla che
     funzioni davvero, senza aspettare la prima iscrizione vera.          */
  function provaTelegram() {
    var token = $('tg_token').value.trim();
    var chat = $('tg_chat').value.trim();
    if (!token || !chat) {
      testo('statoTg', '⚠️ Servono sia il token del bot sia l\'id della chat.');
      return;
    }
    var b = $('btnProvaTg');
    b.disabled = true;
    testo('statoTg', '⏳ Invio in corso…');
    var msg = '✅ Prova riuscita!\n\nQui arriveranno le iscrizioni al ' +
      V(V(DATI.tema, {}).titolo, 'Certamen Aquaticum') + '.\n' +
      'Ogni messaggio riporta nome, sezione, recapito e i totali aggiornati.';
    fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg })
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          testo('statoTg', '✅ Messaggio inviato: controlla Telegram. Se hai cambiato token o id, ricordati di premere «Pubblica contenuti.json» per attivarli sul sito.');
          salvaBozzaFraPoco();
        } else {
          testo('statoTg', '⚠️ Telegram risponde: ' + ((j && j.description) || 'errore') +
            '. Controlla token e id, e che tu abbia già scritto almeno una volta al bot.');
        }
      })
      .catch(function (e) { testo('statoTg', '⚠️ Non riesco a contattare Telegram: ' + e.message); })
      .then(function () { b.disabled = false; });
  }

  /* Legge gli ultimi messaggi ricevuti dal bot e ne ricava gli id delle chat:
     è il modo più semplice per sapere dove deve scrivere. */
  function chiId() {
    var token = $('tg_token').value.trim();
    if (!token) { testo('statoTg', '⚠️ Prima incolla il token del bot.'); return; }
    testo('statoTg', '⏳ Guardo chi ha scritto al bot…');
    fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=20')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) {
          testo('statoTg', '⚠️ Telegram risponde: ' + ((j && j.description) || 'errore'));
          return;
        }
        var visti = {};
        (j.result || []).forEach(function (u) {
          var c = (u.message && u.message.chat) || (u.channel_post && u.channel_post.chat);
          if (!c) return;
          visti[c.id] = (c.title || ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.username || 'chat') +
            ' (' + c.type + ')';
        });
        var chiavi = Object.keys(visti);
        if (!chiavi.length) {
          testo('statoTg', 'Nessun messaggio recente. Apri Telegram, scrivi qualcosa al bot (o nel gruppo dove lo hai aggiunto) e riprova.');
          return;
        }
        testo('statoTg', 'Chat trovate: ' + chiavi.map(function (k) { return visti[k] + ' → ' + k; }).join(' · ') +
          '. Copia l\'id giusto nel campo qui sopra.');
      })
      .catch(function (e) { testo('statoTg', '⚠️ ' + e.message); });
  }

  /* ===================== BOZZA DELLE MODIFICHE =========================
     Quello che scrivo nella scheda «Contenuti» resta solo in questa pagina
     finché non lo pubblico. Se chiudo il browser, se manca il token o se
     ricarico per sbaglio, senza questa rete perderei tutto: qui la bozza
     viene salvata da sola e alla riapertura mi viene offerta indietro.    */
  var CHIAVE_BOZZA = 'ca_contenuti_bozza';
  var timerBozza = null;

  function salvaBozzaFraPoco() {
    if (!CARICATO) return;
    if (timerBozza) clearTimeout(timerBozza);
    timerBozza = setTimeout(salvaBozza, 800);
  }
  function salvaBozza() {
    if (!CARICATO) return;
    try {
      var d = raccogli();
      CA.memScrivi(CHIAVE_BOZZA, JSON.stringify({ quando: new Date().toISOString(), dati: d }));
      var a = $('avvisoBozza');
      if (a && a.style.display === 'none') mostraAvvisoBozza(true);
    } catch (e) { /* se qualcosa va storto la bozza si salta, non blocco il lavoro */ }
  }
  function leggiBozza() {
    try {
      var b = JSON.parse(CA.memLeggi(CHIAVE_BOZZA) || 'null');
      return (b && b.dati) ? b : null;
    } catch (e) { return null; }
  }
  function buttaBozza() {
    CA.memCancella(CHIAVE_BOZZA);
    var a = $('avvisoBozza');
    if (a) a.style.display = 'none';
  }
  function mostraAvvisoBozza(appenaSalvata) {
    var b = leggiBozza();
    var a = $('avvisoBozza');
    if (!a || !b) return;
    var q = new Date(b.quando);
    a.style.display = '';
    testo('testoBozza', appenaSalvata
      ? 'Le tue modifiche sono al sicuro in questo browser. Diventano visibili sul sito solo quando premi «Pubblica contenuti.json».'
      : ('Ci sono modifiche salvate il ' + q.getDate() + '/' + (q.getMonth() + 1) + ' alle ' +
        due(q.getHours()) + ':' + due(q.getMinutes()) + ' che non sono mai state pubblicate.'));
    var rip = $('btnRiprendiBozza');
    if (rip) rip.style.display = appenaSalvata ? 'none' : '';
  }

  function riprendiBozza() {
    var b = leggiBozza();
    if (!b) return;
    DATI = b.dati;
    riempiContenuti();
    CA.toast('📝 Modifiche riprese. Ora premi «Pubblica contenuti.json».', 7000);
    mostraAvvisoBozza(true);
  }

  /* c'è una bozza diversa da quello che è online? */
  function controllaBozza() {
    var b = leggiBozza();
    if (!b) return;
    var uguale = JSON.stringify(b.dati) === JSON.stringify(DATI);
    if (uguale) { buttaBozza(); return; }
    mostraAvvisoBozza(false);
  }

  /* ---- GitHub ---- */
  function gh() {
    var s = {};
    try { s = JSON.parse(CA.memLeggi('ca_gh') || '{}'); } catch (e) { s = {}; }
    function campo(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
    return {
      owner: campo('gh_owner') || s.owner || 'Johannes1979I',
      repo: campo('gh_repo') || s.repo || 'certamen-aquaticum',
      branch: campo('gh_branch') || s.branch || 'main',
      token: campo('gh_token') || s.token || ''
    };
  }
  function salvaGh() {
    CA.memScrivi('ca_gh', JSON.stringify(gh()));
    CA.toast('Impostazioni GitHub salvate in questo browser.', 4000);
  }
  function caricaGh() {
    try {
      var s = JSON.parse(CA.memLeggi('ca_gh') || '{}');
      if (s.owner) $('gh_owner').value = s.owner;
      if (s.repo) $('gh_repo').value = s.repo;
      if (s.branch) $('gh_branch').value = s.branch;
      if (s.token) $('gh_token').value = s.token;
    } catch (e) { }
  }
  function b64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /* Se manca il token non basta dirlo: apro la sezione giusta, ci porto
     l'utente e metto il cursore nel campo. Le sue modifiche intanto restano
     salvate come bozza, così non si perde niente. */
  function chiediGh() {
    var det = $('dettagliGh');
    if (det) det.open = true;
    var card = $('sec-github');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { try { $('gh_token').focus(); } catch (e) { } }, 500);
    CA.toast('🔑 Manca il token di GitHub: seguendo i tre passi qui sopra ci vuole un minuto. Le tue modifiche sono salvate, non le perdi.', 12000);
  }

  function ghPut(path, contenutoB64, messaggio) {
    var s = gh();
    if (!s.owner || !s.repo || !s.token) {
      chiediGh();
      return Promise.reject(new Error('Manca il token di GitHub: incollalo nella sezione «Collegamento a GitHub» qui sopra.'));
    }
    var api = 'https://api.github.com/repos/' + s.owner + '/' + s.repo + '/contents/' + path;
    /* niente intestazione Cache-Control: GitHub non la accetta nel CORS e la
       chiamata fallirebbe con «Failed to fetch». Basta il parametro _=… */
    var headers = { 'Authorization': 'Bearer ' + s.token, 'Accept': 'application/vnd.github+json' };

    function sha() {
      return fetch(api + '?ref=' + encodeURIComponent(s.branch) + '&_=' + Date.now(),
        { headers: headers, cache: 'no-store' })
        .then(function (r) {
          if (r.ok) return r.json().then(function (j) { return j.sha; });
          if (r.status === 404) return undefined;
          return r.text().then(function (t) { throw new Error('GitHub ' + r.status + ': ' + t); });
        });
    }
    function invia(sh) {
      return fetch(api, {
        method: 'PUT', headers: headers,
        body: JSON.stringify({ message: messaggio, content: contenutoB64, branch: s.branch, sha: sh })
      });
    }
    /* il 409 vuol dire che qualcun altro ha scritto nel frattempo:
       si rilegge lo sha e si riprova, fino a quattro volte */
    return sha().then(function (sh) {
      return invia(sh).then(function tentativo(res) {
        var giri = 0;
        function riprova(r) {
          if (r.status !== 409 || giri >= 4) return r;
          giri++;
          return new Promise(function (ok) { setTimeout(ok, 400); })
            .then(sha).then(invia).then(riprova);
        }
        return riprova(res);
      });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('GitHub ' + res.status + ': ' + t); });
      return res.json();
    });
  }

  function pubblicaContenuti() {
    if (!CARICATO) {
      CA.toast('⚠️ Non ho letto i contenuti attuali: non pubblico, rischierei di svuotare il sito.', 9000);
      return;
    }
    var d = raccogli();
    CA.toast('Pubblicazione in corso…', 30000);
    ghPut('contenuti.json', b64(JSON.stringify(d, null, 2)), 'Aggiorna contenuti Certamen Aquaticum')
      .then(function () {
        DATI = d;
        buttaBozza();      /* pubblicato: la bozza non serve più */
        CA.toast('✅ Pubblicato! Il sito si aggiorna fra 30-60 secondi. Ricordati di premere ⌘⇧R.', 9000);
      })
      .catch(function (e) { CA.toast('⚠️ ' + e.message, 10000); });
  }

  /* =============================== STAMPE ============================= */
  function apriFoglio(titolo, nodo) {
    var c = $('foglioCorpo');
    c.textContent = '';
    var h = crea('h1', null, titolo);
    h.style.cssText = 'font-size:1.5rem;margin-bottom:4px';
    c.appendChild(h);
    var s = crea('p', null, V(V(DATI.tema, {}).titolo, '') + ' — ' +
      CA.dataIt(V(DATI.evento, {}).data, true));
    s.style.cssText = 'color:#5a7583;margin-bottom:16px';
    c.appendChild(s);
    c.appendChild(nodo);
    $('foglio').classList.add('aperto');
  }
  function chiudiFoglio() { $('foglio').classList.remove('aperto'); }

  function tabella(intestazioni, righeDati) {
    var t = document.createElement('table');
    var th = document.createElement('thead');
    var tr = document.createElement('tr');
    intestazioni.forEach(function (x) {
      var c = document.createElement('th'); c.textContent = x; tr.appendChild(c);
    });
    th.appendChild(tr); t.appendChild(th);
    var tb = document.createElement('tbody');
    righeDati.forEach(function (r) {
      var row = document.createElement('tr');
      r.forEach(function (v) {
        var td = document.createElement('td'); td.textContent = String(v == null ? '' : v); row.appendChild(td);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    return t;
  }

  function stampa(quale) {
    if (quale === 'accoglienza') {
      var righeA = attive().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (p) {
          return [p.nome, p.area === 'ragazzi' ? 'Ragazzi' : (p.gruppo === 'burraco' ? 'Burraco' : 'All\'italiana'),
            p.codice, p.telefono || '', p.appartamento || '', '☐'];
        });
      apriFoglio('Elenco iscritti — accoglienza',
        tabella(['Nome', 'Sezione', 'Pass', 'Telefono', 'Appartamento', 'Presente'], righeA));
      return;
    }
    if (quale === 'squadre') {
      var box = crea('div');
      if (!STATO.squadre.length) box.appendChild(crea('p', null, 'Nessuna squadra formata.'));
      STATO.squadre.forEach(function (s) {
        var h = crea('h2', null, s.nome + (s.motto ? ' — « ' + s.motto + ' »' : ''));
        h.style.cssText = 'margin-top:18px;font-size:1.15rem';
        box.appendChild(h);
        box.appendChild(tabella(['Componente', 'Età', 'In acqua', 'Ruolo'],
          s.componenti.map(function (id) {
            var p = perId(id);
            return [p ? p.nome : '—', p ? p.eta : '', p ? etichettaNuoto(p.nuoto) : '',
              s.capitano === id ? 'CAPITANO' : ''];
          })));
      });
      apriFoglio('Le squadre', box);
      return;
    }
    if (quale === 'tabelloni') {
      var b2 = crea('div');
      var trovato = false;
      torneiAttivi().forEach(function (t) {
        var st = STATO.tornei[t.id] || {};
        if (!V(st.incontri, []).length) return;
        trovato = true;
        var h = crea('h2', null, t.nome);
        h.style.cssText = 'margin-top:18px;font-size:1.15rem';
        b2.appendChild(h);
        b2.appendChild(tabella(['Turno', 'Tavolo', 'Coppia', 'Punti', 'Punti', 'Coppia'],
          V(st.incontri, []).map(function (m) {
            return [m.turno, m.tavolo, nomeCoppia(m.a, V(st.coppie, [])),
              V(m.puntiA, '____'), V(m.puntiB, '____'), nomeCoppia(m.b, V(st.coppie, []))];
          })));
      });
      if (!trovato) b2.appendChild(crea('p', null, 'Nessun tabellone generato.'));
      apriFoglio('Tabelloni dei tornei', b2);
      return;
    }
    if (quale === 'classifiche') {
      var b3 = crea('div');
      var h1 = crea('h2', null, 'Giochi in acqua — classifica generale');
      h1.style.cssText = 'font-size:1.15rem;margin-top:10px';
      b3.appendChild(h1);
      b3.appendChild(tabella(['#', 'Squadra', 'Capitano', 'Punti'],
        classificaRagazzi().map(function (r, i) {
          var sq = STATO.squadre.filter(function (s) { return s.id === r.id; })[0];
          var cap = sq ? perId(sq.capitano) : null;
          return [i + 1, r.nome, cap ? cap.nome : '', r.punti];
        })));
      torneiAttivi().forEach(function (t) {
        var cl = classificaTorneo(t.id);
        if (!cl.length) return;
        var h = crea('h2', null, t.nome);
        h.style.cssText = 'margin-top:18px;font-size:1.15rem';
        b3.appendChild(h);
        b3.appendChild(tabella(['#', 'Coppia', 'G', 'V', 'N', 'P', 'Punti'],
          cl.map(function (r, i) { return [i + 1, r.coppia, r.g, r.v, r.n, r.p, r.punti]; })));
      });
      apriFoglio('Classifiche', b3);
      return;
    }
    if (quale === 'programma') {
      apriFoglio('Programma del pomeriggio',
        tabella(['Ora', 'Chi', 'Cosa', 'Nota'],
          V(DATI.programma, []).map(function (r) {
            return [r.ora, r.area === 'ragazzi' ? 'Ragazzi' : (r.area === 'adulti' ? 'Adulti' : 'Tutti'),
              r.titolo, r.nota || ''];
          })));
    }
  }
})();
