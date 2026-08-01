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
    return {
      squadre: [], configSquadre: {}, risultati: {}, titoli: [], tornei: {}, bonus: {},
      cronometro: cronometroVuoto()
    };
  }
  function cronometroVuoto() {
    return { gioco: '', minuti: 0, avvio: 0, consumato: 0, suonato: false };
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
    $('nomeOperatore').addEventListener('change', function () {
      var v = this.value.trim();
      if (v) { CA.memScrivi('ca_operatore', v); CA.toast('👤 Ti firmerai come «' + v + '».', 4000); }
      else { CA.memCancella('ca_operatore'); }
    });

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
    var NOTE_PREF = {
      poco: 'Tengo insieme solo chi si è scelto a vicenda, e a coppie. Le richieste a senso unico cedono il passo all\'equilibrio.',
      medio: 'Rispetto anche le richieste a senso unico, con gruppetti fino a tre, purché le squadre restino equilibrate.',
      molto: 'Rispetto tutte le richieste e lascio crescere i gruppi: le squadre possono venire meno equilibrate.'
    };
    function notaPref() { testo('sqPrefNota', NOTE_PREF[$('sqPreferenze').value] || ''); }
    $('sqPreferenze').addEventListener('change', notaPref);
    notaPref();
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
    $('cronGioco').addEventListener('change', function () { scegliGiocoCron(this.value); });
    /* Col telefono in tasca o la pagina in secondo piano il browser rallenta
       i timer fino a un giro al minuto: il conto resta giusto (si calcola
       dall'orario di avvio) ma la sirena arriverebbe in ritardo. Appena si
       riguarda lo schermo si ricontrolla subito. */
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tic(); });
    window.addEventListener('focus', tic);
    $('btnCronVia').addEventListener('click', avviaCron);
    $('btnCronPausa').addEventListener('click', pausaCron);
    $('btnCronAzzera').addEventListener('click', azzeraCron);
    $('btnCronZitto').addEventListener('click', zittisci);

    $('btnSalvaGh').addEventListener('click', salvaGh);
    /* il token si scrive una volta e non si rilegge più: ma per passarlo al
       telefono bisogna poterlo vedere e copiare */
    $('btnVediToken').addEventListener('click', function () {
      var c = $('gh_token'), nascosto = c.type === 'password';
      c.type = nascosto ? 'text' : 'password';
      $('btnVediToken').textContent = nascosto ? '🙈 Nascondi' : '👁️ Mostra';
    });
    $('btnCopiaToken').addEventListener('click', function () {
      var c = $('gh_token');
      if (!c.value) { CA.toast('Non c\'è nessun token da copiare in questo browser.', 5000); return; }
      var prima = c.type; c.type = 'text';
      c.select(); c.setSelectionRange(0, 99999);
      var fatto = false;
      try { fatto = document.execCommand('copy'); } catch (e) { }
      c.type = prima;
      CA.toast(fatto ? '📋 Token copiato: incollalo nell\'admin del telefono, poi cancella il messaggio.'
        : '⚠️ Non riesco a copiarlo da solo: premi 👁️ Mostra e copialo a mano.', 8000);
    });
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

    /* anteprima dell'avviso in cima al sito */
    $('btnProvaAvviso').addEventListener('click', function () {
      var box = $('antepAvviso');
      box.textContent = '';
      if (!$('c_avvisoAttivo').checked || !$('c_avvisoTesto').value.trim()) {
        box.appendChild(crea('p', 'aiuto', 'L\'avviso è spento, oppure non hai ancora scritto il testo: sul sito non comparirebbe niente.'));
        return;
      }
      var d = crea('div', 'avviso-sito ' + $('c_avvisoTipo').value);
      var dentro = crea('div', 'avviso-dentro');
      var t = $('c_avvisoTipo').value;
      dentro.appendChild(crea('span', 'segno', t === 'allarme' ? '⛔' : (t === 'attenzione' ? '⚠️' : 'ℹ️')));
      var box2 = crea('div');
      if ($('c_avvisoTitolo').value.trim()) box2.appendChild(crea('b', null, $('c_avvisoTitolo').value.trim()));
      box2.appendChild(crea('span', null, $('c_avvisoTesto').value.trim()));
      dentro.appendChild(box2);
      d.appendChild(dentro);
      box.appendChild(d);
      box.appendChild(crea('p', 'aiuto', 'Ricordati di premere «Pubblica contenuti.json»: finché non lo fai, sul sito non si vede.'));
    });

    /* avvisi su Telegram */
    $('btnProvaTg').addEventListener('click', provaTelegram);
    $('btnChiId').addEventListener('click', chiId);

    /* invito da far girare: i pulsanti mandano esattamente quello che si legge
       nel riquadro, anche se lo modifico a mano */
    $('msgInvito').value = CA.messaggioInvito();
    function aggiornaLinkInvito() {
      var t = $('msgInvito').value;
      $('admWa').href = CA.linkWhatsApp(t);
      $('admTg').href = CA.linkTelegram(t);
    }
    aggiornaLinkInvito();
    $('msgInvito').addEventListener('input', aggiornaLinkInvito);

    /* Se cambi i contenuti, ricordati di rifare l'immagine di anteprima:
       è quella che le app mostrano sopra al messaggio. */
    testo('admSpiegaCond', 'L\'immagine in testa al messaggio è ' +
      'images/anteprima-social.jpg. Se cambi data, titolo o luogo, rigenerala ' +
      'dalla pagina della locandina, altrimenti resta quella vecchia.');

    /* mandare la locandina come file vero: solo dove il telefono lo permette */
    if (window.LOC && LOC.sannoFarlo()) {
      $('admCondividi').style.display = '';
      $('admCondividi').addEventListener('click', function () {
        var b = this, prima = b.textContent;
        b.disabled = true;
        b.textContent = '⏳ Preparo la locandina…';
        LOC.condividi().then(function (esito) {
          if (esito === 'scaricata') {
            CA.toast('⬇️ Locandina scaricata e messaggio copiato: aprili in WhatsApp o Telegram e allega l\'immagine.', 11000);
          }
        }).catch(function (e) {
          CA.toast('⚠️ Non riesco a condividere: ' + e.message, 8000);
        }).then(function () {
          b.disabled = false;
          b.textContent = prima;
        });
      });
    }
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

    /* album: scatto dalla fotocamera o scelta dalla galleria */
    $('btnScatta').addEventListener('click', function () { $('fileScatto').click(); });
    $('btnCaricaFoto').addEventListener('click', function () { $('fileFoto').click(); });
    function daiFile(ev) {
      var elenco = [].slice.call(ev.target.files || []);
      ev.target.value = '';
      if (!elenco.length) return;
      /* una alla volta, così il telefono non si strozza. Il .catch finale è
         importante: senza, un errore qui dentro sparirebbe in silenzio e il
         pulsante sembrerebbe non fare niente. */
      elenco.reduce(function (fila, f) {
        return fila.then(function () { return aggiungiFoto(f); });
      }, Promise.resolve()).catch(function (e) {
        testo('statoFoto', '⚠️ Non sono riuscito a caricare la foto: ' + e.message);
        CA.toast('⚠️ ' + e.message, 8000);
      });
    }
    $('fileScatto').addEventListener('change', daiFile);
    $('fileFoto').addEventListener('change', daiFile);
    /* l'interruttore vale subito sul sito, non solo alla prossima pubblicazione */
    $('c_albumAttivo').addEventListener('change', function () {
      ALBUM_ACCESO = $('c_albumAttivo').checked;
      if (!SESS) return;
      salvaAlbum().then(function () {
        testo('statoFoto', ALBUM_ACCESO
          ? '👀 Album acceso: si vede subito sul sito.'
          : '🙈 Album spento: le foto restano qui ma nessuno le vede.');
      }).catch(function (e) { testo('statoFoto', '⚠️ ' + e.message); });
    });
    $('btnConsolidaAlbum').addEventListener('click', function () {
      var righeVecchie = righe($('c_albumFoto').value);
      ALBUM.forEach(function (f) {
        var riga = V(f.file, f.url) + (f.didascalia ? ' | ' + f.didascalia : '');
        if (righeVecchie.indexOf(riga) < 0) righeVecchie.push(riga);
      });
      $('c_albumFoto').value = righeVecchie.join('\n');
      salvaBozzaFraPoco();
      CA.toast('📥 Foto travasate nei contenuti: ora premi «Pubblica contenuti.json» per conservarle.', 9000);
    });

    /* copia di sicurezza */
    $('btnCopiaSicurezza').addEventListener('click', scaricaCopiaSicurezza);
    $('btnLeggiCopia').addEventListener('click', function () { $('fileCopia').click(); });
    $('fileCopia').addEventListener('change', leggiCopiaSicurezza);

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

    /* il registro delle iscrizioni si rilegge ogni minuto; squadre, punteggi
       e tabelloni ogni dieci secondi, per stare dietro agli altri operatori */
    setInterval(function () {
      if (document.hidden || STOSCRIVENDO || !SESS) return;
      ricarica(false);
    }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && SESS && !STOSCRIVENDO) ricarica(false);
    });
  }

  /* ============================== LOGIN ================================ */
  /* Il nome con cui mi firmo sulle modifiche: serve agli altri operatori per
     sapere chi ha toccato cosa. Si può cambiare dal cruscotto. */
  function chiSono() {
    return CA.memLeggi('ca_operatore') ||
      (SESS && SESS.email ? String(SESS.email).split('@')[0] : 'organizzatore');
  }

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
    if (inSospeso && !confirm('Ci sono ancora dati non mandati al database. Esco lo stesso? Li ritroverai alla prossima entrata.')) return;
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
    $('nomeOperatore').value = chiSono();
    ricarica(false).then(function () {
      avviaSincronizzazione();
      mostraOperatori();
      caricaAlbum();
    });
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
      return Promise.all([FB.elenco(t), FB.leggiPezzi(t), FB.leggiStato(t)]);
    }).then(function (r) {
      ISCR = (r[0] || []).map(leggiIscrizione).filter(Boolean);
      ISCR.sort(function (a, b) { return String(a.creatoIl) < String(b.creatoIl) ? 1 : -1; });

      var pezzi = r[1] || {};
      var vecchio = r[2];
      if (!Object.keys(pezzi).length && vecchio) {
        /* prima volta dopo il passaggio ai documenti separati: si legge quello
           vecchio, tutto in uno, e al primo salvataggio si spezza da solo */
        STATO = {
          squadre: V(vecchio.squadre, []), configSquadre: V(vecchio.configSquadre, {}),
          risultati: V(vecchio.risultati, {}), titoli: V(vecchio.titoli, []),
          tornei: V(vecchio.tornei, {}), bonus: V(vecchio.bonus, {})
        };
        BASE = {};                       /* tutto da mandare, così si spezza */
      } else {
        Object.keys(pezzi).forEach(function (nome) {
          if (SPORCHI[nome]) return;            /* ho modifiche mie non ancora mandate */
          applicaPezzo(nome, pezzi[nome].dati);
          BASE[nome] = JSON.stringify(pezzi[nome].dati);
        });
        segnaChiHaToccato(pezzi);
      }
      allineaLocale();
      /* Se sul telefono era rimasto qualcosa da mandare, quello è più recente
         di quello che sta nel database: vale il telefono, e si riprova a
         mandarlo. È il caso della rete caduta a metà di un punteggio. */
      var coda = inCoda();
      if (coda) {
        STATO = coda.stato;
        inSospeso = true;
        var q = new Date(coda.quando);
        CA.toast('📴 Avevo dei dati rimasti sul telefono dalle ' +
          due(q.getHours()) + ':' + due(q.getMinutes()) + ': li rimando adesso.', 8000);
        salvaAdesso(false);
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

  /* ================ SINCRONIZZAZIONE FRA PIÙ OPERATORI ================
     Ogni dieci secondi si va a vedere se qualcun altro ha cambiato qualcosa.
     Regola: un pezzo che ho modificato io e non ho ancora mandato NON viene
     sovrascritto; tutti gli altri si aggiornano da soli. Così tre persone
     possono segnare punti insieme, ognuna sulla sua parte, e ognuna vede
     comparire quello che fanno gli altri.                                */
  var timerSincro = null, ULTIMI_TOCCHI = {};

  function segnaChiHaToccato(pezzi) {
    Object.keys(pezzi).forEach(function (nome) {
      ULTIMI_TOCCHI[nome] = { chi: pezzi[nome].chi, quando: pezzi[nome].quando };
    });
  }

  function sincronizza() {
    if (!SESS || document.hidden) return Promise.resolve();
    return token().then(function (t) { return FB.leggiPezzi(t); })
      .then(function (pezzi) {
        segnaSporchi();                 /* prima di tutto: cos'ho toccato io? */
        var novita = [];
        Object.keys(pezzi).forEach(function (nome) {
          var remoto = JSON.stringify(pezzi[nome].dati);
          if (remoto === BASE[nome]) return;                 /* niente di nuovo */
          if (SPORCHI[nome]) return;                         /* ci sto lavorando io */
          applicaPezzo(nome, pezzi[nome].dati);
          BASE[nome] = remoto;
          LOCALE[nome] = remoto;
          var chi = pezzi[nome].chi;
          if (chi && chi !== chiSono()) novita.push({ pezzo: nome, chi: chi });
        });
        segnaChiHaToccato(pezzi);
        if (novita.length) {
          disegnaTutto();
          var quali = novita.map(function (n) { return nomePezzo(n.pezzo); });
          var chi = novita[0].chi;
          CA.toast('🔄 ' + chi + ' ha aggiornato: ' + quali.join(', ') + '.', 6000);
          mostraOperatori();
        }
      })
      .catch(function () { /* rete assente: si riprova al giro dopo */ });
  }

  function nomePezzo(nome) {
    if (nome === 'squadre') return 'le squadre';
    if (nome === 'risultati') return 'i punteggi dei giochi';
    if (nome === 'titoli') return 'i premi';
    if (nome.indexOf('torneo_') === 0) {
      var t = torneoDati(nome.slice(7));
      return t.nome ? ('il torneo ' + t.nome) : 'un torneo';
    }
    return nome;
  }

  /* chi altro sta lavorando adesso, e su cosa */
  function mostraOperatori() {
    var el = $('altriOperatori');
    if (!el) return;
    el.textContent = '';
    var visti = {};
    Object.keys(ULTIMI_TOCCHI).forEach(function (nome) {
      var u = ULTIMI_TOCCHI[nome];
      if (!u.chi || u.chi === chiSono()) return;
      var q = new Date(u.quando);
      if (isNaN(q.getTime()) || Date.now() - q.getTime() > 30 * 60000) return;  /* più di mezz'ora fa */
      (visti[u.chi] = visti[u.chi] || []).push({ pezzo: nome, quando: q });
    });
    var nomi = Object.keys(visti);
    if (!nomi.length) {
      el.appendChild(crea('p', 'aiuto', 'In questo momento stai lavorando solo tu.'));
      return;
    }
    nomi.forEach(function (chi) {
      var ultimo = visti[chi].sort(function (a, b) { return b.quando - a.quando; })[0];
      var r = crea('div', 'riga-iscr');
      var c = crea('div', 'cnt');
      c.appendChild(crea('b', null, '👤 ' + chi));
      c.appendChild(crea('small', null, 'ultima modifica: ' + nomePezzo(ultimo.pezzo) +
        ', alle ' + due(ultimo.quando.getHours()) + ':' + due(ultimo.quando.getMinutes())));
      r.appendChild(c);
      el.appendChild(r);
    });
  }

  function avviaSincronizzazione() {
    if (timerSincro) return;
    timerSincro = setInterval(function () {
      if (STOSCRIVENDO) return;      /* non mentre sto battendo un punteggio */
      sincronizza();
    }, 10000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && SESS) sincronizza();
    });
    window.addEventListener('focus', function () { if (SESS) sincronizza(); });
  }

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
  /* ============== SALVATAGGIO CHE RESISTE ALLA RETE CHE SALTA ==========
     A bordo piscina il telefono prende male. Ogni modifica finisce PRIMA
     nella memoria del telefono e poi si prova a mandarla nel database: se
     la linea non c'è, resta in coda e riparte da sola appena torna. Così un
     punteggio non si perde nemmeno se si ricarica la pagina per sbaglio.  */
  var CHIAVE_CODA = 'ca_stato_da_mandare';
  var timerSalva = null, inSospeso = false, timerRiprova = null;

  /* ------------------- lo stato spezzato in pezzi ---------------------
     Ogni pezzo è un documento a sé nel database, così due operatori che
     lavorano su cose diverse non si pestano i piedi. BASE ricorda com'era
     ogni pezzo l'ultima volta che ci siamo parlati con il database: serve
     per capire cos'ho cambiato IO e cosa invece ha cambiato un altro.   */
  var BASE = {};                 /* pezzo -> testo com'era nel database */
  var LOCALE = {};               /* pezzo -> testo com'era da me un attimo fa */
  var SPORCHI = {};              /* i pezzi che ho cambiato IO e devo mandare */

  /* Segna quali pezzi ho toccato dall'ultima volta. È il cuore del lavoro a
     più mani: si manda solo quello che si è cambiato davvero. Confrontare col
     database non basterebbe — chi entra a metà pomeriggio si ritroverebbe i
     pezzi «diversi» solo perché non li aveva ancora letti, e li sovrascriverebbe
     con i propri, vuoti. */
  function segnaSporchi() {
    var ora = pezziLocali();
    Object.keys(ora).forEach(function (nome) {
      var testoOra = JSON.stringify(ora[nome]);
      if (LOCALE[nome] !== testoOra) SPORCHI[nome] = true;
    });
  }
  function allineaLocale() {
    var ora = pezziLocali();
    LOCALE = {};
    Object.keys(ora).forEach(function (nome) { LOCALE[nome] = JSON.stringify(ora[nome]); });
  }

  function pezziLocali() {
    var p = {
      squadre: {
        squadre: STATO.squadre,
        configSquadre: STATO.configSquadre,
        bonus: STATO.bonus
      },
      risultati: { risultati: STATO.risultati },
      titoli: { titoli: STATO.titoli },
      cronometro: { cronometro: STATO.cronometro }
    };
    Object.keys(STATO.tornei || {}).forEach(function (id) {
      p['torneo_' + id] = STATO.tornei[id];
    });
    return p;
  }

  function applicaPezzo(nome, dati) {
    if (!dati) return;
    if (nome === 'squadre') {
      STATO.squadre = V(dati.squadre, []);
      STATO.configSquadre = V(dati.configSquadre, {});
      STATO.bonus = V(dati.bonus, {});
    } else if (nome === 'risultati') {
      STATO.risultati = V(dati.risultati, {});
    } else if (nome === 'titoli') {
      STATO.titoli = V(dati.titoli, []);
    } else if (nome === 'cronometro') {
      STATO.cronometro = V(dati.cronometro, cronometroVuoto());
      disegnaCronometro();
    } else if (nome.indexOf('torneo_') === 0) {
      STATO.tornei = STATO.tornei || {};
      STATO.tornei[nome.slice(7)] = dati;
    }
  }

  function metti(stato) {
    try {
      CA.memScrivi(CHIAVE_CODA, JSON.stringify({ quando: new Date().toISOString(), stato: stato }));
    } catch (e) { /* memoria piena o navigazione privata: pazienza */ }
  }
  function inCoda() {
    try {
      var c = JSON.parse(CA.memLeggi(CHIAVE_CODA) || 'null');
      return (c && c.stato) ? c : null;
    } catch (e) { return null; }
  }
  function svuotaCoda() { CA.memCancella(CHIAVE_CODA); }

  function mostraSospeso(quanto) {
    var el = $('statoCloud');
    if (!el) return;
    if (quanto === 'ok') { testo('statoCloud', '✅ salvato nel database'); return; }
    if (quanto === 'coda') { testo('statoCloud', '⏳ da mandare quando torna la rete'); return; }
    if (quanto === 'invio') { testo('statoCloud', '📡 sto mandando…'); return; }
  }

  function salvaStato(conAvviso) {
    if (!SESS) { if (conAvviso) CA.toast('⚠️ Non sei collegato: non posso salvare.', 7000); return; }
    segnaSporchi();
    inSospeso = true;
    metti(STATO);                 /* prima al sicuro nel telefono, sempre */
    mostraSospeso('coda');
    if (timerSalva) clearTimeout(timerSalva);
    timerSalva = setTimeout(function () { salvaAdesso(conAvviso); }, conAvviso ? 0 : 600);
  }

  /* Manda SOLO i pezzi che ho cambiato io: se sto segnando il Burraco, il
     documento del Trittico non lo tocco nemmeno, e chi ci sta lavorando non
     si vede sovrascrivere niente. */
  function salvaAdesso(conAvviso) {
    if (!SESS) return;
    segnaSporchi();
    var locali = pezziLocali();
    var daMandare = [];
    Object.keys(SPORCHI).forEach(function (nome) {
      if (locali[nome] === undefined) return;
      daMandare.push({ nome: nome, dati: locali[nome], testo: JSON.stringify(locali[nome]) });
    });

    if (!daMandare.length) { inSospeso = false; svuotaCoda(); mostraSospeso('ok'); return; }

    mostraSospeso('invio');
    token().then(function (t) {
      return Promise.all(daMandare.map(function (p) {
        return FB.scriviPezzo(t, p.nome, p.dati, chiSono()).then(function () {
          BASE[p.nome] = p.testo;
          LOCALE[p.nome] = p.testo;
          delete SPORCHI[p.nome];
        });
      }));
    })
      .then(function () {
        inSospeso = false;
        svuotaCoda();
        mostraSospeso('ok');
        if (conAvviso) CA.toast('💾 Salvato nel database.', 4000);
        /* la bacheca pubblica segue da sola: chi guarda le classifiche dal
           telefono vede il punteggio nuovo senza che io prema niente */
        aggiornaBachecaSePuoi();
      })
      .catch(function (e) {
        inSospeso = true;
        if (permessiNegati(e)) {
          testo('statoCloud', '⛔ database bloccato');
          CA.toast('⛔ Non riesco a salvare: mancano le regole di sicurezza del database. Vai su 📊 Cruscotto → Stato del database.', 10000);
          return;
        }
        mostraSospeso('coda');
        if (conAvviso) {
          CA.toast('📴 Rete assente: ho tenuto tutto sul telefono e riprovo da solo appena torna.', 8000);
        }
        riprovaFraPoco();
      });
  }

  /* riprova ogni venti secondi finché non ce la fa */
  function riprovaFraPoco() {
    if (timerRiprova) return;
    timerRiprova = setInterval(function () {
      if (!inSospeso || !SESS) { clearInterval(timerRiprova); timerRiprova = null; return; }
      if (navigator.onLine === false) return;
      salvaAdesso(false);
    }, 20000);
  }

  /* appena il telefono ritrova la linea, si riparte senza aspettare */
  window.addEventListener('online', function () {
    if (inSospeso && SESS) {
      CA.toast('📶 È tornata la rete: mando quello che era rimasto in sospeso.', 6000);
      salvaAdesso(false);
    }
  });

  /* se chiudo o metto via il telefono mentre il salvataggio è ancora in coda,
     lo mando subito: mezzo secondo di ritardo non deve costare un punteggio */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && inSospeso) {
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
    return spezzaMessaggi(testoIntero).map(leggiUnMessaggio).filter(Boolean);
  }

  /* Separa più messaggi incollati di seguito. Si taglia sull'intestazione del
     bot, ma anche quando un campo si ripete: se ricompare «Nome:» vuol dire
     che è cominciata un'altra iscrizione. Serve perché copiando da Telegram
     l'intestazione spesso non viene, e senza questo taglio due messaggi si
     fondevano in una scheda sola con i dati mescolati: il nome di uno e il
     telefono dell'altro, senza che niente lo facesse sospettare. */
  function spezzaMessaggi(testoIntero) {
    var righe = String(testoIntero || '').split('\n');
    var blocchi = [], corrente = [], visto = {};
    function chiudi() {
      if (corrente.join('\n').trim().length) blocchi.push(corrente.join('\n'));
      corrente = []; visto = {};
    }
    righe.forEach(function (r) {
      var intestazione = /CERTAMEN AQUATICUM/i.test(r);
      var m = r.match(/^\s*(Sezione|Codice|Pass|Nome|Telefono)\s*:/i);
      var chiave = m ? m[1].toLowerCase() : '';
      if ((intestazione || (chiave && visto[chiave])) && /nome\s*:/i.test(corrente.join('\n'))) chiudi();
      if (chiave) visto[chiave] = true;
      corrente.push(r);
    });
    chiudi();
    return blocchi.filter(function (b) { return /nome\s*:/i.test(b); });
  }

  /* Da «Sezione: Il Trittico» al gruppo giusto. Si guardano prima i nomi veri
     che stanno nei contenuti, così se un torneo viene rinominato l'importatore
     continua a capirlo; le parole fisse sono solo la rete di sicurezza. */
  function gruppoDaSezione(sezione) {
    var s = String(sezione || '').toLowerCase().trim();
    if (!s) return '';
    var trovato = '';
    V(DATI.gruppiCarte, []).forEach(function (g) {
      if (!trovato && g.nome && s.indexOf(String(g.nome).toLowerCase()) >= 0) trovato = g.id;
    });
    V(DATI.tornei, []).forEach(function (t) {
      if (!trovato && t.nome && s.indexOf(String(t.nome).toLowerCase()) >= 0) trovato = V(t.gruppo, t.id);
    });
    if (trovato) return trovato;
    if (/burraco/.test(s)) return 'burraco';
    if (/italiana|trittico|scopone|briscola|tresette|carte/.test(s)) return 'italiana';
    return '';
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
    var gruppo = gruppoDaSezione(sezione);
    /* se la sezione non dice niente, lo dicono i campi: «Tornei» e
       «Esperienza» esistono solo per gli adulti, «Età» e «Genitore» solo
       per i ragazzi */
    if (!gruppo && (campi['tornei'] || campi['esperienza'] || campi['coppia'])) gruppo = 'italiana';
    var area = gruppo ? 'adulti' : 'ragazzi';

    var p = {
      nome: nome,
      area: area,
      gruppo: gruppo,
      sezione: sezione || (area === 'ragazzi' ? 'Giochi in acqua' : 'Tornei di carte'),
      codice: V(campi['codice'], V(campi['pass'], '')),
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
      CA.toast('🎲 Squadre generate: prima l\'equilibrio fra età e capacità in acqua, ' +
        'poi le preferenze (' + ESITO_PREFERENZE.fatte.length + ' rispettate).', 7000);
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
  var DESIDERI = [];        /* tutti i «vorrei stare con…» dichiarati */
  var SALTATI = {};         /* quelli gia' scartati prima di distribuire */

  /* ---------------------- quanto "pesa" un ragazzo ---------------------
     In acqua non conta l'età da sola: un diciassettenne che nuota bene vale
     molto più di un diciassettenne impacciato, e un bambino di otto anni in
     una staffetta pesa poco comunque sia. Questo numero mette insieme le due
     cose ed è quello che si cerca di pareggiare fra le squadre. */
  function forza(p) {
    var e = etaDi(p);
    var n = (p && p.nuoto === 'bene') ? 2 : ((p && p.nuoto === 'poco') ? -3 : 0);
    return e + n;
  }
  function forzaSquadra(s) {
    var t = 0;
    s.componenti.forEach(function (id) { t += forza(perId(id)); });
    return t;
  }
  function mediaForza(s) {
    return s.componenti.length ? forzaSquadra(s) / s.componenti.length : 0;
  }
  /* le due fasce che sbilanciano davvero una gara in piscina */
  function eGrande(p) { return etaDi(p) >= 15; }
  function ePiccolo(p) { return etaDi(p) <= 10; }

  /* Le squadre si fanno due volte: una tenendo insieme gli amici, una
     ignorandoli del tutto. Poi si guarda quale delle due è più equilibrata e
     si tiene quella. Serve perché una preferenza può costare carissimo — due
     bambini piccoli che si scelgono a vicenda finiscono nella stessa squadra
     e la affondano — e l'equilibrio, che è quello che rende la gara bella,
     deve venire prima. Con «Prima le preferenze» invece comanda l'amicizia:
     l'ha chiesto l'organizzatore e si fa così.                              */
  function distribuisciBilanciato(persone, squadre) {
    var n = squadre.length;
    var perSquadra = Math.ceil(persone.length / n);
    var livello = ($('sqPreferenze') || {}).value || 'poco';
    /* Quanto si lascia crescere un gruppo di amici. Più è grande, più vincola
       la distribuzione e più le squadre rischiano di sbilanciarsi: per questo
       di serie si sta stretti. */
    var maxGruppo = (livello === 'molto') ? Math.max(2, Math.floor(perSquadra / 2))
      : (livello === 'medio') ? 3 : 2;

    var capitaniPrima = squadre.map(function (s) { return s.capitano; });

    /* strada A: con gli amici insieme */
    var blocchiA = gruppiDiPreferenza(persone, maxGruppo, livello);
    var saltatePrima = ESITO_PREFERENZE.saltate.slice();
    var legatiA = LEGATI;
    var pianoA = eseguiPiano(squadre, blocchiA, perSquadra, capitaniPrima);
    var votoA = misuraPiano(squadre);

    /* strada B: ognuno per sé, le preferenze si lasciano cadere */
    LEGATI = {};
    var blocchiB = persone.map(function (p) { return { persone: [p], eta: etaDi(p) }; });
    var pianoB = eseguiPiano(squadre, blocchiB, perSquadra, capitaniPrima);
    var votoB = misuraPiano(squadre);

    /* Quanto squilibrio si accetta pur di tenere insieme gli amici: una
       inezia al livello prudente, di più se l'organizzatore l'ha chiesto. */
    var tolleranza = (livello === 'molto') ? Infinity : (livello === 'medio' ? 1.5 : 0.5);
    var tieniA = punteggioPiano(votoA) <= punteggioPiano(votoB) + tolleranza;

    LEGATI = tieniA ? legatiA : {};
    applicaPiano(squadre, tieniA ? pianoA : pianoB);
    scegliCapitani(squadre);
    verificaPreferenze(squadre, saltatePrima, livello);
  }

  /* Una passata sola: piazza i blocchi e riequilibra. Restituisce com'è
     venuta, così se ne possono confrontare due senza rifare i conti. */
  function eseguiPiano(squadre, blocchi, perSquadra, capitaniPrima) {
    var n = squadre.length;
    squadre.forEach(function (s, i) { s.componenti = []; s.capitano = capitaniPrima[i]; });

    /* Si parte dai blocchi più pesanti e ognuno va nella squadra che finora
       pesa di meno. È il modo più semplice per non far finire due ragazzoni
       nella stessa squadra: prima si piazzano loro, poi i piccoli riempiono.
       (Prima invece mettevo per primi i gruppi di amici, nella squadra più
       vuota, senza guardare l'età: da lì nascevano gli sbilanciamenti.) */
    blocchi.forEach(function (b) {
      b.forza = 0;
      b.persone.forEach(function (p) { b.forza += forza(p); });
    });
    blocchi.sort(function (a, b) {
      if (b.forza !== a.forza) return b.forza - a.forza;
      return b.persone.length - a.persone.length;
    });

    blocchi.forEach(function (b) {
      var scelta = -1, minimo = Infinity;
      for (var k = 0; k < n; k++) {
        if (squadre[k].componenti.length + b.persone.length > perSquadra) continue;
        var f = forzaSquadra(squadre[k]);
        if (f < minimo) { minimo = f; scelta = k; }
      }
      if (scelta < 0) {                       /* nessuna ha posto: la più leggera */
        scelta = 0;
        for (var k2 = 1; k2 < n; k2++) {
          if (forzaSquadra(squadre[k2]) < forzaSquadra(squadre[scelta])) scelta = k2;
        }
      }
      b.persone.forEach(function (p) { squadre[scelta].componenti.push(p._id); });
    });

    pareggiaDimensioni(squadre);
    /* le fasce prima di tutto: i grandi e i piccoli vanno spartiti, altrimenti
       una squadra parte già vinta anche se le medie tornano */
    pareggiaFascia(squadre, eGrande);
    pareggiaFascia(squadre, ePiccolo);
    pareggiaScaglioni(squadre);
    sparpagliaDeboli(squadre);
    affinaForza(squadre);
    return squadre.map(function (s) {
      return { componenti: s.componenti.slice(), capitano: s.capitano };
    });
  }

  function applicaPiano(squadre, piano) {
    squadre.forEach(function (s, i) {
      s.componenti = piano[i].componenti.slice();
      s.capitano = piano[i].capitano;
      /* il capitano deve stare nella sua squadra */
      if (s.capitano && s.componenti.indexOf(s.capitano) < 0) s.capitano = '';
    });
  }

  /* Quanto è venuta bene: quante volte una fascia è spartita male, e quanto
     ballano le forze medie. Meno è, meglio è. */
  function misuraPiano(squadre) {
    var violazioni = 0;
    [eGrande, ePiccolo, nuotaPoco].forEach(function (test) {
      var c = squadre.map(function (s) {
        return s.componenti.filter(function (id) { return test(perId(id)); }).length;
      });
      var d = Math.max.apply(null, c) - Math.min.apply(null, c);
      if (d > 1) violazioni += d - 1;
    });
    var m = squadre.map(mediaForza);
    return { violazioni: violazioni, scarto: Math.max.apply(null, m) - Math.min.apply(null, m) };
  }
  /* una fascia spartita male pesa più di qualsiasi differenza di forza */
  function punteggioPiano(v) { return v.violazioni * 100 + v.scarto; }

  /* Il resoconto dice la verità su come sono finite davvero le squadre, non
     su cosa si era provato a fare: si guarda chi è finito con chi. */
  function verificaPreferenze(squadre, saltatePrima, livello) {
    var dove = {};
    squadre.forEach(function (s, i) {
      s.componenti.forEach(function (id) { dove[id] = i; });
    });
    var fatte = [], saltate = saltatePrima.slice(), visti = {};
    DESIDERI.forEach(function (d) {
      if (d.sconosciuto) return;                     /* già spiegato prima */
      var k = [d.a._id, d.b._id].sort().join('|');
      if (visti[k]) return;
      visti[k] = true;
      if (dove[d.a._id] === undefined || dove[d.b._id] === undefined) return;
      if (dove[d.a._id] === dove[d.b._id]) {
        fatte.push(d.a.nome + ' con ' + d.b.nome + (d.reciproco ? ' (scelta reciproca)' : ''));
      } else if (!SALTATI[k]) {
        saltate.push(d.a.nome + ' con ' + d.b.nome +
          ': tenerli insieme sbilanciava le squadre, e ' +
          (livello === 'molto' ? 'non c\'era modo di sistemarle'
            : 'età e capacità in acqua vengono prima'));
      }
    });
    ESITO_PREFERENZE = { fatte: fatte, saltate: saltate };
  }

  /* Controllo di equità sulla fascia alta: mettendo tutti in fila dal più
     forte al più debole, fra i primi due deve essercene uno per squadra, fra
     i primi quattro due per squadra, e così via. È il modo per dire «nessuna
     squadra si prende i più forti»: senza, l'equilibrio dei totali si può
     ottenere anche caricando una squadra in cima e compensando in fondo. */
  function prefissiOk(squadre) {
    var n = squadre.length;
    if (n < 2) return true;
    var tutti = [];
    squadre.forEach(function (s, idx) {
      s.componenti.forEach(function (id) { tutti.push({ sq: idx, f: forza(perId(id)) }); });
    });
    tutti.sort(function (a, b) { return b.f - a.f; });
    var conta = [];
    for (var k = 0; k < n; k++) conta.push(0);
    /* si controlla solo la metà alta: chi si prende i più forti conta, come
       sono spartiti gli ultimi no, e pretenderlo bloccherebbe scambi utili */
    var finoA = Math.ceil(tutti.length / 2);
    for (var i = 0; i < tutti.length; i++) {
      conta[tutti[i].sq]++;
      if (i + 1 > finoA) break;
      if ((i + 1) % n === 0) {
        if (Math.max.apply(null, conta) - Math.min.apply(null, conta) > 1) return false;
      }
    }
    return true;
  }

  /* La regola che conta più di tutte.
     Si mettono tutti in fila dal più forte al più debole e li si divide in
     scaglioni grandi quanto il numero delle squadre: i primi due, i secondi
     due, e così via. Da ogni scaglione ogni squadra ne prende uno.
     Così i due ragazzi più forti non possono finire insieme, e nessuna
     squadra si prende tutta la fascia alta compensandola con un bambino
     piccolo — che è esattamente quello che era successo. */
  function pareggiaScaglioni(squadre) {
    var n = squadre.length;
    if (n < 2) return;

    var ordine = [];
    squadre.forEach(function (s, idx) {
      s.componenti.forEach(function (id) { ordine.push({ id: id, sq: idx, f: forza(perId(id)) }); });
    });
    ordine.sort(function (a, b) { return b.f - a.f; });
    var scaglione = {};
    ordine.forEach(function (x, i) { scaglione[x.id] = Math.floor(i / n); });

    function quanti(sc) {
      var c = [];
      for (var k = 0; k < n; k++) c.push(0);
      squadre.forEach(function (s, idx) {
        s.componenti.forEach(function (id) { if (scaglione[id] === sc) c[idx]++; });
      });
      return c;
    }

    var scaglioni = Math.ceil(ordine.length / n);
    for (var giro = 0; giro < 60; giro++) {
      var mosso = false;
      for (var sc = 0; sc < scaglioni; sc++) {
        var c = quanti(sc);
        var max = 0, min = 0;
        for (var i = 1; i < n; i++) {
          if (c[i] > c[max]) max = i;
          if (c[i] < c[min]) min = i;
        }
        if (c[max] - c[min] <= 1) continue;

        var daSpostare = squadre[max].componenti.filter(function (id) {
          return scaglione[id] === sc && !LEGATI[id];
        })[0];
        if (!daSpostare) continue;

        /* in cambio prendo qualcuno di uno scaglione dove è la squadra
           ricevente ad averne in eccesso: così si sistemano due cose insieme */
        var inCambio = null;
        squadre[min].componenti.forEach(function (id) {
          if (inCambio || LEGATI[id] || scaglione[id] === sc) return;
          var c2 = quanti(scaglione[id]);
          if (c2[min] > c2[max]) inCambio = id;
        });
        if (!inCambio) continue;

        scambia(squadre[max], squadre[min], daSpostare, inCambio);
        mosso = true;
      }
      if (!mosso) break;
    }
  }

  /* Fa in modo che ogni squadra abbia lo stesso numero di ragazzi di una
     fascia (i grandi, i piccoli): al massimo uno di scarto. Si scambia con
     qualcuno che NON è di quella fascia, così le dimensioni non cambiano. */
  function pareggiaFascia(squadre, appartiene) {
    for (var giro = 0; giro < 40; giro++) {
      var conta = squadre.map(function (s) {
        return s.componenti.filter(function (id) { return appartiene(perId(id)); }).length;
      });
      var max = 0, min = 0;
      for (var i = 1; i < conta.length; i++) {
        if (conta[i] > conta[max]) max = i;
        if (conta[i] < conta[min]) min = i;
      }
      if (conta[max] - conta[min] <= 1) return;
      var daSpostare = squadre[max].componenti.filter(function (id) {
        return appartiene(perId(id)) && !LEGATI[id];
      })[0];
      var inCambio = squadre[min].componenti.filter(function (id) {
        return !appartiene(perId(id)) && !LEGATI[id];
      })[0];
      if (!daSpostare || !inCambio) return;   /* solo gente legata: non si tocca */
      scambia(squadre[max], squadre[min], daSpostare, inCambio);
    }
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

  /* Mette insieme chi si è scelto, senza far crescere troppo i gruppi.
     Il livello dice quanto si va per il sottile:
       poco  → solo chi si è scelto a vicenda, a coppie (l'equilibrio comanda)
       medio → anche le richieste a senso unico, gruppi fino a tre
       molto → tutte le richieste, gruppi fino a mezza squadra              */
  function gruppiDiPreferenza(persone, maxGruppo, livello) {
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

    DESIDERI = desideri;
    SALTATI = {};
    function chiave(d) { return [d.a._id, d.b._id].sort().join('|'); }

    ESITO_PREFERENZE = { fatte: [], saltate: [] };
    desideri.forEach(function (d) {
      if (d.sconosciuto) {
        ESITO_PREFERENZE.saltate.push(d.a.nome + ' → «' + d.testo + '»: non l\'ho trovato fra gli iscritti');
        return;
      }
      /* col livello più prudente si tiene insieme solo chi si è scelto a
         vicenda: una richiesta a senso unico non vale quanto l'equilibrio */
      if (livello === 'poco' && !d.reciproco) {
        SALTATI[chiave(d)] = true;
        ESITO_PREFERENZE.saltate.push(d.a.nome + ' → ' + d.b.nome +
          ': richiesta a senso unico, e ho tenuto l\'equilibrio delle squadre');
        return;
      }
      var ra = radice(d.a._id), rb = radice(d.b._id);
      if (ra === rb) { ESITO_PREFERENZE.fatte.push(d.a.nome + ' con ' + d.b.nome); return; }
      if (quanti[ra] + quanti[rb] > maxGruppo) {
        SALTATI[chiave(d)] = true;
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

  /* Ultima rifinitura: qualche scambio per avvicinare la forza media, senza
     però rovinare quello che si è appena sistemato. Uno scambio viene fatto
     solo se il divario cala e le fasce restano pari. */
  function affinaForza(squadre) {
    function scarto() {
      var m = squadre.map(mediaForza);
      return Math.max.apply(null, m) - Math.min.apply(null, m);
    }
    function fasceOk() {
      return [eGrande, ePiccolo].every(function (test) {
        var c = squadre.map(function (s) {
          return s.componenti.filter(function (id) { return test(perId(id)); }).length;
        });
        return Math.max.apply(null, c) - Math.min.apply(null, c) <= 1;
      });
    }
    for (var giro = 0; giro < 120; giro++) {
      var prima = scarto();
      /* si insiste finché c'è margine: spesso esiste una divisione perfetta
         e fermarsi a mezzo punto vuol dire lasciarla lì */
      if (prima < 0.05) break;
      var m = squadre.map(mediaForza);
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
          if (forza(perId(ia)) <= forza(perId(ib))) return;
          scambia(squadre[alta], squadre[bassa], ia, ib);
          var dopo = scarto(), ok = fasceOk() && prefissiOk(squadre);
          scambia(squadre[alta], squadre[bassa], ib, ia);   /* rimetto a posto */
          if (ok && dopo < prima && (!migliore || dopo < migliore.v)) {
            migliore = { a: ia, b: ib, v: dopo };
          }
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
      /* i numeri che contano davvero: quanti grandi, quanti piccoli e quanto
         pesa la squadra. La media dell'età da sola nasconde gli sbilanciamenti */
      var grandi = sq.componenti.filter(function (id) { return eGrande(perId(id)); }).length;
      var piccoli = sq.componenti.filter(function (id) { return ePiccolo(perId(id)); }).length;
      var deboli = sq.componenti.filter(function (id) { return nuotaPoco(perId(id)); }).length;
      col.appendChild(crea('div', 'dati-sq',
        sq.componenti.length + ' componenti · forza ' + mediaForza(sq).toFixed(1) +
        ' · età media ' + (eta ? eta.toFixed(1) : '—')));
      col.appendChild(crea('div', 'dati-sq',
        '💪 ' + grandi + ' dai 15 in su · 🧒 ' + piccoli + ' fino a 10 anni · 🛟 ' + deboli + ' nuotano poco'));

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
    var forze = STATO.squadre.map(mediaForza);
    var scartoForza = Math.max.apply(null, forze) - Math.min.apply(null, forze);
    var grandi = STATO.squadre.map(function (s) {
      return s.componenti.filter(function (id) { return eGrande(perId(id)); }).length;
    });
    var piccoli = STATO.squadre.map(function (s) {
      return s.componenti.filter(function (id) { return ePiccolo(perId(id)); }).length;
    });
    function divario(v) { return Math.max.apply(null, v) - Math.min.apply(null, v); }

    riga('💪 Forza media da ' + Math.min.apply(null, forze).toFixed(1) + ' a ' +
      Math.max.apply(null, forze).toFixed(1) + ' (scarto ' + scartoForza.toFixed(1) +
      ') — è il numero che conta: età e capacità in acqua insieme');
    riga('🧑 Ragazzi dai 15 in su: ' + grandi.join(', ') + ' per squadra' +
      (divario(grandi) <= 1 ? ' ✅' : ' ⚠️ sbilanciati'));
    riga('🧒 Fino a 10 anni: ' + piccoli.join(', ') + ' per squadra' +
      (divario(piccoli) <= 1 ? ' ✅' : ' ⚠️ sbilanciati'));
    riga('🛟 Nuotano poco: ' + deboli.join(', ') + ' per squadra' +
      (divario(deboli) <= 1 ? ' ✅' : ' ⚠️ sbilanciati'));
    riga('⚖️ Età medie da ' + Math.min.apply(null, medie).toFixed(1) + ' a ' +
      Math.max.apply(null, medie).toFixed(1) + ' anni · componenti da ' +
      Math.min.apply(null, dim) + ' a ' + Math.max.apply(null, dim));

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

    var equilibrate = scartoForza <= 1.5 && diffDim <= 1 &&
      divario(grandi) <= 1 && divario(piccoli) <= 1 && divario(deboli) <= 1;
    var esito = riga(equilibrate
      ? '👍 Squadre equilibrate: forza, fasce d\'età e capacità sono spartite bene.'
      : '💡 Qualcosa non torna: rigenera, oppure sposta a mano qualcuno delle fasce segnate con ⚠️.');
    esito.style.cssText = 'margin-top:8px;font-weight:bold';
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
    incontri = assegnaProve(incontri, V(td.prove, []), V(td.provaFinale, ''), formato);

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
     scelta come "provaFinale": per il Trittico e' lo scopone.
     Nella sfida diretta il nome "finale" non compare, ma l'ultima partita
     e' quella che decide: quella si gioca alla prova finale come tutte le
     altre finali. */
  function assegnaProve(incontri, prove, idProvaFinale, formato) {
    if (!prove.length) return incontri;
    var finale = prove.filter(function (p) { return p.id === idProvaFinale; })[0]
      || prove[prove.length - 1];
    var turni = [];
    incontri.forEach(function (m) {
      if (turni.indexOf(m.turno) < 0) turni.push(m.turno);
    });
    var soloGironi = turni.filter(function (t) { return !/final/i.test(t); });
    var perTurni = prove;
    if (formato === 'sfida' && soloGironi.length > 1) {
      soloGironi.pop();                      /* l'ultima partita e' la finale */
      /* le prime si giocano agli altri due giochi, cosi' il pomeriggio li
         tocca tutti e tre e la bella resta allo scopone */
      var senzaFinale = prove.filter(function (p) { return p.id !== finale.id; });
      if (senzaFinale.length) perTurni = senzaFinale;
    }
    var mappa = {};
    soloGironi.forEach(function (t, i) { mappa[t] = perTurni[i % perTurni.length]; });
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

  /* ========================= CRONOMETRO DELLA GARA =====================
     Ogni gioco ha il suo tempo massimo. Il conto alla rovescia non si
     scala di secondo in secondo: si ricalcola ogni volta dall'orario di
     avvio, così resta giusto anche se il telefono si blocca, la pagina
     finisce in secondo piano o la si ricarica per sbaglio.
     Vive dentro lo stato condiviso: se lo fa partire uno, lo vedono
     tutti gli altri organizzatori. Quando scade suona, e allora si
     assegnano i punti a chi è avanti in quel momento.               */
  var TIC = null, SIRENA = null, AUDIO = null;

  function cron() {
    STATO.cronometro = STATO.cronometro || cronometroVuoto();
    return STATO.cronometro;
  }
  function giocoCron() {
    var c = cron();
    return V(DATI.giochi, []).filter(function (g) { return g.id === c.gioco; })[0] || null;
  }
  function totaleMs() { return (Number(cron().minuti) || 0) * 60000; }
  function rimastiMs() {
    var c = cron();
    if (!totaleMs()) return 0;
    var passato = (Number(c.consumato) || 0) + (c.avvio ? (Date.now() - c.avvio) : 0);
    return totaleMs() - passato;
  }
  function inMarcia() { return !!cron().avvio; }

  function mmss(ms) {
    var neg = ms < 0;
    var s = Math.floor(Math.abs(ms) / 1000);
    return (neg ? '-' : '') + due(Math.floor(s / 60)) + ':' + due(s % 60);
  }

  function scegliGiocoCron(id) {
    var g = V(DATI.giochi, []).filter(function (x) { return x.id === id; })[0];
    var c = cron();
    c.gioco = V(id, '');
    c.minuti = g ? (Number(g.durata) || 0) : 0;
    c.avvio = 0; c.consumato = 0; c.suonato = false;
    zittisci();
    salvaStato(); disegnaCronometro();
  }
  function avviaCron() {
    var c = cron();
    if (!c.gioco) { CA.toast('Scegli prima quale gara stai per far partire.', 5000); return; }
    if (c.avvio) return;
    if (rimastiMs() <= 0) { c.consumato = 0; c.suonato = false; }
    preparaAudio();                    /* il permesso al suono si prende adesso,
                                          mentre il dito è ancora sul pulsante */
    c.avvio = Date.now();
    salvaStato(); disegnaCronometro();
  }
  function pausaCron() {
    var c = cron();
    if (!c.avvio) return;
    c.consumato = (Number(c.consumato) || 0) + (Date.now() - c.avvio);
    c.avvio = 0;
    salvaStato(); disegnaCronometro();
  }
  function azzeraCron() {
    var c = cron();
    c.avvio = 0; c.consumato = 0; c.suonato = false;
    zittisci();
    salvaStato(); disegnaCronometro();
  }

  /* --- la sirena: due note ripetute, fatte al momento, senza file audio --- */
  function preparaAudio() {
    try {
      AUDIO = AUDIO || new (window.AudioContext || window.webkitAudioContext)();
      if (AUDIO.state === 'suspended') AUDIO.resume();
    } catch (e) { AUDIO = null; }
  }
  function unBip() {
    if (!AUDIO) return;
    try {
      var t = AUDIO.currentTime;
      [[0, 880], [0.26, 880], [0.52, 660]].forEach(function (n) {
        var o = AUDIO.createOscillator(), v = AUDIO.createGain();
        o.type = 'square';
        o.frequency.value = n[1];
        v.gain.setValueAtTime(0.0001, t + n[0]);
        v.gain.exponentialRampToValueAtTime(0.22, t + n[0] + 0.02);
        v.gain.exponentialRampToValueAtTime(0.0001, t + n[0] + 0.2);
        o.connect(v); v.connect(AUDIO.destination);
        o.start(t + n[0]); o.stop(t + n[0] + 0.22);
      });
    } catch (e) { }
  }
  function suona() {
    if (SIRENA) return;
    preparaAudio();
    unBip();
    try { if (navigator.vibrate) navigator.vibrate([400, 180, 400, 180, 600]); } catch (e) { }
    SIRENA = setInterval(unBip, 1600);
    /* non suona all'infinito: dopo un minuto smette da sola */
    setTimeout(zittisci, 60000);
    var z = $('btnCronZitto');
    if (z) z.style.display = '';
  }
  function zittisci() {
    if (SIRENA) { clearInterval(SIRENA); SIRENA = null; }
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { }
    var z = $('btnCronZitto');
    if (z) z.style.display = 'none';
  }

  function disegnaCronometro() {
    var sel = $('cronGioco');
    if (!sel) return;
    var c = cron();

    /* la tendina si rifà solo se l'elenco è cambiato: se no perde il tocco */
    var giochi = V(DATI.giochi, []).filter(function (g) { return !g.escluso; });
    var firma = giochi.map(function (g) { return g.id + ':' + g.nome + ':' + g.durata; }).join('|');
    if (sel.getAttribute('data-firma') !== firma) {
      sel.setAttribute('data-firma', firma);
      sel.textContent = '';
      var vuoto = document.createElement('option');
      vuoto.value = ''; vuoto.textContent = '— scegli la gara —';
      sel.appendChild(vuoto);
      giochi.forEach(function (g) {
        var o = document.createElement('option');
        o.value = g.id;
        o.textContent = V(g.emoji, '🎯') + ' ' + g.nome + ' · ' + (g.durata || 0) + ' min' +
          (g.riserva ? ' (di riserva)' : '');
        sel.appendChild(o);
      });
    }
    if (sel.value !== V(c.gioco, '')) sel.value = V(c.gioco, '');

    var g = giocoCron();
    var mus = $('btnCronMusica');
    if (mus) {
      var l = g ? CA.linkPlaylist(g) : '';
      mus.href = l || '#';
      mus.style.display = l ? '' : 'none';
      /* il pulsante dice la verità: incolonna i brani solo se hanno il
         collegamento preciso, se no apre il primo e basta */
      mus.textContent = !g ? '🎵 Scaletta'
        : (CA.playlistYouTube(g) ? '🎵 Playlist di YouTube'
          : (CA.braniColLink(g) >= 2
            ? '🎵 Scaletta · ' + CA.braniColLink(g) + ' brani in fila'
            : '🎵 Metti la musica'));
    }
    tic();
    if (!TIC) TIC = setInterval(tic, 500);
  }

  function tic() {
    var el = $('orologio');
    if (!el) return;
    var c = cron();
    var ms = rimastiMs();

    if (!c.gioco || !totaleMs()) {
      el.textContent = '--:--';
      el.className = 'orologio';
      testo('cronNota', 'Scegli la gara: il tempo lo prendo dalla durata scritta nei contenuti.');
      return;
    }

    /* è appena scaduto: si ferma da solo e suona, una volta sola */
    if (ms <= 0 && !c.suonato) {
      c.suonato = true;
      c.consumato = totaleMs();
      c.avvio = 0;
      salvaStato();
      suona();
      CA.toast('⏰ Tempo scaduto: assegna i punti a chi è avanti adesso.', 12000);
    }

    el.textContent = mmss(Math.max(0, ms));
    el.className = 'orologio' +
      (ms <= 0 ? ' scaduto' : (ms <= 60000 ? ' agli-sgoccioli' : (inMarcia() ? ' in-marcia' : '')));

    var g = giocoCron();
    var nome = g ? (V(g.emoji, '') + ' ' + g.nome) : '';
    if (ms <= 0) {
      testo('cronNota', '⏰ Tempo scaduto su ' + nome +
        '. Se nessuno ha già vinto, vince chi è avanti adesso: scrivi l\'ordine d\'arrivo qui sotto.');
    } else if (inMarcia()) {
      testo('cronNota', '▶ ' + nome + ' in corso — finisce alle ' +
        oraFinale() + '. Lo vedono anche gli altri organizzatori.');
    } else if (c.consumato) {
      testo('cronNota', '⏸ ' + nome + ' in pausa. Premi Via per ripartire da dove eri.');
    } else {
      testo('cronNota', nome + ': ' + c.minuti + ' minuti. Premi Via quando parte la gara.');
    }
  }

  function oraFinale() {
    var f = new Date(Date.now() + Math.max(0, rimastiMs()));
    return due(f.getHours()) + ':' + due(f.getMinutes());
  }

  /* ============================== PUNTEGGI ============================= */
  function disegnaPunteggi() {
    disegnaCronometro();
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
    var av = V(DATI.avviso, {});
    $('c_avvisoAttivo').checked = (av.attivo === true);
    $('c_avvisoTipo').value = V(av.tipo, 'attenzione');
    $('c_avvisoTitolo').value = V(av.titolo, '');
    $('c_avvisoTesto').value = V(av.testo, '');
    var alb = V(DATI.album, {});
    $('c_albumAttivo').checked = (alb.attivo === true);
    $('c_albumFoto').value = V(alb.foto, []).join('\n');
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

  /* La scaletta di ogni gioco: tanti brani quanti ne servono a coprire la
     durata della gara. Il primo brano è anche quello che compare sul sito
     come canzone del gioco, così le due cose non si sdoppiano. */
  function disegnaEditMusica() {
    var el = $('editMusica');
    el.textContent = '';
    V(DATI.giochi, []).filter(function (g) { return !g.escluso; }).forEach(function (g) {
      sistemaPlaylist(g);
      var d = crea('div', 'voce-edit');

      var h = crea('div', 'testa-scaletta');
      h.appendChild(crea('b', null, V(g.emoji, '🎯') + ' ' + g.nome));
      var stima = crea('span', 'dida-scaletta');
      h.appendChild(stima);
      d.appendChild(h);

      var lista = crea('div', 'brani');
      d.appendChild(lista);

      function conta() {
        var min = Math.round(g.playlist.length * CA.MINUTI_A_BRANO);
        var dur = Number(g.durata) || 0;
        stima.textContent = g.playlist.length + ' brani · circa ' + min + ' min' +
          (dur ? (min >= dur ? ' — coprono i ' + dur + ' min del gioco'
            : ' — il gioco dura ' + dur + ' min: ne manca qualcuno') : '');
        stima.className = 'dida-scaletta' + (dur && min < dur ? ' corta' : '');
      }

      function ridisegna() {
        lista.textContent = '';
        g.playlist.forEach(function (b, i) {
          lista.appendChild(rigaBrano(g, b, i, ridisegna, conta));
        });
        conta();
      }
      ridisegna();

      var az = crea('div', 'azioni');
      az.style.cssText = 'justify-content:flex-start;margin-top:10px';
      az.appendChild(bottone('➕ Aggiungi un brano', 'chiaro btn-piccolo', function () {
        g.playlist.push({ titolo: '', artista: '', url: '', ricerca: '' });
        ridisegna();
        salvaBozzaFraPoco();
      }));
      var prova = crea('a', 'btn btn-chiaro btn-piccolo', '▶ Prova la scaletta');
      prova.target = '_blank'; prova.rel = 'noopener';
      prova.href = CA.linkPlaylist(g) || '#';
      az.appendChild(prova);
      d.appendChild(az);

      var quanti = CA.braniColLink(g);
      if (CA.playlistYouTube(g)) {
        d.appendChild(crea('p', 'aiuto',
          '✅ Qui hai incollato l\'indirizzo di una playlist di YouTube: un tocco e parte ' +
          'tutta, nell\'ordine che hai messo su YouTube. È il modo più comodo — i brani ' +
          'scritti qui sotto restano solo come promemoria di cosa c\'è dentro.'));
      } else if (quanti < 2 && g.playlist.length > 1) {
        d.appendChild(crea('p', 'aiuto',
          'Due strade per farli partire in fila: incolla il collegamento di almeno due brani ' +
          '(adesso ne hai ' + quanti + '), oppure fai una playlist su YouTube e incolla il suo ' +
          'indirizzo — quello lungo, con dentro «list=» — nel primo brano.'));
      }
      el.appendChild(d);
    });
  }

  /* una riga della scaletta */
  function rigaBrano(g, b, i, ridisegna, conta) {
    var r = crea('div', 'brano');
    r.appendChild(crea('span', 'num-brano', String(i + 1)));

    var gr = crea('div', 'griglia3');
    gr.style.flex = '1';
    gr.appendChild(campoMini('Titolo', b.titolo, function (v) {
      b.titolo = v; aggiornaRicerca(b); if (i === 0) allineaCanzone(g);
    }));
    gr.appendChild(campoMini('Artista', b.artista, function (v) {
      b.artista = v; aggiornaRicerca(b); if (i === 0) allineaCanzone(g);
    }));
    gr.appendChild(campoMini('Collegamento YouTube (facoltativo)', b.url, function (v) {
      b.url = v.trim(); if (i === 0) allineaCanzone(g);
    }));
    r.appendChild(gr);

    var az = crea('div', 'azioni-r');
    az.appendChild(bottone('▲', 'chiaro btn-piccolo', function () {
      if (i === 0) return;
      g.playlist.splice(i - 1, 0, g.playlist.splice(i, 1)[0]);
      allineaCanzone(g); ridisegna(); salvaBozzaFraPoco();
    }));
    az.appendChild(bottone('▼', 'chiaro btn-piccolo', function () {
      if (i >= g.playlist.length - 1) return;
      g.playlist.splice(i + 1, 0, g.playlist.splice(i, 1)[0]);
      allineaCanzone(g); ridisegna(); salvaBozzaFraPoco();
    }));
    az.appendChild(bottone('🗑️', 'rosso btn-piccolo', function () {
      if (g.playlist.length <= 1) { CA.toast('Almeno un brano deve restare.', 4000); return; }
      g.playlist.splice(i, 1);
      allineaCanzone(g); ridisegna(); salvaBozzaFraPoco();
    }));
    r.appendChild(az);
    return r;
  }

  function sistemaPlaylist(g) {
    g.musica = g.musica || { titolo: '', artista: '', url: '', ricerca: '' };
    if (!Array.isArray(g.playlist) || !g.playlist.length) {
      g.playlist = [{
        titolo: V(g.musica.titolo, ''), artista: V(g.musica.artista, ''),
        url: V(g.musica.url, ''), ricerca: V(g.musica.ricerca, '')
      }];
    }
  }
  /* il primo brano è la canzone del gioco: si tengono allineati */
  function allineaCanzone(g) {
    var primo = g.playlist[0];
    if (!primo) return;
    g.musica.titolo = primo.titolo;
    g.musica.artista = primo.artista;
    g.musica.url = primo.url;
    g.musica.ricerca = primo.ricerca;
  }
  function aggiornaRicerca(m) {
    m.ricerca = (V(m.titolo, '') + ' ' + V(m.artista, '')).trim();
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
    d.avviso = {
      attivo: $('c_avvisoAttivo').checked,
      tipo: $('c_avvisoTipo').value,
      titolo: $('c_avvisoTitolo').value.trim(),
      testo: $('c_avvisoTesto').value.trim()
    };
    d.album = d.album || {};
    d.album.attivo = $('c_albumAttivo').checked;
    d.album.foto = righe($('c_albumFoto').value);
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
    '    // Classifiche, tabellone e album delle foto: li legge chiunque,',
    "    // li scrive solo l'organizzatore dopo il login.",
    '    match /pubblico_certamen/{doc} {',
    '      allow read: if true;',
    '      allow write: if request.auth != null;',
    '    }',
    '',
    '    // Squadre, punteggi e tabelloni: contengono i nomi veri.',
    '    // Sono documenti separati, uno per area, cosi\' piu\' operatori',
    '    // possono lavorare insieme senza sovrascriversi.',
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
              /* 3. l'album delle foto: percorso nuovo, spesso manca nelle regole */
              return FB.provaAlbum().then(function (esito) {
                if (esito === 'bloccato') {
                  mancanoRegole = true;
                  riga('⛔ L\'album delle foto è bloccato: le foto che scatti non si vedranno. ' +
                    'Serve la riga «match /pubblico_certamen/{doc}» nelle regole.');
                } else if (esito === 'errore') {
                  riga('⚠️ Non riesco a controllare l\'album: riprova fra poco.');
                } else {
                  riga('✅ Album delle foto raggiungibile.');
                }
                chiudiDiagnosi(mancanoRegole);
              });
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

  /* Il collegamento a GitHub è pronto? Utente e repository hanno un valore
     predefinito, quindi in pratica manca sempre e solo il token. */
  function ghPronto() {
    var s = gh();
    return !!(s.owner && s.repo && s.token);
  }

  /* Se manca il token non basta dirlo: apro la sezione giusta, ci porto
     l'utente e metto il cursore nel campo. Le sue modifiche intanto restano
     salvate come bozza, così non si perde niente. */
  function chiediGh() {
    /* il riquadro del token vive nella scheda «Pubblica»: se sto altrove
       (per esempio nell'album, dal telefono) devo prima portarcelo, se no
       scorro verso una sezione nascosta e sembra che non succeda niente */
    var linguetta = document.querySelector('[data-vista="pubblica"]');
    if (linguetta && !linguetta.classList.contains('attiva')) linguetta.click();
    var det = $('dettagliGh');
    if (det) det.open = true;
    setTimeout(function () {
      var card = $('sec-github');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { $('gh_token').focus(); } catch (e) { }
    }, 120);
    CA.toast('🔑 Manca il token di GitHub in questo telefono: seguendo i tre passi ci vuole un minuto. Le tue modifiche sono salvate, non le perdi.', 12000);
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

  /* ====================== ALBUM: SCATTA E VA ONLINE ====================
     Dal telefono si apre la fotocamera, si scatta, e la foto finisce subito
     nell'album del sito. La foto vera sale su GitHub (serve il token), il
     suo indirizzo e la didascalia finiscono nel database: così l'album si
     riempie in diretta, senza ripubblicare il sito ogni volta.
     La didascalia se la scrive da sola guardando l'ora e il programma.   */
  var ALBUM = [], ALBUM_ACCESO = false;

  /* Cosa sta succedendo adesso, secondo il programma della giornata */
  function cosaSuccedeAdesso() {
    var ora = new Date();
    var minutiOra = ora.getHours() * 60 + ora.getMinutes();
    var righe = V(DATI.programma, []).filter(function (r) { return r.ora; });
    var scelta = null;
    righe.forEach(function (r) {
      var p = String(r.ora).split(':');
      var m = Number(p[0]) * 60 + Number(p[1]);
      if (!isFinite(m)) return;
      if (m <= minutiOra && (!scelta || m > scelta.minuti)) scelta = { r: r, minuti: m };
    });
    return scelta ? scelta.r : null;
  }

  function didascaliaAutomatica() {
    var ora = new Date();
    var orario = due(ora.getHours()) + ':' + due(ora.getMinutes());
    var tappa = cosaSuccedeAdesso();
    if (tappa) return orario + ' — ' + String(tappa.titolo).replace(/^[^\wÀ-ÿ]+/, '').trim();
    var ev = V(DATI.evento, {});
    return orario + ' — ' + V(V(DATI.tema, {}).titolo, 'Certamen Aquaticum') +
      (ev.data ? ' · ' + CA.dataIt(ev.data, false) : '');
  }

  /* Le foto dal telefono sono enormi: si rimpiccioliscono prima di mandarle,
     altrimenti si riempie il sito e il caricamento non finisce mai. */
  function rimpicciolisci(file, latoMax) {
    return new Promise(function (ok, ko) {
      var lettore = new FileReader();
      lettore.onerror = function () { ko(new Error('non riesco a leggere la foto')); };
      lettore.onload = function () {
        var img = new Image();
        img.onerror = function () { ko(new Error('la foto non si apre')); };
        img.onload = function () {
          var s = Math.min(1, latoMax / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * s);
          c.height = Math.round(img.naturalHeight * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        };
        img.src = String(lettore.result);
      };
      lettore.readAsDataURL(file);
    });
  }

  function nomeFoto() {
    var d = new Date();
    return 'foto_' + d.getFullYear() + due(d.getMonth() + 1) + due(d.getDate()) + '_' +
      due(d.getHours()) + due(d.getMinutes()) + due(d.getSeconds()) + '.jpg';
  }

  function aggiungiFoto(file) {
    /* si dice sempre cosa sta succedendo: un pulsante che non fa niente e non
       spiega perché è la cosa più fastidiosa che ci sia */
    if (!SESS) {
      testo('statoFoto', '⚠️ Prima entra nel database, in cima alla scheda 📊 Cruscotto.');
      CA.toast('Prima entra nel database.', 6000);
      return Promise.resolve(false);
    }
    if (!ghPronto()) {
      testo('statoFoto', '⚠️ Manca il token di GitHub in questo telefono: serve per caricare le foto. ' +
        'Ti porto nella scheda 📣 Pubblica, dove si incolla — poi torna qui e riscatta.');
      chiediGh();
      return Promise.resolve(false);
    }
    if (!file || !/^image\//.test(file.type || '')) {
      testo('statoFoto', '⚠️ Questo non è un file di immagine.');
      return Promise.resolve(false);
    }
    testo('statoFoto', '⏳ Preparo la foto…');
    return rimpicciolisci(file, 1600).then(function (b64) {
      var nome = nomeFoto();
      testo('statoFoto', '📤 Sto caricando ' + nome + '…');
      return ghPut('images/album/' + nome, b64, 'Foto dell\'album: ' + nome)
        .then(function (risposta) {
          /* l'indirizzo diretto funziona subito, senza aspettare che il sito
             si ricostruisca: è quello che rende l'album istantaneo */
          var url = (risposta && risposta.content && risposta.content.download_url) ||
            ('images/album/' + nome);
          var voce = {
            url: url,
            file: 'images/album/' + nome,
            didascalia: didascaliaAutomatica(),
            quando: new Date().toISOString(),
            chi: chiSono()
          };
          ALBUM.unshift(voce);
          /* chi scatta vuole che si veda: l'album si accende da solo, senza
             dover ricordarsi anche di ripubblicare il sito */
          ALBUM_ACCESO = true;
          if ($('c_albumAttivo') && !$('c_albumAttivo').checked) {
            $('c_albumAttivo').checked = true;
            salvaBozzaFraPoco();
          }
          return salvaAlbum().then(function () {
            testo('statoFoto', '✅ Foto nell\'album: già visibile a tutti.');
            disegnaAlbum();
            return true;
          });
        });
    }).catch(function (e) {
      testo('statoFoto', '⚠️ ' + e.message);
      return false;
    });
  }

  function salvaAlbum() {
    return token().then(function (t) {
      return FB.scriviAlbum(t, { attivo: ALBUM_ACCESO, foto: ALBUM });
    });
  }

  function caricaAlbum() {
    return FB.leggiAlbum().then(function (a) {
      ALBUM = (a && Array.isArray(a.foto)) ? a.foto : [];
      ALBUM_ACCESO = !!(a && a.attivo);
      /* comanda il database: è quello che vedono i visitatori adesso */
      if (ALBUM_ACCESO && $('c_albumAttivo')) $('c_albumAttivo').checked = true;
      disegnaAlbum();
    }).catch(function () { });
  }

  function disegnaAlbum() {
    var el = $('elencoAlbum');
    if (!el) return;
    el.textContent = '';
    if (!ALBUM.length) {
      el.appendChild(crea('p', 'aiuto', 'Nessuna foto ancora. Premi «Scatta una foto».'));
      return;
    }
    ALBUM.forEach(function (f, i) {
      var r = crea('div', 'riga-iscr');
      var img = document.createElement('img');
      img.src = f.url;
      img.alt = f.didascalia || '';
      img.loading = 'lazy';
      img.style.cssText = 'width:82px;height:82px;object-fit:cover;border-radius:12px;flex:0 0 82px';
      r.appendChild(img);

      var c = crea('div', 'cnt');
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'mini'; inp.value = V(f.didascalia, '');
      inp.addEventListener('change', function () {
        f.didascalia = inp.value.trim();
        salvaAlbum().then(function () { CA.toast('✏️ Didascalia aggiornata.', 3500); });
      });
      c.appendChild(inp);
      var q = new Date(f.quando);
      c.appendChild(crea('small', null,
        (isNaN(q.getTime()) ? '' : ('scattata alle ' + due(q.getHours()) + ':' + due(q.getMinutes()))) +
        (f.chi ? ' da ' + f.chi : '')));
      r.appendChild(c);

      var az = crea('div', 'azioni-r');
      az.appendChild(bottone('🗑️ Togli', 'rosso', function () {
        if (!confirm('Tolgo questa foto dall\'album?')) return;
        ALBUM.splice(i, 1);
        salvaAlbum().then(function () { disegnaAlbum(); CA.toast('Foto tolta.', 4000); });
      }));
      r.appendChild(az);
      el.appendChild(r);
    });
  }

  /* ========================= COPIA DI SICUREZZA ========================
     Tutto quello che serve per ricostruire la giornata, in un file solo.
     Contiene nomi e recapiti, quindi resta sul telefono dell'organizzatore:
     non va messo nel sito né mandato in giro.                            */
  function scaricaCopiaSicurezza() {
    var d = new Date();
    var quando = d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate()) +
      '_' + due(d.getHours()) + due(d.getMinutes());
    var copia = {
      tipo: 'copia-di-sicurezza-certamen-aquaticum',
      versione: 1,
      fattaIl: d.toISOString(),
      evento: V(DATI.evento, {}),
      iscrizioni: ISCR.map(function (p) { return JSON.parse(JSON.stringify(p)); }),
      stato: STATO,
      contatori: CA.contatori(),
      bacheca: costruisciPubblico()
    };
    scaricaFile('certamen_copia_' + quando + '.json', JSON.stringify(copia, null, 2), 'application/json');
    testo('statoCopia', '💾 Copia scaricata: ' + copia.iscrizioni.length + ' iscrizioni, ' +
      STATO.squadre.length + ' squadre, ' + Object.keys(STATO.risultati).length + ' gare con punteggio. ' +
      'Contiene nomi e recapiti: tienila per te.');
  }

  /* Rilegge una copia: rimette squadre, punteggi e tabelloni com'erano.
     Le iscrizioni non si toccano — quelle stanno nel registro e si
     recuperano da lì, riscriverle rischierebbe di crearne di doppie. */
  function leggiCopiaSicurezza(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var lettore = new FileReader();
    lettore.onload = function () {
      var c = null;
      try { c = JSON.parse(String(lettore.result)); } catch (e) { }
      if (!c || c.tipo !== 'copia-di-sicurezza-certamen-aquaticum' || !c.stato) {
        testo('statoCopia', '⚠️ Questo non sembra un file di copia del Certamen.');
        return;
      }
      var q = new Date(c.fattaIl);
      var quante = V(c.stato.squadre, []).length;
      if (!confirm('Copia del ' + q.getDate() + '/' + (q.getMonth() + 1) + ' alle ' +
        due(q.getHours()) + ':' + due(q.getMinutes()) + '.\n\n' +
        'Rimetto ' + quante + ' squadre, i punteggi e i tabelloni come erano allora.\n' +
        'Quello che c\'è adesso viene sostituito. Procedo?')) return;

      STATO = {
        squadre: V(c.stato.squadre, []), configSquadre: V(c.stato.configSquadre, {}),
        risultati: V(c.stato.risultati, {}), titoli: V(c.stato.titoli, []),
        tornei: V(c.stato.tornei, {}), bonus: V(c.stato.bonus, {})
      };
      salvaStato(true);
      disegnaTutto();
      testo('statoCopia', '✅ Copia riletta: squadre, punteggi e tabelloni sono tornati come erano.');
    };
    lettore.readAsText(file);
    ev.target.value = '';
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
