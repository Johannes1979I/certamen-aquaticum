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
  var PRESA = null;         /* nome di una coppia in attesa dello scambio */
  var sqToccato = false;    /* ho già scelto io quante squadre fare? */

  var COLORI_SQ = ['#0b7fd4', '#ff6b6b', '#ffc233', '#14c4b4', '#7c4dff', '#1f8a5b', '#e8734a', '#8d5ac2'];
  var NOMI_SQ = ['Delfini', 'Squali', 'Tartarughe', 'Meduse', 'Orche', 'Piovre', 'Granchi', 'Stelle marine'];

  function statoVuoto() {
    return {
      squadre: [], configSquadre: {}, risultati: {}, titoli: [], tornei: {}, bonus: {},
      cronometro: cronometroVuoto(), assettoCarte: null,
      torneoRagazzi: { attivo: false, turni: [] }, presenze: {}, menzioni: {}
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
        if (v === 'tornei') { disegnaTornei(); proponiTorneoVeloce(); }
        if (v === 'punteggi') { disegnaPunteggi(); scaldaAudio(); }
        if (v === 'giochi') disegnaEditGiochi();
        if (v === 'stampe') disegnaRuoli();
        /* l'appello si raggruppa per squadra: se le squadre sono nate dopo
           l'ultimo disegno, va rifatto entrando */
        if (v === 'appello') disegnaAppello();
        /* il messaggio di chiusura si riscrive coi punteggi del momento,
           finché non lo si ritocca a mano */
        if (v === 'pubblica') disegnaChiusura(false);
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
      mai: 'Non le guardo proprio: contano solo età e capacità in acqua. Le richieste restano scritte nelle iscrizioni, e se vuoi accontentare qualcuno lo sposti a mano.',
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
      else segnalaBacheca('spenta');
    });
    $('btnPubblicaContenuti').addEventListener('click', pubblicaContenuti);
    $('btnScarica').addEventListener('click', scaricaContenuti);
    $('scontriAttivi').addEventListener('change', function () {
      if (this.checked) {
        if (!torneoR().turni.length) generaTorneoRagazzi();
        else { torneoR().attivo = true; salvaStato(); disegnaPunteggi(); }
      } else spegniTorneoRagazzi();
    });
    $('btnGeneraScontri').addEventListener('click', function () {
      if (torneoR().turni.length &&
        !confirm('Rifaccio il calendario da capo. I risultati già segnati restano, ' +
          'ma gli accoppiamenti cambiano. Procedo?')) return;
      generaTorneoRagazzi();
    });
    $('fileAudio').addEventListener('change', function () {
      if (this.files && this.files[0]) caricaAudio(this.files[0]);
    });
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
    $('btnProvaSirena').addEventListener('click', function () {
      preparaAudio();
      if (!AUDIO) {
        testo('statoSirena', '⚠️ Questo browser non mi lascia suonare. Prova da un altro, ' +
          'o tieni un fischietto di scorta.');
        return;
      }
      unaSirenata();
      testo('statoSirena', '🔊 Sta suonando (dura due secondi e mezzo). Se ti sembra piano: ' +
        'alza il volume del dispositivo, controlla che la cassa sia collegata e che non sia ' +
        'in silenzioso. Più forte di così non posso andare — il resto è volume del dispositivo.');
    });
    $('btnProvaVibra').addEventListener('click', function () {
      var ok = false;
      try { ok = !!(navigator.vibrate && navigator.vibrate([400, 180, 400])); } catch (e) { }
      testo('statoSirena', ok
        ? '📳 Vibrazione mandata: sul telefono si sente, sul computer no.'
        : '📳 Questo dispositivo non vibra — normale su computer e iPhone.');
    });

    $('btnChiudiEdizione').addEventListener('click', chiudiEdizione);
    $('btnRiprendiIscritti').addEventListener('click', riprendiIscritti);

    $('btnAggiungiSeparati').addEventListener('click', function () {
      DATI.separati = V(DATI.separati, []);
      DATI.separati.push({ a: '', b: '' });
      salvaBozza();
      disegnaSeparati();
    });

    $('btnSalvaGh').addEventListener('click', salvaGh);
    /* il token si scrive una volta e non si rilegge più: ma per passarlo al
       telefono bisogna poterlo vedere e copiare */
    $('btnVediToken').addEventListener('click', function () {
      var c = $('gh_token'), nascosto = c.type === 'password';
      c.type = nascosto ? 'text' : 'password';
      $('btnVediToken').textContent = nascosto ? '🙈 Nascondi' : '👁️ Mostra';
    });
    /* Copiare il token serve a passarlo dal computer al telefono senza
       rigenerarlo. Se non c'è, lo si dice: un pulsante che non fa niente e
       non spiega perché è la cosa più fastidiosa che ci sia. */
    $('btnCopiaToken').addEventListener('click', function () {
      var salvato = gh().token;
      if (!salvato) {
        testo('statoCopiaToken', '⚠️ In questo browser non c\'è nessun token salvato: ' +
          'non ho niente da copiare. Fanne uno nuovo col pulsante qui sopra.');
        CA.toast('Nessun token salvato in questo browser.', 6000);
        return;
      }
      copiaTesto(salvato).then(function (fatto) {
        if (fatto) {
          testo('statoCopiaToken', '📋 Copiato. Incollalo nell\'admin del telefono e premi ' +
            '«Salva in questo browser». Se lo mandi con un messaggio, poi cancellalo.');
          CA.toast('📋 Token copiato.', 5000);
        } else {
          testo('statoCopiaToken', '⚠️ Il browser non mi lascia copiare da solo: ' +
            'premi 👁️ Mostra e copialo a mano dal campo qui sotto.');
        }
      });
    });
    $('btnVaiPubblica').addEventListener('click', function () {
      document.querySelector('[data-vista="pubblica"]').click();
    });
    $('btnVaiPubblica2').addEventListener('click', function () {
      document.querySelector('[data-vista="pubblica"]').click();
    });
    $('btnRifaiChiusura').addEventListener('click', function () {
      disegnaChiusura(true);
      testo('statoChiusura', '🔄 Rifatto con i punteggi di adesso.');
    });
    $('btnCopiaChiusura').addEventListener('click', function () {
      copiaTesto($('msgChiusura').value).then(function (ok) {
        testo('statoChiusura', ok ? '📋 Copiato.' : '⚠️ Non riesco a copiarlo: selezionalo a mano.');
      });
    });
    $('msgChiusura').addEventListener('input', function () { disegnaChiusura(false); });
    $('btnAzzeraPunteggi').addEventListener('click', function () { azzeraGiornata(false); });
    $('btnAzzeraTutto').addEventListener('click', function () { azzeraGiornata(true); });
    $('mgChiudi').addEventListener('click', chiudiModaleGara);
    $('mgSalva').addEventListener('click', salvaModaleGara);
    $('mgAzzera').addEventListener('click', function () {
      ORDINE_TEMP = []; MENZIONI_TEMP = {};
      disegnaModaleGara();
    });
    $('modaleGara').addEventListener('click', function (e) {
      if (e.target === $('modaleGara')) chiudiModaleGara();   /* fuori: si chiude */
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && GARA_APERTA) chiudiModaleGara();
    });
    $('btnTuttiPresenti').addEventListener('click', function () {
      if (!confirm('Segno presenti tutti quelli non ancora spuntati?')) return;
      var pr = presenze();
      attive().forEach(function (p) {
        if (!pr[p._id]) { pr[p._id] = 'si'; PRESENZE_MIE[p._id] = true; }
      });
      salvaStato();
      disegnaAppello();
    });
    $('btnAzzeraAppello').addEventListener('click', function () {
      if (!confirm('Cancello tutte le spunte e ricomincio l\'appello?')) return;
      var vuoto = {};
      attive().forEach(function (p) { vuoto[p._id] = ''; PRESENZE_MIE[p._id] = true; });
      STATO.presenze = vuoto;
      salvaStato();
      disegnaAppello();
    });
    $('btnCopiaGuida').addEventListener('click', function () {
      copiaTesto(testoGuida()).then(function (fatto) {
        testo('statoGuida', fatto
          ? '📋 Copiata: incollala dove vuoi, va bene anche in un messaggio di gruppo.'
          : '⚠️ Il browser non mi lascia copiare da solo: usa «Stampa la guida» e mandala come foto.');
      });
    });
    $('btnRifaiProgramma').addEventListener('click', function () { ricalcolaProgramma(true); });
    $('pa_inizio').addEventListener('change', function () {
      DATI.programmaAuto.inizio = this.value.trim(); ricalcolaProgramma(true);
    });
    $('pa_pausaMin').addEventListener('change', function () {
      DATI.programmaAuto.pausaMinuti = Number(this.value) || 0; ricalcolaProgramma(true);
    });
    $('pa_pausaDopo').addEventListener('change', function () {
      DATI.programmaAuto.pausaDopo = this.value; ricalcolaProgramma(true);
    });
    $('pa_materassini').addEventListener('change', function () {
      DATI.attrezzi = V(DATI.attrezzi, {});
      DATI.attrezzi.materassino = Math.max(0, Number(this.value) || 0);
      salvaBozzaFraPoco();
      disegnaScontri();
      CA.toast('🛟 ' + DATI.attrezzi.materassino + ' materassini: le gare a scontri si regolano su questo.', 5000);
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
    if (nome === 'rubrica') return 'la rubrica dei giocatori';
    if (nome === 'edizioni') return 'le edizioni archiviate';
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
    /* Un'iscrizione senza nome, o con dentro un codice del database invece
       del nome, non è una persona: non deve comparire da nessuna parte. */
    if (!o.nome || CA.sembraCodice(o.nome)) return null;
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
      risultati: {
        risultati: STATO.risultati, torneoRagazzi: STATO.torneoRagazzi,
        menzioni: STATO.menzioni
      },
      titoli: { titoli: STATO.titoli },
      rubrica: STATO.rubrica || { giocatori: [] },
      edizioni: { edizioni: STATO.edizioni || [] },
      cronometro: { cronometro: STATO.cronometro },
      presenze: { presenze: STATO.presenze },
      assetto_carte: { assettoCarte: STATO.assettoCarte }
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
      STATO.torneoRagazzi = V(dati.torneoRagazzi, { attivo: false, turni: [] });
      STATO.menzioni = V(dati.menzioni, {});
    } else if (nome === 'edizioni') {
      STATO.edizioni = V(dati.edizioni, []);
    } else if (nome === 'rubrica') {
      STATO.rubrica = dati && Array.isArray(dati.giocatori) ? dati : { giocatori: [] };
      /* via i codici del database finiti in rubrica: non sono giocatori */
      if (CA.pulisciRubrica(STATO.rubrica)) {
        SPORCHI['rubrica'] = true;
        setTimeout(function () { salvaStato(false); }, 400);
      }
    } else if (nome === 'titoli') {
      STATO.titoli = V(dati.titoli, []);
    } else if (nome === 'cronometro') {
      STATO.cronometro = V(dati.cronometro, cronometroVuoto());
      disegnaCronometro();
    } else if (nome === 'assetto_carte') {
      STATO.assettoCarte = V(dati.assettoCarte, null);
    } else if (nome === 'presenze') {
      /* L'appello lo tengono in due o tre insieme, e tutti scrivono sullo
         stesso pezzo: sostituirlo di sana pianta cancellerebbe le spunte
         appena fatte dagli altri. Quindi si fondono, e vince quello che ho
         segnato io se ho toccato quel nome in questa sessione. */
      var arrivate = V(dati.presenze, {});
      var mie = STATO.presenze || {};
      var unite = {};
      Object.keys(arrivate).forEach(function (k) { unite[k] = arrivate[k]; });
      Object.keys(mie).forEach(function (k) {
        if (PRESENZE_MIE[k] || arrivate[k] === undefined) unite[k] = mie[k];
      });
      STATO.presenze = unite;
      disegnaAppello();
    } else if (nome.indexOf('torneo_') === 0) {
      STATO.tornei = STATO.tornei || {};
      /* Le coppie rimaste col codice del database al posto del nome — succede
         quando l'iscrizione viene cancellata dopo che le coppie erano già
         fatte — non sono persone: si tolgono, con le loro partite. */
      var via = CA.pulisciTorneo(dati);
      STATO.tornei[nome.slice(7)] = dati;
      if (via) {
        SPORCHI[nome] = true;
        /* e si risalva subito: devono sparire anche dal database, non solo
           da quello che si vede adesso */
        setTimeout(function () { salvaStato(false); }, 400);
        CA.toast('🧹 Ho tolto ' + via + (via === 1 ? ' coppia senza nome' : ' coppie senza nome') +
          ' dal tabellone: erano codici del database, non giocatori.', 9000);
      }
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
    disegnaEdizione();
    disegnaSportello();
    disegnaSeparati();
    disegnaIscritti();
    disegnaSquadre();
    disegnaTornei();
    disegnaPunteggi();
  }

  /* ---------------------- lo sportello delle iscrizioni ------------------
     Tre stati, non due: aperte, chiuse, oppure «si chiudono da sole» alla
     data. Il terzo è quello di sempre e resta il predefinito; gli altri due
     servono il giorno in cui la vita non segue il calendario. */
  function statoSportello() {
    var ev = V(DATI.evento, {});
    return String(V(ev.iscrizioni, 'data'));
  }
  function scadutaLaData() {
    var f = V(V(DATI.evento, {}).chiusuraIscrizioni, '');
    var p = String(f).split('-');
    if (p.length !== 3) return false;
    return Date.now() > new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59).getTime();
  }
  function chiuseAdesso() {
    var s = statoSportello();
    if (s === 'aperte') return false;
    if (s === 'chiuse') return true;
    return scadutaLaData();
  }

  function disegnaSportello() {
    var el = $('sportello');
    if (!el) return;
    el.textContent = '';
    var scelta = statoSportello(), chiuse = chiuseAdesso();
    var data = V(V(DATI.evento, {}).chiusuraIscrizioni, '');

    var stato = crea('div', 'nota-box attenzione');
    stato.style.margin = '0 0 14px';
    if (!chiuse) stato.className = 'nota-box sereno';
    stato.appendChild(crea('b', null, chiuse
      ? '🔒 In questo momento le iscrizioni sono chiuse'
      : '🔓 In questo momento le iscrizioni sono aperte'));
    stato.appendChild(crea('p', 'aiuto',
      scelta === 'aperte' ? 'Le tieni aperte tu: la data di chiusura è ignorata.' :
      scelta === 'chiuse' ? 'Le hai chiuse tu, prima della data.' :
      (data ? ('Si chiudono da sole dopo il ' + CA.dataIt(data) + '.' +
        (scadutaLaData() ? ' Quella data è passata.' : '')) : 'Non c\'è una data di chiusura: restano aperte.')));
    stato.appendChild(crea('p', 'aiuto', chiuse
      ? 'Chi apre il modulo trova il messaggio «Le iscrizioni sono chiuse». Tu puoi comunque ' +
        'aggiungere una persona a mano, qui sotto, con ➕ Aggiungi a mano.'
      : 'Dal sito ci si può iscrivere: i moduli funzionano e le iscrizioni arrivano qui.'));
    el.appendChild(stato);

    var az = crea('div', 'azioni');
    az.style.cssText = 'justify-content:flex-start;flex-wrap:wrap;margin-bottom:12px';
    function bottone(valore, testoB) {
      var b = crea('button', 'btn btn-piccolo ' + (scelta === valore ? 'btn-p' : 'btn-chiaro'), testoB);
      b.addEventListener('click', function () { cambiaSportello(valore); });
      az.appendChild(b);
    }
    bottone('aperte', '🔓 Aperte');
    bottone('data', '📅 Si chiudono da sole');
    bottone('chiuse', '🔒 Chiuse');
    el.appendChild(az);

    var c = crea('div', 'campo');
    c.style.maxWidth = '260px';
    c.appendChild(crea('label', null, 'Si chiudono da sole dopo il'));
    var inp = document.createElement('input');
    inp.type = 'date'; inp.value = data;
    inp.addEventListener('change', function () {
      DATI.evento = DATI.evento || {};
      DATI.evento.chiusuraIscrizioni = inp.value;
      var campo = $('c_chiusura');
      if (campo) campo.value = inp.value;         /* la scheda Contenuti resta allineata */
      salvaBozza();
      disegnaSportello();
      mandaSportello('📅 Data di chiusura aggiornata');
    });
    c.appendChild(inp);
    el.appendChild(c);

    if (ghPronto()) {
      el.appendChild(crea('p', 'aiuto',
        'La scelta vive in contenuti.json, quindi va pubblicata: il pulsante lo fa da solo. ' +
        'Sul sito si vede dopo una trentina di secondi, il tempo che GitHub rifaccia le pagine.'));
    } else {
      /* Senza token la scelta resta in questo telefono e il sito non cambia:
         va detto qui, senza portare via l'utente dall'interruttore che sta
         usando. Il pulsante lo accompagna quando vuole lui. */
      var manca = crea('div', 'nota-box allarme');
      manca.style.margin = '12px 0 0';
      manca.appendChild(crea('b', null, '🔑 Manca il token di GitHub'));
      manca.appendChild(crea('p', 'aiuto',
        'La scelta è salvata in questo telefono, ma sul sito non è ancora arrivata: ' +
        'chi apre il modulo vede ancora com\'era prima. Ci vuole un minuto.'));
      var b = crea('button', 'btn btn-chiaro btn-piccolo', '🔑 Sistemo il token');
      b.addEventListener('click', chiediGh);
      manca.appendChild(b);
      el.appendChild(manca);
    }
  }

  function cambiaSportello(valore) {
    DATI.evento = DATI.evento || {};
    DATI.evento.iscrizioni = valore;
    salvaBozza();
    disegnaSportello();
    disegnaCruscotto();
    mandaSportello(valore === 'aperte' ? '🔓 Iscrizioni aperte'
      : valore === 'chiuse' ? '🔒 Iscrizioni chiuse'
        : '📅 Si chiudono da sole alla data');
  }

  /* Cambiare stato senza pubblicare non serve a niente: chi guarda il sito
     vedrebbe ancora quello di prima. Quindi si pubblica subito, e se manca
     il token si dice chiaro che la modifica è salva ma non ancora online. */
  function mandaSportello(cosa) {
    if (!ghPronto()) {
      CA.toast(cosa + ' — salvato qui, ma sul sito non si vede ancora: manca il token di GitHub.', 9000);
      return;                       /* niente salti di scheda: il riquadro rosso lo spiega lì */
    }
    CA.toast(cosa + ' — lo pubblico…', 30000);
    pubblicaContenuti();
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
    disegnaAppello();
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
        (p.sesso === 'f' ? ' · ♀' : (p.sesso === 'm' ? ' · ♂' : '')) +
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
    /* serve solo a spartire maschi e femmine fra le squadre: all'iscrizione
       è facoltativo, e chi non l'ha detto si può completare da qui */
    var sc = crea('div', 'campo');
    var lc = document.createElement('label'); lc.textContent = 'Categoria (solo ragazzi)'; sc.appendChild(lc);
    var sx = document.createElement('select'); sx.id = 'mSesso'; sx.className = 'mini';
    [['', 'Non indicata'], ['f', 'Ragazza'], ['m', 'Ragazzo']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sx.appendChild(op);
    });
    sx.value = p ? V(p.sesso, '') : '';
    sc.appendChild(sx); g.appendChild(sc);
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
      p.sesso = $('mSesso').value;
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

  /* Chi non ha detto la categoria all'iscrizione la si completa da qui, con
     due tocchi a testa: aprire la scheda di ognuno sarebbe troppo lento a
     bordo vasca. Non si indovina dal nome — sbagliare su un ragazzino vero
     è peggio che chiedere. */
  function disegnaCategorie() {
    var box = $('boxCategorie');
    if (!box) return;
    var rag = attive('ragazzi');
    var senza = rag.filter(senzaCategoria);
    var f = rag.filter(eFemmina).length, m = rag.filter(eMaschio).length;

    if (!rag.length || !senza.length) {
      box.style.display = 'none';
      if (rag.length && (f || m)) {
        box.style.display = '';
        box.className = 'nota-box sereno';
        box.querySelector('b').textContent = '👥 Categorie a posto';
        testo('notaCategorie', f + ' ragazze e ' + m + ' ragazzi: li spartisco fra le squadre ' +
          'insieme a età e capacità in acqua.');
        $('elencoCategorie').textContent = '';
      }
      return;
    }
    box.style.display = '';
    box.className = 'nota-box attenzione';
    box.querySelector('b').textContent = '👥 Manca la categoria a ' + senza.length +
      (senza.length === 1 ? ' ragazzo' : ' ragazzi');
    testo('notaCategorie', 'All\'iscrizione era facoltativa. Segnala qui e le squadre ' +
      'verranno spartite anche per questo; se la lasci in bianco non è un problema, ' +
      'ma quei nomi vengono distribuiti alla cieca. Finora: ' + f + ' ragazze, ' + m + ' ragazzi.');

    var el = $('elencoCategorie');
    el.textContent = '';
    senza.forEach(function (p) {
      var r = crea('div', 'riga-cat');
      r.appendChild(crea('span', 'chi-cat', p.nome + ' · ' + p.eta + ' anni'));
      [['f', '♀ Ragazza'], ['m', '♂ Ragazzo']].forEach(function (o) {
        r.appendChild(bottone(o[1], 'chiaro btn-piccolo', function () { segnaCategoria(p, o[0]); }));
      });
      el.appendChild(r);
    });
  }

  function segnaCategoria(p, valore) {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var copia = JSON.parse(JSON.stringify(p));
    copia.sesso = valore;
    token().then(function (t) {
      return FB.aggiorna(t, p._id, {
        nome: copia.nome, area: copia.area, gruppo: V(copia.gruppo, ''), codice: copia.codice,
        stato: V(copia.stato, 'attiva'), creatoIl: copia.creatoIl, json: JSON.stringify(pulita(copia))
      });
    }).then(function () {
      p.sesso = valore;                 /* subito a video, senza rileggere tutto */
      disegnaCategorie();
      disegnaIscritti();
    }).catch(function (e) { CA.toast('⚠️ ' + e.message, 8000); });
  }

  /* ================= LA FINESTRA DEL RISULTATO DI UNA GARA =============
     A bordo vasca non si scrive e non si aprono tendine: si toccano le
     squadre nell'ordine in cui sono arrivate, e i punti li mette il
     programma. Sotto, le menzioni della gara — il migliore, il più
     simpatico — che a fine giornata suggeriscono i premi.              */
  var GARA_APERTA = null, ORDINE_TEMP = [], MENZIONI_TEMP = {};

  function menzioni() {
    STATO.menzioni = STATO.menzioni || {};
    return STATO.menzioni;
  }
  function scalaGara(g) {
    var pun = V(V(V(DATI.aree, {}).ragazzi, {}).punteggio, {});
    var base = [V(pun.primo, 5), V(pun.secondo, 3), V(pun.terzo, 2), V(pun.quarto, 1)];
    var doppio = (g && g.tipo === 'finale');
    return STATO.squadre.map(function (s, i) {
      var p = (base[i] !== undefined ? base[i] : 1);
      return p * (doppio ? 2 : 1);
    });
  }

  function apriModaleGara(idGioco) {
    var g = V(DATI.giochi, []).filter(function (x) { return x.id === idGioco; })[0];
    if (!g) return;
    if (!STATO.squadre.length) { CA.toast('Prima forma le squadre.', 5000); return; }
    GARA_APERTA = idGioco;
    ORDINE_TEMP = V(STATO.risultati[idGioco], []).filter(Boolean)
      .slice().sort(function (a, b) { return a.posizione - b.posizione; })
      .map(function (x) { return x.squadra; });
    var m = V(menzioni()[idGioco], {});
    MENZIONI_TEMP = {};
    Object.keys(m).forEach(function (k) { MENZIONI_TEMP[k] = m[k]; });
    testo('mgTitolo', V(g.emoji, '🎯') + ' ' + g.nome +
      (g.tipo === 'finale' ? ' — punti doppi' : ''));
    disegnaModaleGara();
    $('modaleGara').classList.add('aperta');
  }
  function chiudiModaleGara() {
    $('modaleGara').classList.remove('aperta');
    GARA_APERTA = null;
  }

  function disegnaModaleGara() {
    var el = $('mgCorpo');
    el.textContent = '';
    var g = V(DATI.giochi, []).filter(function (x) { return x.id === GARA_APERTA; })[0] || {};
    var scala = scalaGara(g);

    /* Nei giochi a eliminazione durante la gara si vede una cosa sola: chi
       esce. Segnare l'ordine d'arrivo vorrebbe dire ricostruirlo a mente al
       contrario, con i ragazzi che urlano: qui si tocca chi esce, nell'ordine
       in cui esce, e la classifica la gira il programma. */
    var aEliminazione = (V(g.ordine, '') === 'eliminazione');
    el.appendChild(crea('p', 'aiuto', aEliminazione
      ? 'Tocca le squadre nell\'ordine in cui ESCONO: la prima che resta senza nessuno è ' +
        'l\'ultima in classifica. Chi resta per ultimo vince, e non serve toccarlo. ' +
        'Se sbagli, tocchi di nuovo la squadra e torna in fondo.'
      : 'Tocca le squadre nell\'ordine in cui sono arrivate. Il primo tocco è il primo posto. ' +
        'Se sbagli, tocchi di nuovo la squadra e torna in fondo.'));

    var quante = STATO.squadre.length;
    /* nell'ordine di uscita, il posto in classifica si conta dal fondo */
    function postoDi(i) { return aEliminazione ? quante - 1 - i : i; }

    var box = crea('div', 'squadre-ordine');
    STATO.squadre.forEach(function (s) {
      var tocco = ORDINE_TEMP.indexOf(s.id);
      var pos = tocco >= 0 ? postoDi(tocco) : -1;
      var b = crea('button', 'bottone-squadra' + (tocco >= 0 ? ' presa' : ''));
      b.appendChild(crea('span', 'posto', pos >= 0 ? (['🥇', '🥈', '🥉'][pos] || (pos + 1) + '°') : '·'));
      var n = crea('span', 'nome-sq', s.nome);
      if (s.colore) n.style.borderLeft = '5px solid ' + s.colore, n.style.paddingLeft = '9px';
      b.appendChild(n);
      b.appendChild(crea('span', 'punti-sq', pos >= 0 ? '+' + V(scala[pos], 1) : '—'));
      if (aEliminazione && tocco >= 0) {
        b.appendChild(crea('span', 'mini', (tocco + 1) + 'ª uscita'));
      }
      b.addEventListener('click', function () {
        var i = ORDINE_TEMP.indexOf(s.id);
        if (i >= 0) ORDINE_TEMP.splice(i, 1);
        else ORDINE_TEMP.push(s.id);
        disegnaModaleGara();
      });
      box.appendChild(b);
    });
    el.appendChild(box);

    /* le menzioni della gara */
    var elenco = V(DATI.menzioniGara, []);
    if (elenco.length) {
      el.appendChild(crea('h3', null, 'Menzioni di questa gara'));
      el.appendChild(crea('p', 'aiuto',
        'Facoltative. A fine giornata ti dicono chi le ha prese di più, così i premi si scelgono da soli.'));
      elenco.forEach(function (mz) {
        var c = crea('div', 'campo');
        var l = document.createElement('label');
        l.textContent = V(mz.emoji, '🏅') + ' ' + V(mz.nome, mz.id);
        c.appendChild(l);
        var sel = document.createElement('select');
        var vuota = document.createElement('option');
        vuota.value = ''; vuota.textContent = '— nessuno —';
        sel.appendChild(vuota);
        if (mz.tipo === 'squadra') {
          STATO.squadre.forEach(function (s) {
            var o = document.createElement('option');
            o.value = 'sq:' + s.id; o.textContent = s.nome;
            sel.appendChild(o);
          });
        } else {
          STATO.squadre.forEach(function (s) {
            var gr = document.createElement('optgroup');
            gr.label = s.nome;
            s.componenti.forEach(function (id) {
              var p = perId(id);
              if (!p) return;
              var o = document.createElement('option');
              o.value = 'p:' + id; o.textContent = p.nome;
              gr.appendChild(o);
            });
            if (gr.children.length) sel.appendChild(gr);
          });
        }
        sel.value = V(MENZIONI_TEMP[mz.id], '');
        sel.addEventListener('change', function () { MENZIONI_TEMP[mz.id] = sel.value; });
        c.appendChild(sel);
        el.appendChild(c);
      });
    }
  }

  function salvaModaleGara() {
    if (!GARA_APERTA) return;
    var g = V(DATI.giochi, []).filter(function (x) { return x.id === GARA_APERTA; })[0] || {};
    var scala = scalaGara(g);
    /* a eliminazione si è toccato l'ordine di uscita: la classifica è quella
       rovesciata, e chi non è mai uscito sta davanti a tutti */
    var ordine = ORDINE_TEMP.slice();
    if (V(g.ordine, '') === 'eliminazione' && ordine.length) {
      var rimasti = STATO.squadre.map(function (s) { return s.id; })
        .filter(function (id) { return ordine.indexOf(id) < 0; });
      ordine = rimasti.concat(ordine.slice().reverse());
    }
    if (!ordine.length) delete STATO.risultati[GARA_APERTA];
    else {
      STATO.risultati[GARA_APERTA] = ordine.map(function (idSq, i) {
        return { squadra: idSq, posizione: i + 1, punti: V(scala[i], 1) };
      });
    }
    var m = menzioni();
    var tenute = {};
    Object.keys(MENZIONI_TEMP).forEach(function (k) {
      if (MENZIONI_TEMP[k]) tenute[k] = MENZIONI_TEMP[k];
    });
    if (Object.keys(tenute).length) m[GARA_APERTA] = tenute;
    else delete m[GARA_APERTA];
    salvaStato();
    chiudiModaleGara();
    disegnaPunteggi();
    CA.toast('✅ Risultato segnato: la classifica è già aggiornata.', 5000);
  }

  /* chi ha collezionato più menzioni: serve a scegliere i premi finali */
  function contoMenzioni() {
    var conta = {};
    var m = menzioni();
    Object.keys(m).forEach(function (idGioco) {
      Object.keys(m[idGioco]).forEach(function (idMz) {
        var v = m[idGioco][idMz];
        if (!v) return;
        conta[idMz] = conta[idMz] || {};
        conta[idMz][v] = (conta[idMz][v] || 0) + 1;
      });
    });
    return conta;
  }
  function nomeDiRiferimento(chiave) {
    if (!chiave) return '';
    if (chiave.indexOf('sq:') === 0) {
      var s = STATO.squadre.filter(function (x) { return x.id === chiave.slice(3); })[0];
      return s ? s.nome : '';
    }
    var p = perId(chiave.slice(2));
    return p ? p.nome : '';
  }

  /* =============================== APPELLO ============================
     Al cancello, alle quattro del pomeriggio, con venti persone che
     arrivano insieme: si tocca il nome e basta. Le presenze stanno nello
     stato condiviso, quindi chiunque tenga l'appello lo aggiorna per
     tutti, e chi guarda da un altro telefono lo vede.                  */
  var PRESENZE_MIE = {};        /* i nomi che ho spuntato io, in questa sessione */

  function presenze() {
    STATO.presenze = STATO.presenze || {};
    return STATO.presenze;
  }
  function segnaPresenza(p, come) {
    var pr = presenze();
    PRESENZE_MIE[p._id] = true;
    if (pr[p._id] === come) pr[p._id] = '';      /* ritocca: torna in dubbio */
    else pr[p._id] = come;
    salvaStato();
    disegnaAppello();
  }

  function disegnaAppello() {
    var el = $('elencoAppello');
    if (!el) return;
    el.textContent = '';
    var tutti = attive();
    var pr = presenze();

    var box = $('conteggiAppello');
    if (box) {
      box.textContent = '';
      var si = tutti.filter(function (p) { return pr[p._id] === 'si'; }).length;
      var no = tutti.filter(function (p) { return pr[p._id] === 'no'; }).length;
      box.appendChild(etichettaConteggio('✅ presenti', si));
      box.appendChild(etichettaConteggio('❌ assenti', no));
      box.appendChild(etichettaConteggio('❔ da spuntare', tutti.length - si - no));
    }
    if (!tutti.length) {
      el.appendChild(crea('p', 'aiuto', 'Non c\'è ancora nessun iscritto.'));
      return;
    }

    /* raggruppati per squadra se le squadre ci sono già; se no per sezione */
    var gruppi = [], dove = {};
    STATO.squadre.forEach(function (s) {
      s.componenti.forEach(function (id) { dove[id] = s.nome; });
    });
    function metti(titolo, gente) {
      if (gente.length) gruppi.push({ titolo: titolo, gente: gente });
    }
    if (STATO.squadre.length) {
      STATO.squadre.forEach(function (s) {
        metti('🚩 ' + s.nome, tutti.filter(function (p) { return dove[p._id] === s.nome; }));
      });
      metti('🤽 Ragazzi senza squadra', tutti.filter(function (p) {
        return p.area === 'ragazzi' && !dove[p._id];
      }));
    } else {
      metti('🤽 Giochi in acqua', tutti.filter(function (p) { return p.area === 'ragazzi'; }));
    }
    metti('🂡 Carte italiane', tutti.filter(function (p) { return p.gruppo === 'italiana'; }));
    metti('🃟 Burraco', tutti.filter(function (p) { return p.gruppo === 'burraco'; }));

    gruppi.forEach(function (g) {
      var c = crea('div', 'gruppo-appello');
      var presenti = g.gente.filter(function (p) { return pr[p._id] === 'si'; }).length;
      c.appendChild(crea('h3', null, g.titolo + ' — ' + presenti + ' su ' + g.gente.length));
      g.gente.slice().sort(function (a, b) {
        return String(a.nome).localeCompare(String(b.nome), 'it');
      }).forEach(function (p) {
        var stato = pr[p._id] || '';
        var r = crea('div', 'riga-appello ' + (stato === 'si' ? 'c-e' : (stato === 'no' ? 'manca' : '')));
        var n = crea('div', 'cnt');
        n.appendChild(crea('b', null, p.nome));
        n.appendChild(crea('small', null,
          (p.area === 'ragazzi' ? (p.eta ? p.eta + ' anni' : '') : V(p.livello, '')) +
          (p.appartamento ? ' · app. ' + p.appartamento : '')));
        r.appendChild(n);
        var az = crea('div', 'azioni-r');
        az.appendChild(bottone(stato === 'si' ? '✅ C\'è' : 'C\'è',
          stato === 'si' ? 'verde btn-piccolo' : 'chiaro btn-piccolo',
          function () { segnaPresenza(p, 'si'); }));
        az.appendChild(bottone(stato === 'no' ? '❌ Manca' : 'Manca',
          stato === 'no' ? 'rosso btn-piccolo' : 'chiaro btn-piccolo',
          function () { segnaPresenza(p, 'no'); }));
        r.appendChild(az);
        c.appendChild(r);
      });
      el.appendChild(c);
    });
  }

  function disegnaSquadre() {
    disegnaCategorie();
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
      var rotte = separazioniRotte(STATO.squadre);
      var ignora = ($('sqPreferenze') || {}).value === 'mai';
      CA.toast('🎲 Squadre generate: ' + (ignora
        ? 'solo età e capacità in acqua, preferenze ignorate.'
        : 'prima l\'equilibrio fra età e capacità in acqua, poi le preferenze (' +
          ESITO_PREFERENZE.fatte.length + ' rispettate).') +
        (rotte.length ? ' ⚠️ Non sono riuscito a separare ' + CA.elencoConE(rotte) +
          ': non c\'era nessuno scambio possibile.' : ''),
        rotte.length ? 12000 : 7000);
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
  /* Quanto sposta il nuoto rispetto all'età. Comanda l'età: in acqua un
     quindicenne impacciato resta più veloce di un decenne bravo, e prima
     questi due numeri erano così larghi da ribaltarlo (un decenne che nuota
     bene valeva 12, un tredicenne che nuota poco 10). Chi nuota poco viene
     comunque sparpagliato per conto suo dalle fasce, quindi non serve
     caricarlo anche qui. */
  var NUOTO_BENE = 1, NUOTO_POCO = -1.5;
  function forza(p) {
    var e = etaDi(p);
    var n = (p && p.nuoto === 'bene') ? NUOTO_BENE : ((p && p.nuoto === 'poco') ? NUOTO_POCO : 0);
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
  /* le fasce che sbilanciano davvero una gara in piscina */
  function eGrande(p) { return etaDi(p) >= 15; }
  function ePiccolo(p) { return etaDi(p) <= 10; }
  /* Maschi e femmine spartiti fra le squadre: una squadra di sole ragazze
     contro una di soli ragazzi non è una bella gara per nessuno. Chi non
     l'ha detto non viene indovinato dal nome: fa gruppo a sé e viene
     distribuito lo stesso, così non finiscono tutti nella stessa squadra. */
  function eFemmina(p) { return !!p && p.sesso === 'f'; }
  function eMaschio(p) { return !!p && p.sesso === 'm'; }
  function senzaCategoria(p) { return !!p && p.sesso !== 'f' && p.sesso !== 'm'; }
  /* si pareggia solo se qualcuno l'ha detto: con l'elenco tutto vuoto non
     avrebbe senso muovere niente */
  function categorieDichiarate() {
    return attive('ragazzi').some(function (p) { return p.sesso === 'f' || p.sesso === 'm'; });
  }

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
    var livello = ($('sqPreferenze') || {}).value || 'mai';
    var capitaniPrima = squadre.map(function (s) { return s.capitano; });

    /* Ignorarle del tutto non è «tenerne poco conto»: è non guardarle
       proprio. Nessun gruppo di amici, nessun vincolo, solo età e capacità.
       Le richieste restano scritte nelle iscrizioni e si elencano qui sotto,
       così se vuoi accontentare qualcuno lo sposti a mano. */
    if (livello === 'mai') {
      LEGATI = {}; DESIDERI = []; SALTATI = {};
      var soli = persone.map(function (p) { return { persone: [p], eta: etaDi(p) }; });
      applicaPiano(squadre, eseguiPiano(squadre, soli, perSquadra, capitaniPrima));
      scegliCapitani(squadre);
      ESITO_PREFERENZE = { fatte: [], saltate: elencaRichiesteNonUsate(persone) };
      return;
    }
    /* Quanto si lascia crescere un gruppo di amici. Più è grande, più vincola
       la distribuzione e più le squadre rischiano di sbilanciarsi: per questo
       di serie si sta stretti. */
    var maxGruppo = (livello === 'molto') ? Math.max(2, Math.floor(perSquadra / 2))
      : (livello === 'medio') ? 3 : 2;

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

  /* Le richieste ci sono state, ma non le abbiamo usate: si scrivono lo
     stesso, se no sembra che nessuno abbia chiesto niente e l'organizzatore
     non può nemmeno decidere di accontentare qualcuno a mano. */
  function elencaRichiesteNonUsate(persone) {
    var fuori = [];
    persone.forEach(function (p) {
      if (!V(p.amico, '').trim()) return;
      fuori.push(p.nome + ' aveva chiesto ' + p.amico +
        ': non l\'ho usata, hai scelto di ignorare le preferenze');
    });
    return fuori;
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
    pareggiaFasce(squadre);
    pareggiaScaglioni(squadre);
    sparpagliaDeboli(squadre);
    /* e di nuovo alla fine: scaglioni e nuotatori deboli spostano gente, e
       senza questo secondo giro una fascia già sistemata si ritrovava
       sbilanciata proprio all'ultimo (i maschi finivano 1-2-3) */
    pareggiaFasce(squadre);
    affinaForza(squadre);
    /* per ultimo chi non deve stare insieme: è un vincolo, non un desiderio,
       e va rispettato anche a costo di rovinare un po' l'equilibrio */
    separaIncompatibili(squadre);
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
    var prove = [eGrande, ePiccolo, nuotaPoco];
    if (categorieDichiarate()) prove = prove.concat([eFemmina, eMaschio]);
    prove.forEach(function (test) {
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
  function prefissiOk(squadre) { return prefissiRotti(squadre) === 0; }

  /* Quante volte la fascia alta è spartita male. Serve un conteggio e non un
     sì/no perché con squadre di misura diversa (15 ragazzi in 4 squadre) una
     divisione perfetta non esiste: pretenderla bloccava ogni scambio e le
     forze restavano sbilanciate. Meglio «non peggiorare» che «essere
     perfetti o non muoversi». */
  function prefissiRotti(squadre) {
    var n = squadre.length;
    if (n < 2) return 0;
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
    var rotti = 0;
    for (var i = 0; i < tutti.length; i++) {
      conta[tutti[i].sq]++;
      if (i + 1 > finoA) break;
      if ((i + 1) % n === 0) {
        var d = Math.max.apply(null, conta) - Math.min.apply(null, conta);
        if (d > 1) rotti += d - 1;
      }
    }
    return rotti;
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
  /* tutte le fasce da spartire, nell'ordine in cui contano */
  function pareggiaFasce(squadre) {
    pareggiaFascia(squadre, eGrande);
    pareggiaFascia(squadre, ePiccolo);
    if (!categorieDichiarate()) return;
    /* prima chi non l'ha detta, così non si ammucchiano tutti insieme; poi
       le due categorie vere, che devono avere l'ultima parola */
    pareggiaFascia(squadre, senzaCategoria);
    pareggiaFascia(squadre, eFemmina);
    pareggiaFascia(squadre, eMaschio);
  }

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
      var esce = squadre[max].componenti.filter(function (id) {
        return appartiene(perId(id)) && !LEGATI[id];
      });
      var entra = squadre[min].componenti.filter(function (id) {
        return !appartiene(perId(id)) && !LEGATI[id];
      });
      if (!esce.length || !entra.length) return;   /* solo gente legata: non si tocca */
      /* Fra tutti gli scambi che sistemano la fascia si prende quello fra due
         ragazzi di forza simile: prima si prendeva il primo che capitava, e
         raddrizzare una fascia poteva sbilanciare le squadre di brutto. */
      var meglio = null;
      esce.forEach(function (a) {
        entra.forEach(function (b) {
          var costo = Math.abs(forza(perId(a)) - forza(perId(b)));
          if (!meglio || costo < meglio.costo) meglio = { a: a, b: b, costo: costo };
        });
      });
      scambia(squadre[max], squadre[min], meglio.a, meglio.b);
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
      /* se sono nell'elenco di quelli da tenere separati, l'amicizia non
         conta: si dice subito, invece di formare il gruppo e disfarlo dopo */
      if (daSeparare(d.a._id, d.b._id)) {
        SALTATI[chiave(d)] = true;
        ESITO_PREFERENZE.saltate.push(d.a.nome + ' con ' + d.b.nome +
          ': sono nell\'elenco di quelli da non mettere mai nella stessa squadra');
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
    function scartiFasce() {
      var prove = [eGrande, ePiccolo];
      if (categorieDichiarate()) prove = prove.concat([eFemmina, eMaschio]);
      return prove.map(function (test) {
        var c = squadre.map(function (s) {
          return s.componenti.filter(function (id) { return test(perId(id)); }).length;
        });
        return Math.max.apply(null, c) - Math.min.apply(null, c);
      });
    }
    /* Uno scambio va bene se nessuna fascia peggiora. Pretendere che siano
       tutte perfette bloccava quasi ogni mossa quando le squadre non sono
       tutte della stessa misura, e le forze restavano sbilanciatissime. */
    function fasceNonPeggio(prima) {
      var dopo = scartiFasce();
      return dopo.every(function (d, i) { return d <= Math.max(1, prima[i]); });
    }
    for (var giro = 0; giro < 120; giro++) {
      var prima = scarto();
      /* si insiste finché c'è margine: spesso esiste una divisione perfetta
         e fermarsi a mezzo punto vuol dire lasciarla lì */
      if (prima < 0.05) break;
      var fasceDiPartenza = scartiFasce();
      var prefissiDiPartenza = prefissiRotti(squadre);
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
          var dopo = scarto();
          var ok = fasceNonPeggio(fasceDiPartenza) &&
            prefissiRotti(squadre) <= prefissiDiPartenza;
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

  /* ------------------- quelli da non mettere mai insieme -----------------
     Due che presi da soli valgono già una squadra: se finiscono nella stessa
     non c'è bilanciamento che tenga, perché il numero non dice tutto — si
     coprono a vicenda, si passano la palla, vincono e basta. Si separano per
     forza, alla fine, quando tutto il resto è già pareggiato: così il costo
     dello spostamento si vede e si sceglie il meno caro. */
  function coppieDaSeparare() {
    var elenco = V(DATI.separati, []);
    var fuori = [];
    elenco.forEach(function (c) {
      var a = perNomeIscritto(c.a), b = perNomeIscritto(c.b);
      if (a && b && a._id !== b._id) fuori.push([a._id, b._id]);
    });
    return fuori;
  }
  function perNomeIscritto(nome) {
    var cerca = normalizza(nome);
    if (!cerca) return null;
    return ragazziIscritti().filter(function (p) { return normalizza(p.nome) === cerca; })[0] || null;
  }
  function daSeparare(ida, idb) {
    return coppieDaSeparare().some(function (c) {
      return (c[0] === ida && c[1] === idb) || (c[0] === idb && c[1] === ida);
    });
  }
  function stannoInsieme(squadre, coppia) {
    for (var i = 0; i < squadre.length; i++) {
      var c = squadre[i].componenti;
      if (c.indexOf(coppia[0]) >= 0 && c.indexOf(coppia[1]) >= 0) return squadre[i];
    }
    return null;
  }
  /* vero se mettere «chi» in questa squadra romperebbe una separazione */
  function vietatoIn(squadra, chi, coppie, senza) {
    return coppie.some(function (c) {
      var altro = c[0] === chi ? c[1] : (c[1] === chi ? c[0] : null);
      if (!altro || altro === senza) return false;
      return squadra.componenti.indexOf(altro) >= 0;
    });
  }

  function separaIncompatibili(squadre) {
    var coppie = coppieDaSeparare();
    if (!coppie.length || squadre.length < 2) return;

    function scarto() {
      var m = squadre.map(mediaForza);
      return Math.max.apply(null, m) - Math.min.apply(null, m);
    }
    for (var giro = 0; giro < 8; giro++) {
      var rotta = null, quale = null;
      for (var i = 0; i < coppie.length && !rotta; i++) {
        var sq = stannoInsieme(squadre, coppie[i]);
        if (sq) { rotta = sq; quale = coppie[i]; }
      }
      if (!rotta) return;                       /* sono già tutti separati */

      /* si prova a spostare l'uno o l'altro, scambiandolo con qualcuno di
         un'altra squadra: vince lo scambio che lascia le forze più vicine */
      var migliore = null;
      quale.forEach(function (chi) {
        squadre.forEach(function (altra) {
          if (altra === rotta) return;
          if (vietatoIn(altra, chi, coppie, null)) return;
          altra.componenti.forEach(function (ib) {
            if (vietatoIn(rotta, ib, coppie, chi)) return;
            scambia(rotta, altra, chi, ib);
            var v = scarto();
            scambia(rotta, altra, ib, chi);     /* rimetto a posto */
            if (!migliore || v < migliore.v) migliore = { da: rotta, a: altra, chi: chi, con: ib, v: v };
          });
        });
      });
      if (!migliore) return;                    /* non c'è verso: meglio dirlo che fingere */
      scambia(migliore.da, migliore.a, migliore.chi, migliore.con);
      if (migliore.da.capitano === migliore.chi) migliore.da.capitano = '';
      if (migliore.a.capitano === migliore.con) migliore.a.capitano = '';
    }
  }

  /* L'elenco si compila con due tendine di nomi veri: scrivere a mano un
     nome vuol dire sbagliarlo, e una regola scritta male non protegge
     niente — sembra attiva e non lo è. */
  function disegnaSeparati() {
    var el = $('elencoSeparati');
    if (!el) return;
    el.textContent = '';
    var lista = V(DATI.separati, []);
    var rag = ragazziIscritti();
    if (!lista.length) {
      el.appendChild(crea('p', 'aiuto', 'Nessuna coppia da separare: le squadre si fanno solo con l\'equilibrio.'));
    }
    lista.forEach(function (c, i) {
      var r = crea('div', 'riga-iscr');
      var cnt = crea('div', 'cnt');
      var riga = crea('div');
      riga.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      function tendina(campo) {
        var s = document.createElement('select');
        s.className = 'mini';
        var vuoto = document.createElement('option');
        vuoto.value = ''; vuoto.textContent = '— scegli —';
        s.appendChild(vuoto);
        rag.forEach(function (p) {
          var o = document.createElement('option');
          o.value = p.nome; o.textContent = p.nome;
          if (normalizza(p.nome) === normalizza(V(c[campo], ''))) o.selected = true;
          s.appendChild(o);
        });
        /* un nome scritto prima che la persona si iscrivesse non va perso */
        if (c[campo] && !rag.some(function (p) { return normalizza(p.nome) === normalizza(c[campo]); })) {
          var o2 = document.createElement('option');
          o2.value = c[campo]; o2.textContent = c[campo] + ' (non è fra gli iscritti)';
          o2.selected = true;
          s.appendChild(o2);
        }
        s.addEventListener('change', function () {
          c[campo] = s.value; salvaBozza(); disegnaSeparati();
        });
        return s;
      }
      riga.appendChild(tendina('a'));
      riga.appendChild(crea('span', null, 'mai con'));
      riga.appendChild(tendina('b'));
      var via = crea('button', 'btn btn-chiaro btn-piccolo', '🗑️');
      via.addEventListener('click', function () {
        DATI.separati.splice(i, 1); salvaBozza(); disegnaSeparati();
      });
      riga.appendChild(via);
      cnt.appendChild(riga);
      if (c.perche) cnt.appendChild(crea('small', null, c.perche));
      var manca = !perNomeIscritto(c.a) || !perNomeIscritto(c.b);
      if (manca) cnt.appendChild(crea('small', null,
        '⚠️ Uno dei due non è fra gli iscritti: la regola non farà niente.'));
      r.appendChild(cnt);
      el.appendChild(r);
    });
  }

  /* chi è rimasto insieme nonostante tutto: serve per dirlo, non per tacere */
  function separazioniRotte(squadre) {
    return coppieDaSeparare().filter(function (c) { return !!stannoInsieme(squadre, c); })
      .map(function (c) {
        var a = perId(c[0]), b = perId(c[1]);
        return (a ? a.nome : '?') + ' e ' + (b ? b.nome : '?');
      });
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
      if (categorieDichiarate()) {
        var femmine = sq.componenti.filter(function (id) { return eFemmina(perId(id)); }).length;
        var maschi = sq.componenti.filter(function (id) { return eMaschio(perId(id)); }).length;
        var muti = sq.componenti.length - femmine - maschi;
        col.appendChild(crea('div', 'dati-sq',
          '♀ ' + femmine + ' · ♂ ' + maschi + (muti ? ' · ? ' + muti + ' senza categoria' : '')));
      }

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
    return torneiAttivi().filter(function (t) { return t.gruppo === idGruppo; });
  }
  /* Chi gioca un torneo di carte lo dice il **gruppo** in cui si è iscritto,
     non l'identificativo del torneo: l'organizzatore può decidere il giorno
     stesso di spezzare le carte italiane in più tornei, e chi si era iscritto
     «alle carte italiane» li gioca tutti senza doversi reiscrivere. */
  function iscrittiTorneo(idTorneo) {
    var t = torneoDati(idTorneo);
    return attive('adulti').filter(function (p) {
      if (t.gruppo && p.gruppo) return p.gruppo === t.gruppo;
      return V(p.tornei, []).some(function (x) { return x.id === idTorneo; });
    });
  }
  /* i giochi e i tornei che si fanno davvero: quelli esclusi dall'organizzatore
     spariscono da punteggi, tabelloni, classifiche e stampe */
  function giochiAttivi() {
    return V(DATI.giochi, []).filter(function (g) { return !g.escluso; });
  }
  /* I tornei che si giocano davvero: il catalogo dei contenuti passato
     attraverso la scelta fatta il giorno della festa (vedi «assetto»). */
  function torneiAttivi() {
    return CA.componiTornei(DATI.tornei, STATO.assettoCarte);
  }

  function torneoDati(id) {
    return torneiAttivi().filter(function (t) { return t.id === id; })[0] || {};
  }

  /* ------------- come si giocano le carte italiane, oggi -------------- */
  function catalogoConProve() {
    return V(DATI.tornei, []).filter(function (t) { return V(t.prove, []).length > 1; })[0] || null;
  }
  function assetto() {
    var base = catalogoConProve();
    if (!base) return { prove: [], forma: 'unico', provaFinale: '' };
    if (!STATO.assettoCarte) STATO.assettoCarte = CA.assettoPredefinito(base);
    return STATO.assettoCarte;
  }

  /* ============== CHIUDERE L'EDIZIONE E PREPARARE L'ANNO DOPO ==========
     A festa finita si mette via tutto: squadre, punteggi, premi, tornei e
     l'elenco dei ragazzi finiscono in un documento suo, «edizione_<anno>»,
     che resta nel database. Poi la giornata si azzera, ma le persone no:
     restano nell'edizione archiviata e si ripescano con un tocco l'anno
     dopo, senza richiedere a nessuno nome, età e telefono. */
  function annoEdizione() {
    var d = V(V(DATI.evento, {}).data, '');
    var m = /^(\d{4})/.exec(d);
    return m ? m[1] : String(new Date().getFullYear());
  }

  function disegnaEdizione() {
    var el = $('statoEdizione');
    if (!el) return;
    el.textContent = '';
    var anno = annoEdizione();
    var rag = attive('ragazzi').length, adu = attive('adulti').length;
    var gare = Object.keys(STATO.risultati || {}).length;
    var box = crea('div', 'nota-box info');
    box.appendChild(crea('b', null, 'Edizione ' + anno));
    box.appendChild(crea('p', 'aiuto',
      STATO.squadre.length + ' squadre · ' + gare + ' gare segnate · ' +
      rag + ' ragazzi e ' + adu + ' adulti iscritti · ' +
      Object.keys(STATO.tornei || {}).length + ' tornei di carte'));
    var vecchie = V(STATO.edizioni, []);
    if (vecchie.length) {
      box.appendChild(crea('p', 'aiuto', '📦 In archivio: ' +
        vecchie.map(function (e) {
          return e.anno + ' (' + V(e.iscritti, []).length + ' iscritti)';
        }).join(', ') + '.'));
    }
    el.appendChild(box);
  }

  function chiudiEdizione() {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var anno = annoEdizione();
    var iscritti = ISCR.filter(function (p) { return p.stato !== 'cestino'; });
    if (!confirm('Metto via tutta l\'edizione ' + anno + ':\n\n' +
      '· ' + STATO.squadre.length + ' squadre e i loro punteggi\n' +
      '· ' + Object.keys(STATO.risultati || {}).length + ' gare segnate, premi e menzioni\n' +
      '· ' + Object.keys(STATO.tornei || {}).length + ' tornei di carte\n' +
      '· l\'elenco di ' + iscritti.length + ' iscritti, con nomi e recapiti\n\n' +
      'Resta tutto nel database, in un documento a parte. Dopo, la giornata si azzera ' +
      'e si riparte puliti per l\'anno prossimo. Procedo?')) return;

    var edizione = {
      anno: anno,
      chiusa: new Date().toISOString(),
      evento: JSON.parse(JSON.stringify(V(DATI.evento, {}))),
      squadre: JSON.parse(JSON.stringify(STATO.squadre || [])),
      risultati: JSON.parse(JSON.stringify(STATO.risultati || {})),
      titoli: JSON.parse(JSON.stringify(STATO.titoli || [])),
      menzioni: JSON.parse(JSON.stringify(STATO.menzioni || {})),
      presenze: JSON.parse(JSON.stringify(STATO.presenze || {})),
      tornei: JSON.parse(JSON.stringify(STATO.tornei || {})),
      iscritti: iscritti.map(function (p) {
        return {
          nome: p.nome, area: p.area, gruppo: p.gruppo, eta: p.eta, nuoto: p.nuoto,
          categoria: p.categoria, amico: p.amico, compagno: p.compagno, livello: p.livello,
          genitore: p.genitore, telefono: p.telefono, appartamento: p.appartamento,
          note: p.note, codice: p.codice, creatoIl: p.creatoIl
        };
      })
    };
    STATO.edizioni = V(STATO.edizioni, []).filter(function (e) { return e.anno !== anno; });
    STATO.edizioni.push(edizione);
    salvaStato(true);

    /* la copia di sicurezza sul computer, prima di azzerare */
    scaricaFile('certamen-' + anno + '.json', JSON.stringify(edizione, null, 2), 'application/json');

    CA.toast('📦 Edizione ' + anno + ' messa via, e scaricata sul computer. ' +
      'Adesso puoi azzerare la giornata qui sotto: i nomi restano nell\'archivio.', 12000);
    disegnaEdizione();
  }

  /* L'anno dopo: si ripescano i ragazzi dell'ultima edizione e si rimettono
     fra gli iscritti, con un anno in più. Chi non viene si cancella in due
     tocchi; chi viene non deve riscrivere niente. */
  function riprendiIscritti() {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var vecchie = V(STATO.edizioni, []);
    if (!vecchie.length) { CA.toast('Non c\'è ancora nessuna edizione in archivio.', 6000); return; }
    var ultima = vecchie[vecchie.length - 1];
    var gente = V(ultima.iscritti, []).filter(function (p) { return p.area === 'ragazzi'; });
    if (!gente.length) { CA.toast('Nell\'edizione ' + ultima.anno + ' non ci sono ragazzi.', 6000); return; }
    var gia = {};
    ISCR.forEach(function (p) { gia[normalizza(p.nome)] = true; });
    var nuovi = gente.filter(function (p) { return !gia[normalizza(p.nome)]; });
    if (!nuovi.length) { CA.toast('Ci sono già tutti.', 5000); return; }
    if (!confirm('Rimetto fra gli iscritti ' + nuovi.length + ' ragazzi dell\'edizione ' +
      ultima.anno + ', con un anno in più.\n\nPoi controlli l\'elenco e togli chi non viene. Procedo?')) return;

    var fatti = 0;
    nuovi.reduce(function (c, p) {
      return c.then(function () {
        return token().then(function (t) {
          return FB.creaIscrizione({
            nome: p.nome, area: 'ragazzi', gruppo: 'ragazzi',
            eta: (Number(p.eta) || 0) + 1, nuoto: p.nuoto, categoria: p.categoria,
            genitore: p.genitore, telefono: p.telefono, appartamento: p.appartamento,
            note: '', creatoIl: new Date().toISOString(),
            ripreso: 'edizione ' + ultima.anno
          });
        }).then(function () { fatti++; });
      });
    }, Promise.resolve()).then(function () {
      CA.toast('📥 Rimessi ' + fatti + ' ragazzi. Controlla l\'elenco: l\'età l\'ho aumentata di uno.', 10000);
      ricarica(true);
    }).catch(function (e) {
      CA.toast('⚠️ Ne ho rimessi ' + fatti + ', poi si è fermato: ' + e.message, 9000);
    });
  }

  /* Buttare via un torneo per davvero: non «azzerare il tabellone», che
     lascia le coppie, ma cancellare tutto — coppie, partite, punteggi — e
     togliere il documento dal database, così di quel torneo non resta
     traccia da nessuna parte: né qui, né sul tabellone pubblico, né nelle
     statistiche. Serve quando si è sbagliato tutto o si stava provando. */
  function cancellaTorneo(id) {
    var st = (STATO.tornei || {})[id];
    var t = torneoDati(id);
    if (!st) { CA.toast('Questo torneo non è ancora cominciato: non c\'è niente da cancellare.', 6000); return; }
    var inc = V(st.incontri, []);
    var giocate = inc.filter(function (m) {
      return V(m.mani, []).length || (m.puntiA !== '' && m.puntiA !== undefined && m.puntiA !== null);
    }).length;
    if (!confirm('Butto via tutto quello che riguarda «' + V(t.nome, 'il torneo') + '»:\n\n' +
      '· le ' + V(st.coppie, []).length + ' coppie\n' +
      '· il tabellone, ' + inc.length + (inc.length === 1 ? ' partita' : ' partite') + '\n' +
      (giocate ? ('· i punteggi ' + (giocate === 1 ? 'della partita già giocata' : 'delle ' + giocate + ' partite già giocate') + '\n')
        : '· non è stato giocato niente\n') +
      '\nNon resta niente: né qui, né sul tabellone, né nelle statistiche. ' +
      'Le iscrizioni non si toccano. Procedo?')) return;

    delete STATO.tornei[id];
    delete SPORCHI['torneo_' + id];
    salvaStato(true);                 /* così il resto dello stato è al sicuro */

    token().then(function (tk) {
      return FB.cancellaPezzo(tk, 'torneo_' + id);
    }).then(function () {
      /* e via anche dalla bacheca pubblica, se ci era finito */
      return FB.leggiClassifica().catch(function () { return null; }).then(function (doc) {
        if (!doc || !doc.carte) return null;
        var quanti = V(doc.carte.tornei, []).length;
        doc.carte.tornei = V(doc.carte.tornei, []).filter(function (x) { return x.id !== id; });
        if (doc.carte.tornei.length === quanti) return null;
        doc.aggiornato = new Date().toISOString();
        return token().then(function (tk) { return FB.scriviClassifica(tk, doc); });
      });
    }).then(function () {
      CA.toast('🗑️ ' + V(t.nome, 'Il torneo') + ': buttato via. Non ne resta niente.', 8000);
    }).catch(function (e) {
      CA.toast('⚠️ Tolto da qui, ma il database ha detto di no: ' + e.message, 9000);
    });

    disegnaPannelloTorneo();
    disegnaTornei();
  }

  /* ------------------- il torneo veloce, dall'admin ---------------------
     La stessa procedura guidata della sala da gioco (torneo-veloce.js): si
     scelgono i giocatori — dagli iscritti o dalla rubrica, o scrivendoli —
     si formano le coppie e si genera il tabellone. Il torneo nasce qui e si
     gioca nella pagina delle partite, che è fatta per quello. */
  /* Chi ha giocato non si perde: entra in rubrica col compagno di quella
     volta, e la prossima volta il nome è già lì da toccare. */
  function archiviaGiocatori(st) {
    var r = rubricaAdmin();
    r.giocatori = V(r.giocatori, []);
    var per = {};
    r.giocatori.forEach(function (g) { per[normalizza(g.nome)] = g; });
    V(st.coppie, []).forEach(function (c) {
      var nomi = [[c.a, c.b], [c.b, c.a]];
      /* nei tornei nati dalle iscrizioni a e b sono codici: si traducono */
      nomi.forEach(function (due) {
        var chi = perId(due[0]), altro = perId(due[1]);
        var nome = chi ? chi.nome : (String(due[0] || '').length > 12 ? '' : due[0]);
        var compagno = altro ? altro.nome : (String(due[1] || '').length > 12 ? '' : due[1]);
        if (!nome) return;
        var k = normalizza(nome);
        if (per[k]) { per[k].volte = (per[k].volte || 0) + 1; if (compagno) per[k].compagno = compagno; }
        else { per[k] = { nome: nome, compagno: V(compagno, ''), volte: 1 }; r.giocatori.push(per[k]); }
      });
    });
    r.giocatori.sort(function (a, b) { return (b.volte || 0) - (a.volte || 0); });
    STATO.rubrica = r;
  }

  function rubricaAdmin() {
    STATO.rubrica = STATO.rubrica || { giocatori: [] };
    return STATO.rubrica;
  }
  function iscrittiPerTorneoVeloce() {
    return attive('adulti').map(function (p) {
      return { nome: p.nome, compagno: V(p.compagno, '') };
    });
  }
  /* Entrando nella scheda dei tornei: se non c'è niente cominciato — nessuna
     coppia, nessun tabellone — si propone la procedura guidata invece di
     lasciare una pagina di pulsanti a chi voleva solo giocare. Una volta
     sola per apertura: se dici di no, non insiste. */
  var PROPOSTO = false;
  function proponiTorneoVeloce() {
    if (PROPOSTO || !SESS) return;
    var qualcosa = Object.keys(STATO.tornei || {}).some(function (id) {
      var st = STATO.tornei[id] || {};
      return !st.archiviato && (V(st.coppie, []).length || V(st.incontri, []).length);
    });
    if (qualcosa) return;
    PROPOSTO = true;
    apriTorneoVeloce();
  }

  function apriTorneoVeloce() {
    if (!SESS) { CA.toast('Prima entra nel database: il torneo va salvato.', 6000); return; }
    if (!window.TV) { CA.toast('Manca torneo-veloce.js: ricarica la pagina con ⌘⇧R.', 8000); return; }
    TV.apri({
      velo: $('veloTv'),
      finestra: $('finestraTv'),
      rubrica: rubricaAdmin(),
      iscritti: iscrittiPerTorneoVeloce(),
      salvaRubrica: function (r) { STATO.rubrica = r; salvaStato(); },
      fatto: function (torneo) {
        var id = 'v' + Date.now();
        STATO.tornei = STATO.tornei || {};
        STATO.tornei[id] = torneo;
        salvaStato(true);
        CA.toast('✅ ' + torneo.nome + ' creato: si gioca nella pagina delle partite.', 8000);
        window.open('partite.html?t=' + encodeURIComponent(id), '_blank', 'noopener');
      }
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-tv]');
    if (b) { e.preventDefault(); apriTorneoVeloce(); }
  });

  /* Le tre prove delle carte italiane si possono mettere insieme o dividere.
     Qui si sceglie: da questa scelta escono tornei, nomi, regole e coppe. */
  function disegnaAssetto() {
    var el = $('assettoCarte');
    if (!el) return;
    el.textContent = '';
    var base = catalogoConProve();
    if (!base) { el.appendChild(crea('p', 'aiuto', 'Non ci sono tornei a più prove da comporre.')); return; }
    var a = assetto();
    var tutte = V(base.prove, []);

    /* --- quali discipline si giocano --- */
    el.appendChild(crea('h3', null, 'Quali giochi si fanno'));
    var righe = crea('div', 'filtri');
    tutte.forEach(function (p) {
      var dentro = a.prove.indexOf(p.id) >= 0;
      var b = crea('button', 'btn btn-piccolo ' + (dentro ? 'btn-p' : 'btn-chiaro'),
        (dentro ? '✅ ' : '') + V(p.emoji, '🃏') + ' ' + p.nome);
      b.addEventListener('click', function () {
        if (dentro) {
          if (a.prove.length <= 1) { CA.toast('Almeno un gioco deve restare.', 4000); return; }
          a.prove = a.prove.filter(function (x) { return x !== p.id; });
        } else {
          a.prove = tutte.map(function (x) { return x.id; })
            .filter(function (x) { return a.prove.indexOf(x) >= 0 || x === p.id; });
        }
        if (a.prove.indexOf(a.provaFinale) < 0) a.provaFinale = a.prove[a.prove.length - 1];
        applicaAssetto();
      });
      righe.appendChild(b);
    });
    el.appendChild(righe);

    /* --- tutte insieme o una per una --- */
    if (a.prove.length > 1) {
      el.appendChild(crea('h3', null, 'Un torneo solo o tornei separati'));
      var scelte = [
        { id: 'unico', tit: '🏆 Un torneo solo', spiega: 'Le prove si alternano turno dopo turno, la coppia resta la stessa e i punti si sommano: una classifica e una coppa sola.' },
        { id: 'separati', tit: '🎯 Tornei separati', spiega: 'Ogni gioco ha il suo tabellone, la sua classifica e la sua coppa. Le coppie si possono rifare da capo per ognuno.' }
      ];
      var box = crea('div', 'scelte-formato');
      scelte.forEach(function (s) {
        var scelto = V(a.forma, 'unico') === s.id;
        var b = crea('button', 'scelta-f' + (scelto ? ' presa' : ''));
        b.appendChild(crea('b', null, s.tit));
        b.appendChild(crea('small', null, s.spiega));
        b.addEventListener('click', function () { a.forma = s.id; applicaAssetto(); });
        box.appendChild(b);
      });
      el.appendChild(box);
    }

    /* --- quante volte ci si incontra --- */
    if (a.prove.length > 1 && V(a.forma, 'unico') === 'unico') {
      el.appendChild(crea('h3', null, 'Quante volte si incontrano le coppie'));
      var modi = [
        { id: 'alternato', tit: '🔄 Le prove si alternano',
          spiega: 'Un girone solo: ogni coppia incontra tutte le altre una volta, e ogni turno si gioca a un gioco diverso. Pochi turni, partite lunghe.' },
        { id: 'completo', tit: '🎴 Un giro per ogni prova',
          spiega: 'Ogni coppia incontra tutte le altre a ogni gioco: molto più completo, ma i turni si moltiplicano per il numero delle prove.' }
      ];
      var bg = crea('div', 'scelte-formato');
      modi.forEach(function (s) {
        var scelto = V(a.giro, 'alternato') === s.id;
        var b = crea('button', 'scelta-f' + (scelto ? ' presa' : ''));
        b.appendChild(crea('b', null, s.tit));
        b.appendChild(crea('small', null, s.spiega));
        b.addEventListener('click', function () { a.giro = s.id; applicaAssetto(); });
        bg.appendChild(b);
      });
      el.appendChild(bg);
    }

    /* --- con quale gioco si chiude --- */
    if (a.prove.length > 1 && V(a.forma, 'unico') === 'unico') {
      var c = crea('div', 'campo');
      c.style.maxWidth = '340px';
      var l = document.createElement('label');
      l.textContent = 'La finale si gioca a';
      c.appendChild(l);
      var sel = document.createElement('select');
      tutte.filter(function (p) { return a.prove.indexOf(p.id) >= 0; }).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id; o.textContent = p.nome;
        sel.appendChild(o);
      });
      sel.value = a.provaFinale || a.prove[a.prove.length - 1];
      sel.addEventListener('change', function () { a.provaFinale = sel.value; applicaAssetto(); });
      c.appendChild(sel);
      el.appendChild(c);
    }

    /* --- cosa viene fuori --- */
    var esito = crea('div', 'nota-box');
    esito.style.marginTop = '14px';
    var fatti = torneiAttivi().filter(function (t) { return t.gruppo === base.gruppo; });
    esito.appendChild(crea('b', null, fatti.length === 1
      ? 'Verrà fuori un torneo solo:' : 'Verranno fuori ' + fatti.length + ' tornei:'));
    var ul = document.createElement('ul');
    ul.style.cssText = 'margin:8px 0 0 20px;font-size:.94rem';
    fatti.forEach(function (t) {
      var n = V(STATO.tornei[t.id], {});
      ul.appendChild(crea('li', null, V(t.emoji, '🃏') + ' ' + t.nome + ' — ' +
        V(t.premio, 'coppa') + (V(n.coppie, []).length ? ' · ' + n.coppie.length + ' coppie già formate' : '')));
    });
    esito.appendChild(ul);
    esito.appendChild(crea('p', 'aiuto',
      'Chi si è iscritto alle carte italiane gioca tutti questi tornei: non deve reiscriversi.'));
    el.appendChild(esito);

    var az = crea('div', 'azioni');
    az.style.cssText = 'justify-content:flex-start;margin-top:12px';
    az.appendChild(bottone('↩️ Rimetti il Trittico', 'chiaro btn-piccolo', function () {
      STATO.assettoCarte = CA.assettoPredefinito(base);
      applicaAssetto();
    }));
    el.appendChild(az);
  }

  /* Applicata la scelta: si ricalcola tutto e le coppie già formate si
     portano dietro, perché sono le stesse persone. */
  function applicaAssetto() {
    var base = catalogoConProve();
    if (base) travasaCoppie(base.gruppo);
    salvaStato();
    disegnaTornei();          /* ridisegna anche la scelta qui sopra */
    disegnaPunteggi();
    disegnaCruscotto();
  }

  /* Le coppie non si perdono cambiando assetto: se il torneo nuovo non ne ha,
     si copiano da quello del gruppo che ne aveva di più. */
  function travasaCoppie(gruppo) {
    var tornei = torneiAttivi().filter(function (t) { return t.gruppo === gruppo; });
    if (!tornei.length) return;
    var migliore = null;
    Object.keys(STATO.tornei || {}).forEach(function (id) {
      if (id !== 'trittico' && id.indexOf('trittico_') !== 0) return;
      var c = V(STATO.tornei[id].coppie, []);
      if (!migliore || c.length > migliore.length) migliore = c;
    });
    if (!migliore || !migliore.length) return;
    tornei.forEach(function (t) {
      STATO.tornei[t.id] = STATO.tornei[t.id] || {};
      if (!V(STATO.tornei[t.id].coppie, []).length) {
        STATO.tornei[t.id].coppie = JSON.parse(JSON.stringify(migliore));
      }
    });
  }

  function disegnaTornei() {
    disegnaAssetto();
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
      b.addEventListener('click', function () { TORNEO_APERTO = t.id; PRESA = null; disegnaTornei(); });
      sc.appendChild(b);
    });
    disegnaPannelloTorneo();
  }

  function disegnaPannelloTorneo() {
    var el = $('pannelloTorneo');
    /* Quando una partita finisce si rifà tutto il pannello — tabellone,
       classifica, semifinali — e la pagina tornava in cima con i pieghevoli
       delle mani richiusi: chi stava segnando si ritrovava altrove. Si
       annota dov'era e cos'era aperto, e si rimette com'era. */
    var dovEro = window.scrollY;
    var aperti = {};
    el.querySelectorAll('details.mani[data-p]').forEach(function (d) {
      if (d.open) aperti[d.getAttribute('data-p')] = true;
    });
    el.textContent = '';
    if (!TORNEO_APERTO) return;
    setTimeout(function () {
      el.querySelectorAll('details.mani[data-p]').forEach(function (d) {
        if (aperti[d.getAttribute('data-p')]) d.open = true;
      });
      if (Math.abs(window.scrollY - dovEro) > 4) window.scrollTo(0, dovEro);
    }, 0);
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

    /* con un numero dispari qualcuno resta senza compagno: meglio dirlo
       adesso che scoprirlo al tavolo con le carte già in mano */
    var sole = coppie.filter(function (c) { return !c.b; });
    if (sole.length) {
      var av = crea('div', 'nota-box attenzione');
      av.style.margin = '10px 0';
      av.appendChild(crea('b', null, '⚠️ ' + (sole.length === 1
        ? 'Un giocatore è senza compagno' : sole.length + ' giocatori sono senza compagno')));
      av.appendChild(crea('p', 'aiuto',
        sole.map(function (c) { return c.nome.replace(' – (da abbinare)', ''); }).join(', ') +
        ': gli iscritti sono in numero dispari. Trovagli un compagno fra i genitori o ' +
        'fallo giocare in tre a un tavolo, poi correggi il nome della coppia qui sotto.'));
      g.appendChild(av);
    }

    var az1 = crea('div', 'azioni');
    az1.style.cssText = 'justify-content:flex-start;margin:10px 0 18px;flex-wrap:wrap';
    var bC = crea('button', 'btn btn-p btn-piccolo',
      coppie.length ? '🔄 Rifai le coppie da capo' : '👥 Forma le coppie');
    bC.addEventListener('click', function () {
      if (coppie.length && !confirm(
        'Rifaccio le coppie ' + delTorneo(t.nome) + ' da capo?\n\n' +
        cosaSiPerde(stato, iscritti) +
        '\nRestano le iscrizioni e i compagni dichiarati: quelli non si toccano.')) return;
      formaCoppie(TORNEO_APERTO);
    });
    az1.appendChild(bC);
    if (coppie.length) {
      var bAz = crea('button', 'btn btn-chiaro btn-piccolo', '🧹 Azzera le coppie');
      bAz.addEventListener('click', function () {
        if (!confirm('Tolgo tutte le coppie ' + delTorneo(t.nome) + '?\n\n' +
          cosaSiPerde(stato, iscritti) +
          '\nResti senza coppie: per rifarle premi «Forma le coppie».')) return;
        azzeraCoppie(TORNEO_APERTO);
      });
      az1.appendChild(bAz);
    }
    g.appendChild(az1);
    if (coppie.length) {
      g.appendChild(crea('p', 'aiuto',
        '«Rifai» ricalcola tutto dalle iscrizioni: chi si è dichiarato compagno resta con ' +
        'il suo, e cambiano solo gli abbinamenti fatti dal sito — che ogni volta escono ' +
        'diversi, sempre mettendo insieme un esperto e un principiante. «Azzera» le toglie ' +
        'e basta. In tutti e due i casi il tabellone se ne va e va rigenerato.'));
    }

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

    /* Andata e ritorno: si rigioca tutto a parti invertite. Ha senso solo nel
       girone — in un tabellone a eliminazione chi ha perso è già a casa. */
    if ((stato.formato || c.formato) === 'italiana') {
      var sr = crea('label', 'spunta');
      sr.style.margin = '12px 0 0';
      var cr = document.createElement('input');
      cr.type = 'checkbox';
      cr.checked = (stato.ritorno === true);
      cr.addEventListener('change', function () {
        STATO.tornei[TORNEO_APERTO] = STATO.tornei[TORNEO_APERTO] || {};
        STATO.tornei[TORNEO_APERTO].ritorno = cr.checked;
        salvaStato();
        disegnaPannelloTorneo();
        CA.toast(cr.checked
          ? '🔁 Andata e ritorno: rigenera il tabellone per vedere il ritorno.'
          : 'Solo andata: rigenera il tabellone.', 6000);
      });
      sr.appendChild(cr);
      sr.appendChild(crea('span', null, 'Andata e ritorno: ogni coppia si incontra due volte, ' +
        'a parti invertite (raddoppia i turni)'));
      g.appendChild(sr);
    }

    if (coppie.length >= 2) {
      var rd = riquadroDurata(TORNEO_APERTO, coppie, stato.formato || c.formato);
      if (rd) g.appendChild(rd);
    }

    var az2 = crea('div', 'azioni');
    az2.style.cssText = 'justify-content:flex-start;margin-top:16px';
    var bG = crea('button', 'btn btn-p', '🎲 Genera il tabellone');
    bG.addEventListener('click', function () { generaTabellone(TORNEO_APERTO); });
    az2.appendChild(bG);
    var bZ = crea('button', 'btn btn-chiaro btn-piccolo', '↩️ Cancella il tabellone');
    bZ.addEventListener('click', function () {
      if (!confirm('Cancello il tabellone ' + delTorneo(t.nome) + '?')) return;
      if (STATO.tornei[TORNEO_APERTO]) STATO.tornei[TORNEO_APERTO].incontri = [];
      salvaStato();
      disegnaPannelloTorneo();
    });
    az2.appendChild(bZ);
    var bX = crea('button', 'btn btn-chiaro btn-piccolo', '🗑️ Cancella tutto il torneo');
    bX.title = 'Coppie, tabellone e punteggi: via, e non resta niente nel database';
    bX.addEventListener('click', function () { cancellaTorneo(TORNEO_APERTO); });
    az2.appendChild(bX);
    g.appendChild(az2);
    el.appendChild(g);

    /* ---- le coppie ---- */
    if (coppie.length) {
      var cc = crea('div', 'card');
      cc.appendChild(crea('h2', null, '👥 Le coppie (' + coppie.length + ')'));
      cc.appendChild(crea('p', 'aiuto',
        'Per rifare una coppia a mano sposta i nomi: trascina un nome sopra un altro e si scambiano ' +
        'di posto. Dal telefono tocca il primo nome e poi il secondo — trascinare col dito non ' +
        'funziona bene. Puoi anche cambiare il nome della coppia: è quello che finisce sul ' +
        'tabellone pubblico.'));
      if (V(stato.incontri, []).length) {
        cc.appendChild(crea('p', 'aiuto',
          '👍 Scambiare due nomi non tocca il tabellone: le partite restano quelle, cambia solo ' +
          'chi siede al tavolo. È il modo di correggere una coppia a torneo già cominciato.'));
      }
      coppie.forEach(function (cp, i) {
        var r = crea('div', 'riga-iscr');
        var cnt = crea('div', 'cnt');
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = cp.nome; inp.className = 'mini';
        inp.addEventListener('change', function () { cp.nome = inp.value.trim(); salvaStato(); });
        cnt.appendChild(inp);
        var eti = 'coppia ' + (i + 1);
        if (cp.mano) eti += ' · fatta a mano';
        else if (cp.spaiata) eti += ' · abbinata dagli organizzatori';
        cnt.appendChild(crea('small', null, eti));
        var pd = crea('div', 'pedine-coppia');
        pd.appendChild(pedinaCoppia(cp, 'a', iscritti));
        pd.appendChild(pedinaCoppia(cp, 'b', iscritti));
        cnt.appendChild(pd);
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
        /* Dentro un turno si gioca tutto insieme: le partite partono allo
           stesso momento, una per tavolo. Va detto, se no si legge l'elenco
           come una fila e si aspetta che finisca la prima. */
        var quante = turni[k].length;
        var giocano = {};
        turni[k].forEach(function (m) { giocano[m.a] = true; giocano[m.b] = true; });
        var fermi = coppie.filter(function (c) { return !giocano[c.id]; });
        var riga = '🕓 Si gioca tutto insieme: ' + quante +
          (quante === 1 ? ' partita a un tavolo' : ' partite ai ' + quante + ' tavoli') +
          ', tutte e ' + (quante * 2) + ' le coppie in gioco nello stesso momento.';
        if (fermi.length) {
          riga += ' Riposa ' + CA.elencoConE(fermi.map(function (c) { return c.nome; })) + '.';
        }
        ci.appendChild(crea('p', 'aiuto', riga));
        turni[k].forEach(function (m) { ci.appendChild(rigaIncontroAdmin(m, coppie, TORNEO_APERTO)); });
      });
      el.appendChild(ci);

      var cl = crea('div', 'card');
      cl.appendChild(crea('h2', null, '📊 Classifica ' + delTorneo(t.nome)));
      var dentroCl = crea('div');
      dentroCl.id = 'classificaTorneo';
      dentroCl.appendChild(tabellaClassificaAdmin(classificaTorneo(TORNEO_APERTO)));
      cl.appendChild(dentroCl);
      el.appendChild(cl);

      /* ------------------------ metterlo via -------------------------
         Un torneo finito resta lì per sempre finché non lo si archivia:
         sparisce dalla sala da gioco e resta nelle statistiche, con i suoi
         punteggi. Non si cancella niente. */
      var arc = crea('div', 'card');
      var giocate = inc.filter(function (m) {
        return m.puntiA !== '' && m.puntiA !== undefined && m.puntiA !== null;
      }).length;
      var tutte = giocate === inc.length;
      arc.appendChild(crea('h2', null, stato.archiviato ? '📦 In archivio'
        : (tutte ? '🏁 Torneo finito' : '📦 Mettere via il torneo')));
      arc.appendChild(crea('p', 'aiuto', stato.archiviato
        ? 'È in archivio: non compare più nella pagina delle partite, ma resta nelle statistiche con tutti i suoi punteggi. Puoi rimetterlo in gioco quando vuoi.'
        : (tutte
          ? 'Tutte le ' + inc.length + ' partite sono giocate. Mettilo in archivio: sparisce dalla pagina delle partite e resta nelle statistiche.'
          : giocate + (giocate === 1 ? ' partita giocata su ' : ' partite giocate su ') + inc.length +
            '. Puoi archiviarlo lo stesso: quello che è stato giocato resta.')));
      var azA = crea('div', 'azioni');
      azA.style.cssText = 'justify-content:flex-start;flex-wrap:wrap';
      if (stato.archiviato) {
        azA.appendChild(bottone('↩️ Rimettilo in gioco', 'chiaro', function () {
          STATO.tornei[TORNEO_APERTO].archiviato = false;
          salvaStato();
          disegnaPannelloTorneo();
          CA.toast('↩️ Torna nella pagina delle partite.', 5000);
        }));
      } else {
        azA.appendChild(bottone('📦 Archivia il torneo', tutte ? 'p' : 'chiaro', function () {
          if (!tutte && !confirm('Il torneo non è finito: ' + giocate + ' partite su ' + inc.length +
            '. Lo archivio lo stesso?')) return;
          STATO.tornei[TORNEO_APERTO] = STATO.tornei[TORNEO_APERTO] || {};
          STATO.tornei[TORNEO_APERTO].archiviato = true;
          if (!STATO.tornei[TORNEO_APERTO].fine) STATO.tornei[TORNEO_APERTO].fine = new Date().toISOString();
          /* i giocatori restano in rubrica col compagno di questa volta:
             l'archivio conserva le partite, la rubrica le persone */
          archiviaGiocatori(STATO.tornei[TORNEO_APERTO]);
          salvaStato(true);
          disegnaPannelloTorneo();
          CA.toast('📦 In archivio. Lo ritrovi nelle statistiche.', 6000);
        }));
      }
      azA.appendChild(crea('a', 'btn btn-chiaro', '📊 Vedi le statistiche')).setAttribute('href', 'statistiche.html');
      azA.lastChild.setAttribute('target', '_blank');
      arc.appendChild(azA);
      el.appendChild(arc);
    }
  }

  /* Prima di buttare via le coppie si dice esattamente cosa se ne va: se ci
     sono punteggi già segnati è bene che si legga nero su bianco, perché
     quelli non si recuperano rigenerando il tabellone. */
  function cosaSiPerde(stato, iscritti) {
    var coppie = V(stato.coppie, []);
    var inc = V(stato.incontri, []);
    var giocate = inc.filter(function (m) {
      return String(V(m.puntiA, '')) !== '' || String(V(m.puntiB, '')) !== '';
    }).length;
    var mano = quantiRibattezzati(coppie, iscritti);
    var r = 'Adesso ci sono ' + coppie.length + ' coppie';
    r += inc.length ? ' e ' + inc.length + ' partite in tabellone' : ', e nessun tabellone';
    r += giocate ? ', di cui ' + giocate + ' con il punteggio già segnato.\n' : '.\n';
    var via = [];
    if (inc.length) via.push('il tabellone');
    if (giocate) via.push('i ' + giocate + ' punteggi segnati');
    if (mano) via.push(mano === 1 ? 'il nome della coppia che hai scritto tu'
      : 'i ' + mano + ' nomi di coppia che hai scritto tu');
    if (!via.length) return r;
    return r + '\nSi perdono: ' + CA.elencoConE(via) + '.\n';
  }
  /* I nomi delle coppie si possono correggere a mano, e quelli non tornano
     più: si contano solo quelli davvero diversi da come li scrive il sito
     (che a volte usa i nomi per esteso, quando ci sono due omonimi). */
  function quantiRibattezzati(coppie, iscritti) {
    var per = {};
    V(iscritti, []).forEach(function (p) { per[p._id] = p; });
    return coppie.filter(function (c) { return !nomeAutomatico(c, per); }).length;
  }

  /* Toglie le coppie e basta. Il tabellone deve andarsene con loro: gli
     incontri puntano alle coppie per numero, e senza quelle non vogliono
     dire più niente. */
  function azzeraCoppie(idTorneo) {
    STATO.tornei[idTorneo] = STATO.tornei[idTorneo] || {};
    STATO.tornei[idTorneo].coppie = [];
    STATO.tornei[idTorneo].incontri = [];
    salvaStato();
    disegnaPannelloTorneo();
    disegnaCruscotto();
    CA.toast('🧹 Coppie azzerate: puoi rifarle da capo.', 5000);
  }

  /* -------------------- quanto dura, davvero ----------------------------
     Le partite si giocano su più tavoli insieme: quindi il tempo non lo
     fanno le partite, lo fanno i TURNI — quante volte tutti si alzano e si
     rimettono a sedere. È la cosa che sfugge sempre, ed è quella che manda
     fuori orario un pomeriggio. */
  var CAMBIO_TAVOLO = 3;             /* minuti fra un turno e l'altro */

  function turniDi(n, formato, quanteProve) {
    if (n < 2) return 0;
    var giro = (n % 2) ? n : n - 1;                  /* dispari: uno riposa a ogni turno */
    if (formato === 'sfida') return 3;
    if (formato === 'italiana') return giro * Math.max(1, quanteProve > 1 ? quanteProve : 1);
    if (formato === 'gironi') {
      var m = Math.ceil(n / 2);
      return ((m % 2) ? m : m - 1) + 2;              /* girone + semifinali + finale */
    }
    var t = 0, resta = n;
    while (resta > 1) { resta = Math.ceil(resta / 2); t++; }
    return t;
  }

  function stimaTorneo(idTorneo, coppie, formato) {
    var td = torneoDati(idTorneo);
    var prove = V(td.prove, []);
    var n = coppie.length;
    if (n < 2) return null;
    var conTutteLeProve = (formato === 'italiana' && prove.length > 1 &&
      V(assetto().giro, 'alternato') === 'completo');
    var ritorno = (formato === 'italiana' && V(STATO.tornei[idTorneo], {}).ritorno === true);
    var doppio = ritorno ? 2 : 1;
    var turni = turniDi(n, formato, conTutteLeProve ? prove.length : 1) * doppio;
    var partite = (conTutteLeProve ? (n * (n - 1) / 2) * prove.length
      : (formato === 'italiana' ? n * (n - 1) / 2 : 0)) * doppio;
    var base = Number(td.durataPartita) || 25;

    /* Ogni gioco ha il suo passo: una partita intera di scopone dura il
       doppio di una di tresette. Quindi non c'è «una durata», c'è un blocco
       per ogni giro, ognuno con la sua. */
    var perGiro = turni, blocchi = [];
    if (conTutteLeProve) {
      perGiro = turni / prove.length;      /* il ritorno è già dentro «turni» */
      prove.forEach(function (p) {
        blocchi.push({ nome: V(p.nome, ''), emoji: V(p.emoji, ''),
          turni: perGiro, durata: Number(p.durataPartita) || base });
      });
    } else {
      blocchi.push({ nome: '', emoji: '', turni: turni, durata: base });
    }
    var minuti = 0;
    blocchi.forEach(function (b) { minuti += b.turni * (b.durata + CAMBIO_TAVOLO); });

    var sess = sessioniDi(td);
    return {
      turni: turni, partite: partite, tavoli: Math.floor(n / 2),
      durata: base, minuti: minuti, prove: prove.length, blocchi: blocchi,
      conTutteLeProve: conTutteLeProve, ritorno: ritorno,
      finestra: minutiDisponibili(sess), sessioni: sess,
      piano: pianifica(blocchi, sess)
    };
  }

  /* Le giornate in cui si gioca. Un torneo può finire il giorno dopo: se non
     ha sessioni scritte, la sua unica giornata è quella della festa. */
  function sessioniDi(td) {
    var s = V(td.sessioni, []).filter(function (x) { return x.dalle && x.alle; });
    if (s.length) return s;
    if (td.orario && td.fine) return [{ giorno: '', dalle: td.orario, alle: td.fine }];
    var righe = V(DATI.programma, []).filter(function (r) { return /^\d\d?:\d\d$/.test(V(r.ora, '')); });
    if (!righe.length || !td.orario) return [];
    return [{ giorno: '', dalle: td.orario, alle: righe[righe.length - 1].ora }];
  }
  function minutiDisponibili(sess) {
    var m = 0;
    sess.forEach(function (s) { m += inMinuti(s.alle) - inMinuti(s.dalle); });
    return m;
  }

  /* Si mettono i turni nelle giornate uno dopo l'altro, come si farebbe con
     la matita: quando una giornata è piena si passa alla successiva. Una
     partita non si spezza a metà, quindi il turno che non ci sta intero
     scivola tutto al giorno dopo. */
  function pianifica(blocchi, sess) {
    if (!sess.length) return null;
    var piano = sess.map(function (s) {
      return { giorno: V(s.giorno, ''), dalle: s.dalle, alle: s.alle,
        ora: inMinuti(s.dalle), pezzi: [], finisce: inMinuti(s.dalle) };
    });
    var i = 0, avanzati = 0;
    blocchi.forEach(function (b) {
      var resta = b.turni;
      while (resta > 0) {
        if (i >= piano.length) { avanzati += resta; return; }
        var g = piano[i];
        var passo = b.durata + CAMBIO_TAVOLO;
        var ci = Math.floor((inMinuti(g.alle) - g.ora) / passo);
        if (ci <= 0) { i++; continue; }
        var quanti = Math.min(ci, resta);
        var da = g.ora;
        g.ora += quanti * passo;
        g.finisce = g.ora - CAMBIO_TAVOLO;      /* l'ultimo cambio non serve */
        g.pezzi.push({ nome: b.nome, emoji: b.emoji, turni: quanti,
          dalle: oraDa(da), alle: oraDa(g.finisce) });
        resta -= quanti;
        if (resta > 0) i++;
      }
    });
    var usate = piano.filter(function (g) { return g.pezzi.length; });
    return { giornate: usate, avanzati: avanzati,
      fine: usate.length ? usate[usate.length - 1] : null };
  }
  function oraDa(m) {
    var o = Math.floor(m / 60) % 24, r = Math.round(m % 60);
    return (o < 10 ? '0' : '') + o + ':' + (r < 10 ? '0' : '') + r;
  }

  /* Da che ora a che ora ci sono i tavoli: dall'orario del torneo alla sua
     ora di fine, se è scritta; se no fino all'ultima riga del programma,
     che è la premiazione. */
  function finestraTorneo(td) {
    if (!td.orario) return 0;
    var fine = V(td.fine, '');
    if (!/^\d\d?:\d\d$/.test(fine)) {
      var righe = V(DATI.programma, []).filter(function (r) { return /^\d\d?:\d\d$/.test(V(r.ora, '')); });
      if (!righe.length) return 0;
      fine = righe[righe.length - 1].ora;
    }
    return inMinuti(fine) - inMinuti(td.orario);
  }
  function inMinuti(ora) {
    var p = String(ora || '').split(':');
    return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
  }
  function oreEMinuti(m) {
    m = Math.round(m);
    var o = Math.floor(m / 60), r = m % 60;
    if (!o) return r + ' minuti';
    return o + 'h' + (r < 10 ? '0' : '') + r;
  }

  /* Il riquadro che dice se ci sta o no, e cosa fare se non ci sta. */
  function riquadroDurata(idTorneo, coppie, formato) {
    var s = stimaTorneo(idTorneo, coppie, formato);
    if (!s) return null;
    var ok = !s.finestra || s.minuti <= s.finestra;
    var box = crea('div', 'nota-box' + (ok ? '' : ' attenzione'));
    box.style.margin = '12px 0 0';
    box.appendChild(crea('b', null, (ok ? '⏱️ Ci sta: ' : '⏱️ Non ci sta: ') + oreEMinuti(s.minuti)));

    var conto = s.turni + (s.turni === 1 ? ' turno' : ' turni') +
      (s.partite ? ' · ' + s.partite + ' partite' : '') +
      ' · ' + s.tavoli + (s.tavoli === 1 ? ' tavolo' : ' tavoli in parallelo') + ' · ' +
      (s.blocchi.length > 1
        ? s.blocchi.map(function (b) { return b.durata + "' a " + b.nome.toLowerCase(); }).join(', ')
        : s.durata + ' minuti a partita') +
      ', più ' + CAMBIO_TAVOLO + ' di cambio';
    box.appendChild(crea('p', 'aiuto', conto + '.'));

    /* dove cade ogni giro, ora per ora: è la cosa che si guarda davvero */
    if (s.piano && s.piano.giornate.length) {
      var ul = crea('ul', 'mini');
      ul.style.cssText = 'margin:6px 0 0 18px';
      s.piano.giornate.forEach(function (g) {
        g.pezzi.forEach(function (pz) {
          ul.appendChild(crea('li', null,
            (g.giorno ? g.giorno + ': ' : '') + pz.dalle + ' → ' + pz.alle + ' · ' +
            pz.turni + (pz.turni === 1 ? ' turno' : ' turni') +
            (pz.nome ? ' di ' + pz.nome.toLowerCase() : '')));
        });
      });
      box.appendChild(ul);
      var f = s.piano.fine;
      if (f && !s.piano.avanzati) {
        box.appendChild(crea('p', 'aiuto', 'Si chiude ' +
          (f.giorno ? f.giorno + ' ' : '') + 'alle ' + oraDa(f.finisce) +
          ': la coppa si può dare subito dopo.'));
      } else if (s.piano.avanzati) {
        box.appendChild(crea('p', 'aiuto',
          '⚠️ ' + s.piano.avanzati + (s.piano.avanzati === 1 ? ' turno resta' : ' turni restano') +
          ' fuori: non c\'è più tempo dove metterli.'));
      }
    }
    if (s.conTutteLeProve) {
      box.appendChild(crea('p', 'aiuto',
        'Ogni coppia incontra tutte le altre a tutte e ' + s.prove + ' le prove: sono ' +
        s.prove + ' gironi interi, uno per gioco, con i punti che si sommano in una classifica sola.'));
    }
    if (s.ritorno) {
      box.appendChild(crea('p', 'aiuto',
        '🔁 Andata e ritorno: ogni coppia si incontra due volte, a parti invertite. ' +
        'I turni sono il doppio, e nella classifica ognuna gioca il doppio delle partite.'));
    }
    if (s.finestra) {
      box.appendChild(crea('p', 'aiuto', 'Il tempo che hai è ' + oreEMinuti(s.finestra) +
        ', su ' + (s.sessioni.length === 1 ? 'una sola giornata' : s.sessioni.length + ' giornate') +
        ': ' + s.sessioni.map(function (x) {
          return (x.giorno ? x.giorno + ' ' : '') + x.dalle + '–' + x.alle;
        }).join(', ') + '.'));
    }
    /* con un numero dispari di coppie una sta ferma a ogni turno: è la cosa
       che fa più brutta figura, e si risolve solo trovando una coppia in più */
    if (coppie.length % 2) {
      box.appendChild(crea('p', 'aiuto',
        '⚠️ Le coppie sono ' + coppie.length + ', dispari: a ogni turno una resta a guardare. ' +
        'Con una coppia in più — bastano due persone — giocano tutti a ogni turno, ' +
        'e il torneo non dura un minuto di più.'));
    }
    if (!ok) {
      /* La domanda vera non è «quanto sfora», è «quanto può durare una
         partita». Si risponde per ogni strada possibile, con il numero. */
      box.appendChild(crea('p', 'aiuto', 'Per starci dentro, scegli una di queste:'));
      var vie = crea('ul', 'mini');
      vie.style.cssText = 'margin:2px 0 0 18px';
      var n = coppie.length;
      function quanto(turni) { return Math.floor(s.finestra / turni) - CAMBIO_TAVOLO; }
      function riga(testo) { vie.appendChild(crea('li', null, testo)); }

      var q = quanto(s.turni);
      var cosiComE = s.conTutteLeProve
        ? ('tenere tutte e ' + s.prove + ' le prove')
        : (s.ritorno ? 'tenere andata e ritorno' : 'tenere tutto così');
      riga(q >= 8
        ? (cosiComE + ' e fare partite da ' + q + ' minuti invece di ' + s.durata)
        : (cosiComE + ' non si può: verrebbero partite da ' + Math.max(q, 0) + ' minuti'));
      if (s.ritorno) riga('giocare solo l\'andata: torna a ' + (s.turni / 2) +
        ' turni e ci sta con le partite da ' + s.durata + ' minuti');
      if (s.conTutteLeProve) {
        for (var k = s.prove - 1; k >= 1; k--) {
          var qk = quanto(turniDi(n, 'italiana', k));
          if (qk >= 8) {
            riga('giocare ' + (k === 1 ? 'una prova sola' : k + ' prove') + ' invece di ' + s.prove +
              ': partite da ' + Math.min(qk, s.durata) + ' minuti' +
              (qk >= s.durata ? ' — così ci sta comoda' : ''));
          }
        }
        riga('lasciare che le prove si alternino turno dopo turno, come prima: ' +
          'si sceglie qui sopra «due gironi e finale», e ogni coppia gioca ' +
          'ogni gioco ma non contro tutti');
      }
      box.appendChild(vie);
      box.appendChild(crea('p', 'aiuto',
        'La durata di una partita si cambia in ⚙️ Contenuti, nel torneo, alla voce «minuti a partita».'));
    }
    return box;
  }

  /* ---------------- rifare una coppia spostando i nomi ------------------
     Una coppia ha due caselle e basta: quindi spostare un nome vuol dire
     per forza scambiarlo con un altro. Si trascina col mouse, oppure — ed
     è il modo che funziona sul telefono — si tocca il primo nome e poi il
     secondo. Gli identificativi delle coppie non cambiano: per questo il
     tabellone già generato resta valido. */
  function pedinaCoppia(cp, slot, iscritti) {
    var id = cp[slot];
    var p = id ? iscritti.filter(function (x) { return x._id === id; })[0] : null;
    var presa = PRESA && PRESA.coppia === cp.id && PRESA.slot === slot;
    var d = crea('div', 'pedina pedina-c' + (presa ? ' scelta' : '') + (p ? '' : ' vuota'));
    d.appendChild(crea('span', null, p ? p.nome : '— posto libero —'));
    if (p && p.livello) d.appendChild(crea('span', 'eta-p', String(p.livello)));

    if (p) {
      d.draggable = true;
      d.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', cp.id + '|' + slot);
      });
    }
    d.addEventListener('dragover', function (e) { e.preventDefault(); d.classList.add('sopra'); });
    d.addEventListener('dragleave', function () { d.classList.remove('sopra'); });
    d.addEventListener('drop', function (e) {
      e.preventDefault(); d.classList.remove('sopra');
      var parti = String(e.dataTransfer.getData('text/plain') || '').split('|');
      if (parti.length === 2) scambiaNelleCoppie({ coppia: parti[0], slot: parti[1] }, { coppia: cp.id, slot: slot });
    });
    d.addEventListener('click', function (e) {
      e.stopPropagation();
      if (PRESA && PRESA.coppia === cp.id && PRESA.slot === slot) { PRESA = null; disegnaPannelloTorneo(); return; }
      if (PRESA) { scambiaNelleCoppie(PRESA, { coppia: cp.id, slot: slot }); return; }
      if (!p) { CA.toast('Il posto è libero: tocca prima un nome, poi questo.', 4000); return; }
      PRESA = { coppia: cp.id, slot: slot };
      disegnaPannelloTorneo();
      CA.toast('Ora tocca il nome con cui scambiarlo.', 4000);
    });
    return d;
  }

  function scambiaNelleCoppie(da, a) {
    PRESA = null;
    var st = STATO.tornei[TORNEO_APERTO] || {};
    var coppie = V(st.coppie, []);
    function trova(id) { return coppie.filter(function (c) { return c.id === id; })[0]; }
    var A = trova(da.coppia), B = trova(a.coppia);
    if (!A || !B) { disegnaPannelloTorneo(); return; }
    if (A === B && da.slot === a.slot) { disegnaPannelloTorneo(); return; }

    var x = A[da.slot], y = B[a.slot];
    if (!x && !y) { disegnaPannelloTorneo(); return; }

    var iscritti = iscrittiTorneo(TORNEO_APERTO);
    var per = {};
    iscritti.forEach(function (p) { per[p._id] = p; });
    /* chi aveva ancora il nome messo dal sito lo rifà; chi l'ha scritto a
       mano se lo tiene — ma va deciso adesso, prima di spostare i nomi */
    var autoA = nomeAutomatico(A, per), autoB = nomeAutomatico(B, per);

    A[da.slot] = y; B[a.slot] = x;
    if (!A.a && !A.b || !B.a && !B.b) {                 /* nessuna coppia può restare vuota */
      A[da.slot] = x; B[a.slot] = y;
      CA.toast('Così una coppia resterebbe senza nessuno: scambia due nomi fra loro.', 6000);
      disegnaPannelloTorneo();
      return;
    }
    [A, B].forEach(function (c) { if (!c.a && c.b) { c.a = c.b; c.b = ''; } });
    A.mano = true; B.mano = true;
    if (autoA) A.nome = nomeDiCoppia(A, per);
    if (autoB) B.nome = nomeDiCoppia(B, per);
    sciogliOmonimi(coppie, iscritti);

    salvaStato();
    disegnaPannelloTorneo();
    disegnaCruscotto();
    CA.toast('👥 Coppie aggiornate.', 3000);
  }

  function nomeDiCoppia(c, per) {
    var a = per[c.a], b = per[c.b];
    return (a ? cognomino(a.nome) : '(vuoto)') + ' – ' + (b ? cognomino(b.nome) : '(da abbinare)');
  }
  /* vero se il nome è ancora quello scritto dal sito, nella forma corta o
     in quella per esteso che si usa quando ci sono due omonimi */
  function nomeAutomatico(c, per) {
    var a = per[c.a], b = per[c.b];
    if (!a) return true;
    var lungo = a.nome + ' – ' + (b ? b.nome : '(da abbinare)');
    return c.nome === nomeDiCoppia(c, per) || c.nome === lungo;
  }

  /* «le coppie di Il Trittico» non si può leggere: quando il nome comincia
     con l'articolo, la preposizione ci si fonde dentro. */
  function delTorneo(nome) {
    var n = String(nome || '').trim();
    if (!n) return 'di questo torneo';
    var m = n.match(/^(Il|Lo|La|I|Gli|Le|L')\s*(.+)$/);
    if (!m) return 'di ' + n;
    var fuse = { 'Il': 'del ', 'Lo': 'dello ', 'La': 'della ',
                 'I': 'dei ', 'Gli': 'degli ', 'Le': 'delle ', "L'": "dell'" };
    return fuse[m[1]] + m[2];
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
    /* 3. i rimasti: il più esperto con il meno esperto, e così a scendere.
       Fra chi ha lo stesso livello l'ordine è tirato a sorte: se no «rifai»
       ridarebbe ogni volta le identiche coppie, e non servirebbe a niente.
       La sorte decide solo fra pari, quindi l'equilibrio non cambia. */
    var peso = { esperto: 3, medio: 2, principiante: 1 };
    var rimasti = iscritti.filter(function (p) { return !usati[p._id]; })
      .map(function (p) { return { p: p, sorte: Math.random() }; });
    rimasti.sort(function (a, b) {
      return ((peso[b.p.livello] || 2) - (peso[a.p.livello] || 2)) || (a.sorte - b.sorte);
    });
    while (rimasti.length >= 2) {
      aggiungi(rimasti.shift().p, rimasti.pop().p, true);
    }
    if (rimasti.length === 1) aggiungi(rimasti[0].p, null, true);
    sciogliOmonimi(coppie, iscritti);

    STATO.tornei[idTorneo] = STATO.tornei[idTorneo] || {};
    STATO.tornei[idTorneo].coppie = coppie;
    STATO.tornei[idTorneo].incontri = [];
    salvaStato();
    disegnaPannelloTorneo();
    disegnaCruscotto();
    CA.toast('👥 Formate ' + coppie.length + ' coppie.', 5000);
  }
  /* «Marco Rossi» e «Marco Riva» diventano tutti e due «Marco R.»: al
     tavolo nessuno capisce più chi gioca con chi. Quando due coppie
     finiscono con lo stesso nome si torna ai nomi per esteso. */
  function sciogliOmonimi(coppie, iscritti) {
    var per = {};
    iscritti.forEach(function (p) { per[p._id] = p; });
    var quante = {};
    coppie.forEach(function (c) { quante[c.nome] = (quante[c.nome] || 0) + 1; });
    coppie.forEach(function (c) {
      if (quante[c.nome] < 2) return;
      var a = per[c.a], b = per[c.b];
      c.nome = (a ? a.nome : '?') + ' – ' + (b ? b.nome : '(da abbinare)');
    });
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

    var td = torneoDati(idTorneo);
    var prove = V(td.prove, []);
    var incontri = [];
    /* Nel girone all'italiana di un torneo a più prove si gioca tutto: ogni
       coppia incontra tutte le altre a ognuna delle prove. Sono tre gironi
       interi, non un girone solo con i giochi che si alternano. */
    var gironeCompleto = (formato === 'italiana' && prove.length > 1 &&
      V(assetto().giro, 'alternato') === 'completo');
    if (gironeCompleto) incontri = calendarioItalianaPerProva(coppie, prove);
    else if (formato === 'sfida') incontri = calendarioSfida(coppie);
    else if (formato === 'italiana') incontri = calendarioItaliana(coppie);
    else if (formato === 'gironi') incontri = calendarioGironi(coppie);
    else incontri = calendarioEliminazione(coppie);
    if (formato === 'italiana' && st.ritorno === true) incontri = aggiungiRitorno(incontri);

    /* negli altri formati ogni turno ha il suo gioco, a rotazione */
    if (!gironeCompleto) incontri = assegnaProve(incontri, prove, V(td.provaFinale, ''), formato);

    STATO.tornei[idTorneo] = STATO.tornei[idTorneo] || {};
    STATO.tornei[idTorneo].formato = formato;
    STATO.tornei[idTorneo].incontri = incontri;
    risolviSegnaposto(idTorneo);       /* se si rigenera a giochi già fatti */
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

  /* Un girone intero per ogni prova: prima tutti contro tutti a briscola,
     poi tutti contro tutti a scopone, poi a tresette. I punti si sommano in
     una classifica sola, e le coppie restano quelle. */
  function calendarioItalianaPerProva(coppie, prove) {
    var out = [];
    prove.forEach(function (p, i) {
      var giro = calendarioItaliana(coppie);
      giro.forEach(function (m) {
        m.id = 'p' + (i + 1) + m.id;
        m.prova = p.id;
        m.turno = V(p.emoji, '') + ' ' + V(p.nome, '') + ' — ' + m.turno.toLowerCase();
      });
      out = out.concat(giro);
    });
    return out;
  }

  /* Andata e ritorno: si rigioca lo stesso girone a parti invertite — chi
     scriveva a sinistra passa a destra. Punteggi e mani ripartono da zero,
     se no il ritorno nascerebbe già giocato. */
  function aggiungiRitorno(incontri) {
    var ritorno = incontri.map(function (m) {
      var r = {};
      Object.keys(m).forEach(function (k) { r[k] = m[k]; });
      r.id = 'r' + m.id;
      r.a = m.b; r.b = m.a;
      r.puntiA = ''; r.puntiB = '';
      r.mani = [];
      r.turno = 'Ritorno · ' + m.turno;
      return r;
    });
    return incontri.concat(ritorno);
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
    /* Ogni posto del tabellone si porta dietro da quale partita arriva:
       serve per riempirlo col nome vero appena quella partita è giocata.
       Senza il collegamento restavano scritte «Vincente turno 1» per tutto
       il pomeriggio e non si capiva più chi doveva giocare con chi. */
    var restano = coppie.slice(i).map(function (c) { return { id: c.id, da: null }; });
    for (var q = 0; q < quanteSfide; q++) {
      restano.push({ id: 'Vincente preliminare ' + (q + 1), da: 'p' + (q + 1) });
    }

    var turno = 1;
    while (restano.length > 1) {
      var prossimi = [], tav = 1;
      var nomeTurno = restano.length === 2 ? 'Finale' : (restano.length === 4 ? 'Semifinali' : 'Turno ' + turno);
      /* al singolare, per scrivere «Vincente semifinale 1» e non «semifinali 1» */
      var singolare = restano.length === 4 ? 'semifinale' : (restano.length === 2 ? 'finale' : 'turno ' + turno);
      for (var j = 0; j < restano.length; j += 2) {
        k++;
        var idm = 't' + turno + '_' + j;
        var A = restano[j], B = restano[j + 1] || { id: '', da: null };
        out.push({
          id: idm, turno: nomeTurno, a: A.id, b: B.id,
          da: [A.da, B.da],
          tavolo: tav++, puntiA: '', puntiB: '',
          segnaposto: !!(A.da || B.da)
        });
        prossimi.push({ id: 'Vincente ' + singolare + ' ' + (prossimi.length + 1), da: idm });
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
    /* con una disciplina sola non serve scriverla su ogni turno: si sa */
    if (prove.length < 2) {
      incontri.forEach(function (m) { m.prova = prove[0].id; });
      return incontri;
    }
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
  /* A quanti punti finisce una partita. Sta nella prova, così scopone e
     tresette possono avere traguardi diversi; se non c'è scritto niente si
     usa quello del torneo, e in mancanza di tutto i 41 classici. */
  /* Stesso ordine della sala da gioco: quello scritto sulla partita, poi
     quello scelto per il torneo, poi la prova, poi il catalogo. Così le due
     pagine non dicono mai due numeri diversi sulla stessa partita. */
  function traguardoDi(m, idTorneo) {
    var id = idTorneo || TORNEO_APERTO;
    var st = (STATO.tornei || {})[id] || {};
    var td = torneoDati(id);
    var pr = V(td.prove, []).filter(function (p) { return p.id === m.prova; })[0];
    var n = Number(V(m.traguardo, V(st.traguardo, V(pr && pr.traguardo, td.traguardo))));
    return isFinite(n) && n > 0 ? n : 41;
  }
  function sommaMani(m, lato) {
    var t = 0;
    V(m.mani, []).forEach(function (x) { t += Number(V(x[lato], 0)) || 0; });
    return t;
  }

  function rigaIncontroAdmin(m, coppie, idTorneo) {
    var id = idTorneo || TORNEO_APERTO;
    var meta = traguardoDi(m, id);
    var d = crea('div', 'incontro-adm');
    if (m.tavolo) {
      var tv = crea('span', 'tavolo-n', '🪑 Tavolo ' + m.tavolo);
      d.appendChild(tv);
    }
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
      /* questo punteggio può aver deciso chi va in semifinale o in finale:
         se sì il tabellone cambia, e va ridisegnato tutto */
      var mosso = risolviSegnaposto(id);
      salvaStato();
      if (mosso) { disegnaPannelloTorneo(); return; }
      aggiornaClassificaAVideo(id);
      evidenziaVincente();
    }
    function evidenziaVincente() {
      var a = Number(m.puntiA), b = Number(m.puntiB);
      var vale = m.puntiA !== '' && m.puntiB !== '' && isFinite(a) && isFinite(b);
      var nomi = d.querySelectorAll('b');
      nomi[0].style.color = ''; nomi[1].style.color = '';
      if (!vale) return;
      if (a > b) nomi[0].style.color = '#0f7a4a';
      if (b > a) nomi[1].style.color = '#0f7a4a';
    }
    ia.addEventListener('change', cambia);
    ib.addEventListener('change', cambia);
    cc.appendChild(ia);
    cc.appendChild(crea('span', null, '–'));
    cc.appendChild(ib);
    d.appendChild(cc);
    d.appendChild(crea('b', 'dx', nomeCoppia(m.b, coppie)));

    /* ------------------------- le mani, una per una --------------------
       Al tavolo si segnano i punti di ogni mano su un foglietto e alla fine
       qualcuno sbaglia la somma. Qui si scrivono mano per mano: il totale
       si aggiorna da solo e appena una coppia arriva al traguardo la
       partita si chiude, senza che nessuno debba contare. */
    var pieghevole = document.createElement('details');
    pieghevole.className = 'mani';
    pieghevole.setAttribute('data-p', V(m.id, ''));
    pieghevole.open = V(m.mani, []).length > 0 && !chiusa();
    var somm = document.createElement('summary');
    pieghevole.appendChild(somm);
    var dentro = crea('div', 'mani-dentro');
    pieghevole.appendChild(dentro);
    d.appendChild(pieghevole);

    /* Una mano si segna in due tempi: prima il proprio punteggio, poi quello
       degli avversari. Finché manca il secondo la partita non è finita — se
       no basta scrivere 41 da una parte per chiuderla e bloccare i campi
       mentre gli altri stanno ancora scrivendo il loro 45. */
    function manoAMetà() {
      var mani = V(m.mani, []);
      if (!mani.length) return false;
      var u = mani[mani.length - 1];
      var vuotoA = u.a === '' || u.a === undefined || u.a === null;
      var vuotoB = u.b === '' || u.b === undefined || u.b === null;
      return vuotoA !== vuotoB;
    }
    function chiusa() {
      return !!vincitriceMani();
    }
    /* Vince chi ha più punti, non chi ha passato per primo il traguardo:
       a 42 contro 45 la partita è di chi ne ha 45. E a pari punti non ha
       vinto nessuno: si dà un'altra mano. */
    function vincitriceMani() {
      if (manoAMetà()) return '';
      var a = sommaMani(m, 'a'), b = sommaMani(m, 'b');
      if (a < meta && b < meta) return '';
      if (a === b) return '';
      return a > b ? 'a' : 'b';
    }
    var nota = crea('p', 'aiuto');       /* quanto manca: si riscrive a ogni tocco */
    function scriviTotali() {
      var a = sommaMani(m, 'a'), b = sommaMani(m, 'b');
      m.mani = V(m.mani, []);
      if (m.mani.length) {                    /* le mani comandano sul totale */
        m.puntiA = a; m.puntiB = b;
        ia.value = a; ib.value = b;
      }
      var vinta = vincitriceMani();
      somm.textContent = m.mani.length
        ? ('🧮 ' + m.mani.length + (m.mani.length === 1 ? ' mano' : ' mani') +
           ' · ' + a + ' – ' + b + (vinta ? '  🏆 ' + nomeCoppia(vinta === 'a' ? m.a : m.b, coppie) : ''))
        : ('🧮 Segna le mani, una per una (si arriva a ' + meta + ')');
      somm.className = vinta ? 'vinta' : '';
      nota.textContent = !m.mani.length ? ''
        : (vinta
          ? ('🏆 Partita finita: ' + nomeCoppia(vinta === 'a' ? m.a : m.b, coppie) +
             ' ha passato i ' + meta + ' con ' + (vinta === 'a' ? a : b) + ' punti.')
          : manoAMetà()
          ? '✍️ Manca il punteggio di una delle due coppie: la partita non si chiude finché non c\'è.'
          : (a >= meta || b >= meta)
          ? ('⚖️ ' + a + ' pari: non ha vinto nessuno, si dà un\'altra mano.')
          : ('Mancano ' + Math.max(0, meta - a) + ' punti a ' + nomeCoppia(m.a, coppie) +
             ' e ' + Math.max(0, meta - b) + ' a ' + nomeCoppia(m.b, coppie) + '.'));
      nota.className = 'aiuto' + (vinta ? ' vinta' : '');
      return vinta;
    }

    /* Finita la partita non si segna più: i campi si bloccano. Al tavolo
       succede sempre che qualcuno continui a scrivere «tanto poi si vede»,
       e il punteggio buono si perde. Se c'è stato un errore c'è il pulsante
       per riaprire, che è una scelta consapevole e non una distrazione. */
    function disegnaMani() {
      dentro.textContent = '';
      m.mani = V(m.mani, []);
      var vinta = vincitriceMani();
      var bloccata = !!vinta && !m.riaperta;

      m.mani.forEach(function (mano, i) {
        var r = crea('div', 'mano-riga');
        r.appendChild(crea('span', 'n-mano', (i + 1) + 'ª'));
        [['a', m.a], ['b', m.b]].forEach(function (lato) {
          var inp = document.createElement('input');
          inp.type = 'number'; inp.inputMode = 'numeric';
          inp.value = (mano[lato[0]] === undefined || mano[lato[0]] === '') ? '' : mano[lato[0]];
          inp.disabled = bloccata;
          inp.setAttribute('aria-label', (i + 1) + 'ª mano, ' + nomeCoppia(lato[1], coppie));
          inp.addEventListener('input', function () {
            mano[lato[0]] = inp.value === '' ? '' : Number(inp.value);
            var ora = scriviTotali();
            salvaStato();
            evidenziaVincente();
            if (ora && !m.riaperta) {
              /* è finita adesso: si blocca tutto e si rifà il pannello, così
                 tabellone, classifica ed eventuali semifinali si allineano */
              CA.toast('🏆 ' + nomeCoppia(ora === 'a' ? m.a : m.b, coppie) +
                ' ha vinto: ' + sommaMani(m, ora) + ' punti. Partita chiusa.', 7000);
              risolviSegnaposto(id);
              salvaStato();
              disegnaPannelloTorneo();
              return;
            }
            aggiornaClassificaAVideo(id);
          });
          r.appendChild(inp);
        });
        var via = crea('button', 'btn btn-chiaro btn-piccolo', '🗑️');
        via.title = 'Togli questa mano';
        via.disabled = bloccata;
        via.addEventListener('click', function () {
          m.mani.splice(i, 1);
          scriviTotali(); salvaStato(); disegnaMani();
          aggiornaClassificaAVideo(id); evidenziaVincente();
        });
        r.appendChild(via);
        dentro.appendChild(r);
      });

      var az = crea('div', 'azioni');
      az.style.cssText = 'justify-content:flex-start;margin-top:6px';
      if (bloccata) {
        var riapri = crea('button', 'btn btn-chiaro btn-piccolo', '🔓 Riapri per correggere');
        riapri.addEventListener('click', function () {
          if (!confirm('La partita è finita. La riapro per correggere un punteggio?')) return;
          m.riaperta = true;
          disegnaMani();
        });
        az.appendChild(riapri);
      } else {
        var piu = crea('button', 'btn btn-p btn-piccolo', '➕ Un\'altra mano');
        piu.addEventListener('click', function () {
          m.mani.push({ a: '', b: '' });
          scriviTotali(); salvaStato(); disegnaMani();
          var campi = dentro.querySelectorAll('input:not([disabled])');
          if (campi.length) campi[campi.length - 2].focus();
        });
        az.appendChild(piu);
        if (m.riaperta && vinta) {
          var chiudi = crea('button', 'btn btn-chiaro btn-piccolo', '🔒 Ho finito');
          chiudi.addEventListener('click', function () {
            delete m.riaperta;
            salvaStato(); disegnaMani();
          });
          az.appendChild(chiudi);
        }
      }
      dentro.appendChild(az);

      dentro.appendChild(nota);
      scriviTotali();
    }

    scriviTotali();
    disegnaMani();
    if (vincitriceMani() && !m.riaperta) d.classList.add('finita');
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

  /* ================== LE FASI FINALI SI COMPILANO DA SOLE ==============
     Il tabellone nasce con i segnaposto — «1A», «Vincente semifinale 1» —
     perché quando lo si genera non si sa ancora chi passa. Appena un
     girone è finito, o una semifinale è stata giocata, i segnaposto si
     sostituiscono coi nomi veri. Senza questo il tabellone restava pieno
     di scritte e non si capiva chi doveva giocare. */
  function classificaGirone(idTorneo, lettera) {
    return classificaTorneo(idTorneo, function (m) {
      return new RegExp('^Girone ' + lettera + '\\b').test(String(m.turno || ''));
    });
  }
  function gironeCompleto(idTorneo, lettera) {
    var st = STATO.tornei[idTorneo] || {};
    var suoi = V(st.incontri, []).filter(function (m) {
      return new RegExp('^Girone ' + lettera + '\\b').test(String(m.turno || ''));
    });
    return suoi.length > 0 && suoi.every(function (m) {
      return m.puntiA !== '' && m.puntiB !== '' && m.puntiA !== undefined && m.puntiB !== undefined;
    });
  }
  function vinceIncontro(m) {
    if (m.puntiA === '' || m.puntiB === '' || m.puntiA === undefined || m.puntiB === undefined) return '';
    var pa = Number(m.puntiA), pb = Number(m.puntiB);
    if (pa === pb) return '';                 /* pari: decide chi organizza */
    return pa > pb ? m.a : m.b;
  }
  function perdeIncontro(m) {
    var v = vinceIncontro(m);
    if (!v) return '';
    return v === m.a ? m.b : m.a;
  }

  function risolviSegnaposto(idTorneo) {
    var st = STATO.tornei[idTorneo] || {};
    var inc = V(st.incontri, []);
    var per = {};
    inc.forEach(function (m) { if (m.id) per[m.id] = m; });
    var cambiato = false;
    function metti(m, campo, valore) {
      if (!m || !valore || m[campo] === valore) return;
      m[campo] = valore; cambiato = true;
    }

    /* dai gironi alle semifinali: prima e seconda di ognuno, incrociate */
    ['A', 'B'].forEach(function (L) {
      if (!gironeCompleto(idTorneo, L)) return;
      var cl = classificaGirone(idTorneo, L);
      var prima = cl[0] && cl[0].id, seconda = cl[1] && cl[1].id;
      if (L === 'A') { metti(per.sf1, 'a', prima); metti(per.sf2, 'b', seconda); }
      else { metti(per.sf2, 'a', prima); metti(per.sf1, 'b', seconda); }
    });

    /* dalle semifinali alla finale e alla finalina */
    if (per.sf1 && per.sf2) {
      metti(per.fin, 'a', vinceIncontro(per.sf1));
      metti(per.fin, 'b', vinceIncontro(per.sf2));
      metti(per.fin3, 'a', perdeIncontro(per.sf1));
      metti(per.fin3, 'b', perdeIncontro(per.sf2));
    }
    /* dal tabellone a eliminazione: ogni turno alimenta il successivo */
    inc.forEach(function (m) {
      if (!m.da) return;
      if (m.da[0]) metti(m, 'a', vinceIncontro(per[m.da[0]] || {}));
      if (m.da[1]) metti(m, 'b', vinceIncontro(per[m.da[1]] || {}));
    });
    return cambiato;
  }

  function classificaTorneo(idTorneo, filtro) {
    var st = STATO.tornei[idTorneo] || {};
    var coppie = V(st.coppie, []);
    var pun = V(V(V(DATI.aree, {}).adulti, {}).punteggio, {});
    var vv = V(pun.vittoria, 3), pp = V(pun.pareggio, 1);
    var tab = {};
    coppie.forEach(function (c) {
      tab[c.id] = { coppia: c.nome, id: c.id, g: 0, v: 0, n: 0, p: 0, punti: 0, fatti: 0, subiti: 0 };
    });
    V(st.incontri, []).forEach(function (m) {
      if (filtro && !filtro(m)) return;
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

  /* ==================== GARE A SCONTRI FRA SQUADRE =====================
     Con quattro squadre e due materassini soli non si può far giocare
     tutti insieme ai giochi che li usano. Allora si divide: due squadre
     si sfidano al gioco col materassino, le altre due a un gioco che non
     ne ha bisogno, e al turno dopo si scambiano. Da qui escono gli
     accoppiamenti, il calendario e i punteggi; con due squadre sole si
     gioca e basta, una gara dopo l'altra.                                */

  function vuoleAttrezzo(g) { return String(V(g && g.attrezzo, '')).trim(); }
  function quantiAttrezzi(nome) {
    var a = V(DATI.attrezzi, {});
    var n = Number(a[nome]);
    return isFinite(n) ? n : 0;
  }
  /* un materassino a testa: due squadre in campo, due materassini */
  function partiteInParallelo(gioco) {
    var att = vuoleAttrezzo(gioco);
    if (!att) return 99;                       /* niente da spartire */
    return Math.floor(quantiAttrezzi(att) / 2);
  }
  function torneoR() {
    STATO.torneoRagazzi = STATO.torneoRagazzi || { attivo: false, turni: [] };
    return STATO.torneoRagazzi;
  }

  /* I giochi che entrano in calendario sono quelli che danno punti e che ha
     senso giocare due squadre alla volta. Restano fuori il riscaldamento e
     le gare individuali (come nella schermata normale) e soprattutto la
     **finale**: vale doppio, e ridurla a uno scontro fra due squadre
     mentre le altre guardano sarebbe il modo peggiore di chiudere. Quella
     si segna a parte, con l'ordine d'arrivo di tutte. */
  function giochiDaScontro() {
    return giochiAttivi().filter(function (g) {
      return !g.riserva && g.scontro === true && g.tipo !== 'finale';
    });
  }
  function inCalendario(idGioco) {
    return torneoR().turni.some(function (t) {
      return t.incontri.some(function (i) { return i.gioco === idGioco; });
    });
  }

  /* Il girone all'italiana col metodo del cerchio: una squadra sta ferma
     e le altre ruotano. Con un numero dispari una riposa a ogni turno. */
  function giraSquadre(n) {
    var ids = [];
    for (var i = 0; i < n; i++) ids.push(i);
    if (ids.length % 2) ids.push(-1);          /* il posto di chi riposa */
    var m = ids.length, turni = [];
    for (var t = 0; t < m - 1; t++) {
      var coppie = [];
      for (var k = 0; k < m / 2; k++) {
        var a = ids[k], b = ids[m - 1 - k];
        if (a >= 0 && b >= 0) coppie.push([a, b]);
      }
      turni.push(coppie);
      ids.splice(1, 0, ids.pop());             /* ruota tenendo fermo il primo */
    }
    return turni;
  }

  function generaTorneoRagazzi() {
    var squadre = STATO.squadre;
    if (squadre.length < 2) { CA.toast('Servono almeno due squadre.', 5000); return; }
    var giochi = giochiDaScontro();
    if (!giochi.length) {
      CA.toast('Nessun gioco è segnato «due squadre alla volta»: si gioca tutto tutti insieme, ' +
        'e il calendario non serve.', 7000);
      return;
    }

    /* Ogni gioco segnato ha il suo giro di accoppiamenti: con quattro squadre
       sono due partite, e giocano tutte. Il giro parte da un punto diverso
       per ogni gioco, così non si ripetono sempre gli stessi incroci. */
    var giri = giraSquadre(squadre.length);
    var turni = [];
    giochi.forEach(function (g, i) {
      var coppie = giri[i % giri.length];
      var incontri = coppie.map(function (c) {
        return { gioco: g.id, a: squadre[c[0]].id, b: squadre[c[1]].id };
      });
      if (!incontri.length) return;
      turni.push({ n: turni.length + 1, gioco: g.id, incontri: incontri });
    });

    var t = torneoR();
    t.attivo = true;
    t.turni = turni;
    salvaStato();
    disegnaPunteggi();
    CA.toast('🆚 Calendario pronto: ' + turni.length +
      (turni.length === 1 ? ' gioco a scontri, ' : ' giochi a scontri, ') +
      turni.reduce(function (n, x) { return n + x.incontri.length; }, 0) + ' partite.', 7000);
  }

  function disegnaScontri() {
    var sw = $('scontriAttivi');
    if (!sw) return;
    var t = torneoR();
    sw.checked = !!t.attivo;
    var el = $('statoScontri');
    el.textContent = '';

    var n = STATO.squadre.length;
    if (n < 2) {
      el.appendChild(crea('p', 'aiuto', 'Prima forma le squadre nella scheda 🚩 Squadre.'));
      return;
    }
    var giochi = giochiDaScontro();
    var tutti = giochiAttivi().filter(function (g) {
      return !g.riserva && g.tipo !== 'finale';
    });
    var finali = giochiAttivi().filter(function (g) {
      return !g.riserva && g.tipo === 'finale';
    }).length;

    var box = crea('div', 'nota-box' + (giochi.length ? ' sereno' : ' info'));
    box.appendChild(crea('b', null, '👥 ' + n + ' squadre in acqua tutte insieme' +
      (giochi.length ? ', tranne ' + giochi.length + (giochi.length === 1 ? ' gioco' : ' giochi') : '')));
    var righe = [];
    righe.push('Di ' + tutti.length + ' gare, ' + (tutti.length - giochi.length) +
      ' si giocano con tutte e ' + n + ' le squadre insieme: si parte al via, e i punti ' +
      'si danno per ordine d\'arrivo. Non serve nessun calendario per quelle.');
    if (giochi.length) {
      righe.push('🆚 Segnate «due squadre alla volta»: ' +
        CA.elencoConE(giochi.map(function (g) { return V(g.emoji, '') + ' ' + g.nome; })) +
        '. Per queste il calendario fa gli accoppiamenti: con ' + n + ' squadre ' +
        (n % 2 ? 'sono ' + Math.floor(n / 2) + ' partite e una squadra riposa'
          : 'sono ' + (n / 2) + ' partite e giocano tutte') + ', una per gioco.');
      righe.push('Si cambia gioco per gioco in 🎯 Settaggio giochi acquatici, con la spunta ' +
        '«Si gioca due squadre alla volta».');
    } else {
      righe.push('Nessun gioco è segnato «due squadre alla volta»: oggi si gioca tutto insieme. ' +
        'La spunta sta in 🎯 Settaggio giochi acquatici, dentro ogni gioco.');
    }
    var mat = quantiAttrezzi('materassino');
    var conMat = tutti.filter(function (g) { return !g.scontro && vuoleAttrezzo(g); }).length;
    if (conMat && mat < n) {
      righe.push('🛟 Attenzione: i materassini sono ' + mat + ' e le squadre ' + n +
        '. Alle ' + conMat + ' gare col materassino non ci stanno tutte insieme: o ne trovi ' +
        (n - mat) + ' in più, o segni anche quelle «due squadre alla volta».');
    } else if (conMat) {
      righe.push('🛟 ' + mat + ' materassini per ' + n + ' squadre: alle gare col materassino ' +
        'ci stanno tutte insieme.');
    }
    if (finali) {
      righe.push('La finale resta fuori dal calendario e si segna a parte, con l\'ordine ' +
        'd\'arrivo di tutte le squadre: vale doppio, ridurla a due squadre sarebbe un peccato.');
    }
    if (t.attivo && t.turni.length) {
      var fatti = 0, tot = 0;
      t.turni.forEach(function (x) {
        x.incontri.forEach(function (i) { tot++; if (vincitoreDi(i.gioco)) fatti++; });
      });
      righe.push('Calendario: ' + t.turni.length + ' turni, ' + tot + ' scontri, ' +
        fatti + ' già giocati.');
    }
    righe.forEach(function (r) { box.appendChild(crea('p', 'aiuto', r)); });
    el.appendChild(box);
  }

  function spegniTorneoRagazzi() {
    var t = torneoR();
    t.attivo = false;
    salvaStato();
    disegnaPunteggi();
  }

  /* Il risultato di uno scontro si scrive nella stessa forma di una gara
     normale — primo e secondo — così classifiche, bacheca, stampe e sito
     continuano a funzionare senza sapere niente del torneo. */
  /* Un gioco a coppie ha più di una partita nello stesso momento: pallanuoto
     con quattro squadre sono due campi che giocano insieme. Il risultato del
     gioco è uno solo, e si costruisce mettendo insieme le partite — prima si
     sovrascriveva, e segnando la seconda spariva la prima. Chi vince la sua
     partita prende i punti del primo, chi la perde quelli del terzo: in una
     sfida diretta si vince o si perde, non c'è un secondo e un quarto. */
  function segnaScontro(inc, vincitore) {
    var g = V(DATI.giochi, []).filter(function (x) { return x.id === inc.gioco; })[0] || {};
    var pun = V(V(V(DATI.aree, {}).ragazzi, {}).punteggio, {});
    var scala = String(V(g.punti, '')).split('/').map(function (x) {
      return Number(String(x).replace(/\D/g, '')) || 0;
    });
    var primo = scala[0] || V(pun.primo, 5);
    var terzo = scala[2] || V(pun.terzo, 2);

    var esiti = V(torneoR().esiti, {});
    esiti[inc.gioco] = esiti[inc.gioco] || {};
    var chiave = inc.a + '|' + inc.b;
    if (!vincitore) delete esiti[inc.gioco][chiave];
    else esiti[inc.gioco][chiave] = vincitore;
    torneoR().esiti = esiti;

    /* dalle partite segnate esce la classifica del gioco */
    var vinte = [], perse = [];
    Object.keys(esiti[inc.gioco]).forEach(function (k) {
      var due = k.split('|'), chi = esiti[inc.gioco][k];
      vinte.push(chi);
      perse.push(due[0] === chi ? due[1] : due[0]);
    });
    if (!vinte.length) delete STATO.risultati[inc.gioco];
    else {
      STATO.risultati[inc.gioco] =
        vinte.map(function (id) { return { squadra: id, posizione: 1, punti: primo }; })
          .concat(perse.map(function (id) { return { squadra: id, posizione: 3, punti: terzo }; }));
    }
    salvaStato();
    aggiornaClassificaRagazziAVideo();
  }

  /* Il calendario: un riquadro per turno, dentro gli scontri in parallelo.
     Si tocca la squadra che ha vinto e basta — a bordo vasca, con le mani
     bagnate, non si scrivono numeri. */
  function disegnaCalendarioScontri(el) {
    var t = torneoR();
    var nome = {};
    STATO.squadre.forEach(function (s) { nome[s.id] = s.nome; });

    if (!t.turni.length) {
      var v = crea('div', 'card');
      v.appendChild(crea('p', 'aiuto', 'Il calendario non c\'è ancora: generalo qui sopra.'));
      el.appendChild(v);
      return;
    }

    t.turni.forEach(function (turno) {
      var c = crea('div', 'gioco-punti');
      var fatti = turno.incontri.filter(function (i) { return !!vincitoreDi(i.gioco); }).length;
      c.appendChild(crea('h3', null, 'Turno ' + turno.n +
        ' — ' + fatti + ' su ' + turno.incontri.length + ' giocati'));
      /* chi non è in campo in questo turno guarda: meglio dirlo che
         lasciare due squadre a chiedersi se le abbiamo dimenticate */
      var inCampo = {};
      turno.incontri.forEach(function (i) { inCampo[i.a] = true; inCampo[i.b] = true; });
      var fermi = STATO.squadre.filter(function (s) { return !inCampo[s.id]; });
      if (fermi.length) {
        c.appendChild(crea('p', 'aiuto', '⏸️ Riposano: ' +
          fermi.map(function (s) { return s.nome; }).join(', ') + '.'));
      }

      turno.incontri.forEach(function (inc) {
        var g = V(DATI.giochi, []).filter(function (x) { return x.id === inc.gioco; })[0] || {};
        var riga = crea('div', 'scontro');
        riga.appendChild(crea('div', 'gioco-scontro',
          V(g.emoji, '🎯') + ' ' + V(g.nome, inc.gioco) +
          (vuoleAttrezzo(g) ? ' · 🛟 ' + vuoleAttrezzo(g) : '')));

        var vinto = vincitoreDi(inc.gioco);
        var sfida = crea('div', 'due-squadre');
        [inc.a, inc.b].forEach(function (id, i) {
          var b = crea('button', 'squadra-scontro' + (vinto === id ? ' vince' : ''),
            (vinto === id ? '🏆 ' : '') + V(nome[id], '—'));
          b.addEventListener('click', function () {
            segnaScontro(inc, vinto === id ? '' : id);   /* ritocca: annulla */
            disegnaCalendarioAVideo();
          });
          sfida.appendChild(b);
          if (i === 0) sfida.appendChild(crea('span', 'contro', 'contro'));
        });
        riga.appendChild(sfida);
        c.appendChild(riga);
      });
      el.appendChild(c);
    });

    var nota = crea('div', 'card');
    nota.appendChild(crea('p', 'aiuto',
      'Tocca la squadra che ha vinto: prende i punti del primo, l\'altra quelli del ' +
      'terzo — in una sfida diretta si vince o si perde, non c\'è un secondo. Le partite ' +
      'dello stesso gioco si sommano, quindi puoi segnarle una alla volta senza perdere le ' +
      'altre, e la classifica qui sopra si aggiorna da sola. Toccando di nuovo la stessa ' +
      'squadra si annulla il risultato.'));
    if (t.usiAttrezzo) {
      var conti = STATO.squadre.map(function (s) {
        return s.nome + ': ' + V(t.usiAttrezzo[s.id], 0);
      }).join(' · ');
      nota.appendChild(crea('p', 'aiuto', '🛟 Quante volte tocca il materassino a ognuna — ' + conti));
    }
    el.appendChild(nota);
  }

  /* si ridisegna solo il calendario e la classifica, non tutta la scheda:
     se no sotto il dito sparisce quello che si sta toccando */
  function disegnaCalendarioAVideo() {
    disegnaPuntiRagazzi();
  }
  function aggiornaClassificaRagazziAVideo() {
    aggiornaBachecaSePuoi();
  }

  function vincitoreDi(idGioco) {
    var r = V(STATO.risultati[idGioco], []).filter(Boolean);
    var primo = r.filter(function (x) { return x.posizione === 1; })[0];
    return primo ? primo.squadra : '';
  }

  /* ====================== LA MUSICA DELLA GIORNATA =====================
     Sigla e jingle a portata di dito, senza doverli cercare nel telefono
     mentre quindici ragazzi aspettano a bordo vasca. I file stanno nel
     sito, in «audio/»: si possono caricare da qui, dal telefono, come le
     foto dell'album.                                                     */
  var POSTI_AUDIO = [
    { id: 'sigla', emoji: '🎵', cosa: 'la sigla' },
    { id: 'jingle', emoji: '📣', cosa: 'il jingle' }
  ];
  var AUDIO_DA_CARICARE = '';

  /* La sigla pesa quattro megabyte: se il telefono comincia a scaricarla solo
     quando premi «play», resti lì col dito alzato e sembra rotta. Appena apri
     la scheda dei punteggi la si tira giù in silenzio — c'è tutto il tempo,
     di solito la scheda si apre molto prima delle 16:00 — e si dice a che
     punto è, perché una barra che non si muove è peggio di niente. */
  var AUDIO_SCALDATO = false;
  function scaldaAudio() {
    if (AUDIO_SCALDATO) return;
    var lettori = [].slice.call(document.querySelectorAll('#lettoriAudio audio'));
    if (!lettori.length) return;
    AUDIO_SCALDATO = true;
    var pronti = 0, quanti = lettori.length;
    testo('statoAudioPronto', '⏳ Sto scaricando la musica, così parte subito quando serve…');
    lettori.forEach(function (a) {
      function fatto() {
        pronti++;
        if (pronti < quanti) return;
        var durate = lettori.map(function (x) {
          return isFinite(x.duration) ? (Math.floor(x.duration / 60) + ':' +
            due(Math.round(x.duration % 60))) : '?';
        });
        testo('statoAudioPronto', '✅ Musica pronta: parte al primo tocco (' + durate.join(' e ') + ').');
      }
      a.addEventListener('canplaythrough', fatto, { once: true });
      a.addEventListener('error', function () {
        testo('statoAudioPronto', '⚠️ Non riesco a scaricare la musica: controlla la rete. ' +
          'Il pulsante funziona lo stesso, ma ci metterà qualche secondo.');
      }, { once: true });
      a.preload = 'auto';
      try { a.load(); } catch (e) { }
    });
  }

  function disegnaAudio() {
    AUDIO_SCALDATO = false;      /* i lettori sono nuovi: vanno riscaldati di nuovo */
    var el = $('lettoriAudio');
    if (!el) return;
    el.textContent = '';
    DATI.audio = V(DATI.audio, {});
    POSTI_AUDIO.forEach(function (posto) {
      var a = DATI.audio[posto.id] = V(DATI.audio[posto.id], {});
      var box = crea('div', 'posto-audio');

      var t = crea('div', 'testa-audio');
      t.appendChild(crea('b', null, posto.emoji + ' ' + V(a.titolo, posto.cosa)));
      if (a.sottotitolo) t.appendChild(crea('small', null, a.sottotitolo));
      box.appendChild(t);

      if (V(a.file, '')) {
        var p = document.createElement('audio');
        p.controls = true;
        /* all'apertura della pagina non si scarica niente: i quattro megabyte
           partono quando si apre la scheda dei punteggi, dove serve */
        p.preload = 'none';
        p.src = a.file;
        p.style.cssText = 'width:100%;max-width:520px;margin:8px 0';
        box.appendChild(p);
      } else {
        box.appendChild(crea('p', 'aiuto',
          'Non c\'è ancora. Caricalo da qui, oppure mettilo nel sito come ' +
          '«audio/' + posto.id + '.mp3» e scrivi quel nome nei contenuti.'));
      }

      var az = crea('div', 'azioni');
      az.style.cssText = 'justify-content:flex-start;margin-top:4px';
      az.appendChild(bottone((V(a.file, '') ? '🔁 Sostituisci' : '⬆️ Carica') + ' ' + posto.cosa,
        'chiaro btn-piccolo', function () {
          AUDIO_DA_CARICARE = posto.id;
          $('fileAudio').value = '';
          $('fileAudio').click();
        }));
      if (V(a.file, '')) {
        az.appendChild(bottone('🗑️ Togli', 'rosso btn-piccolo', function () {
          if (!confirm('Tolgo ' + posto.cosa + ' dalla pagina?')) return;
          a.file = '';
          salvaBozzaFraPoco();
          disegnaAudio();
        }));
      }
      box.appendChild(az);
      el.appendChild(box);
    });
  }

  function caricaAudio(file) {
    var posto = AUDIO_DA_CARICARE;
    if (!posto || !file) return;
    if (!/^audio\//.test(file.type || '') && !/\.(mp3|m4a|ogg|wav)$/i.test(file.name || '')) {
      testo('statoAudio', '⚠️ Questo non sembra un file audio.');
      return;
    }
    if (!ghPronto()) {
      testo('statoAudio', '⚠️ Manca il token di GitHub: serve per mettere il file nel sito. ' +
        'Ti porto nella scheda 📣 Pubblica.');
      chiediGh();
      return;
    }
    /* venti megabyte è già tantissimo per un pezzo: oltre, quasi certamente
       è il file sbagliato */
    if (file.size > 20 * 1024 * 1024) {
      testo('statoAudio', '⚠️ Il file pesa ' + Math.round(file.size / 1024 / 1024) +
        ' MB: troppo. Esporta una versione più leggera.');
      return;
    }
    testo('statoAudio', '⏳ Preparo ' + file.name + '…');
    leggiBase64(file).then(function (b64) {
      var nome = 'audio/' + posto + estensione(file.name);
      testo('statoAudio', '📤 Sto caricando ' + nome + ' (' +
        Math.round(file.size / 1024 / 1024 * 10) / 10 + ' MB)…');
      return ghPut(nome, b64, 'Audio: ' + nome).then(function () {
        DATI.audio[posto].file = nome;
        salvaBozzaFraPoco();
        disegnaAudio();
        testo('statoAudio', '✅ Caricato. Adesso premi «Pubblica contenuti.json» ' +
          'nella scheda 📣 Pubblica, se no il sito non sa che c\'è.');
      });
    }).catch(function (e) {
      testo('statoAudio', '⚠️ ' + e.message);
    });
  }

  function estensione(nome) {
    var m = String(nome || '').match(/(\.[a-z0-9]{2,4})$/i);
    return m ? m[1].toLowerCase() : '.mp3';
  }
  function leggiBase64(file) {
    return new Promise(function (ok, ko) {
      var l = new FileReader();
      l.onerror = function () { ko(new Error('non riesco a leggere il file')); };
      l.onload = function () { ok(String(l.result).split(',')[1]); };
      l.readAsDataURL(file);
    });
  }

  /* ========================= CRONOMETRO DELLA GARA =====================
     Ogni gioco ha il suo tempo massimo. Il conto alla rovescia non si
     scala di secondo in secondo: si ricalcola ogni volta dall'orario di
     avvio, così resta giusto anche se il telefono si blocca, la pagina
     finisce in secondo piano o la si ricarica per sbaglio.
     Vive dentro lo stato condiviso: se lo fa partire uno, lo vedono
     tutti gli altri organizzatori. Quando scade suona, e allora si
     assegnano i punti a chi è avanti in quel momento.               */
  var TIC = null, SIRENA = null, AUDIO = null, USCITA = null, SUONANDO = [];

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

  /* --- la sirena: fatta al momento, senza file audio.
     Deve zittire una piscina piena di ragazzi che urlano, quindi non è un
     bip: è un ululato che sale e scende, con le armoniche là dove l'orecchio
     sente di più (fra 1 e 4 kHz), spinto a un soffio dal massimo e tenuto lì
     da un saturatore — che non fa gracchiare e anzi lo rende più ruvido,
     cioè più difficile da ignorare. --- */
  var SIRENATA_MS = 2400;         /* quanto dura un ululato */

  function preparaAudio() {
    try {
      AUDIO = AUDIO || new (window.AudioContext || window.webkitAudioContext)();
      if (AUDIO.state === 'suspended') AUDIO.resume();
      if (!USCITA) USCITA = costruisciUscita();
    } catch (e) { AUDIO = null; USCITA = null; }
  }

  /* La catena d'uscita, costruita una volta sola: tutto il volume che il
     dispositivo può dare, senza sforare. Nell'ordine:
       1. via i bassi, che un altoparlante da tablet non riesce comunque a
          fare e che ruberebbero solo spazio;
       2. si entra nel saturatore ben carichi, e lui arrotonda le punte invece
          di tagliarle di netto — è questo che rende il suono pieno e ruvido;
       3. un tetto in fondo, che non lascia passare niente oltre il massimo.
     Il tetto serve davvero: il saturatore lavora a frequenza quadruplicata e
     nel tornare indietro fa dei piccoli rimbalzi oltre il bordo. Con il tetto
     si può tenere il volume alto invece di abbassarlo per prudenza.
     Misurato sul codice vero: 26 dB più forte della sirena di prima — a
     orecchio, sei volte tanto — e mai un campione oltre il fondoscala. */
  function costruisciUscita() {
    var alto = AUDIO.createBiquadFilter();
    alto.type = 'highpass'; alto.frequency.value = 320; alto.Q.value = 0.7;
    var dentro = AUDIO.createGain();
    dentro.gain.value = 2.8;
    var forma = AUDIO.createWaveShaper();
    forma.curve = curvaSatura(2.6);
    forma.oversample = '4x';
    var tetto = AUDIO.createWaveShaper();
    forma.connect(tetto);
    tetto.curve = curvaTetto();
    alto.connect(dentro); dentro.connect(forma);
    tetto.connect(AUDIO.destination);
    return alto;
  }
  /* la curva che arrotonda: da riga dritta a onda quadra man mano che si sale */
  function curvaSatura(forza) {
    var n = 2048, c = new Float32Array(n), i, x;
    for (i = 0; i < n; i++) {
      x = (i * 2) / (n - 1) - 1;
      c[i] = Math.tanh(forza * x) / Math.tanh(forza);
    }
    return c;
  }
  /* il tetto: sotto 0,8 non tocca niente, sopra piega e non passa mai 0,93 */
  function curvaTetto() {
    var n = 2048, c = new Float32Array(n), i, x, a, segno, GOM = 0.8, CIMA = 0.95;
    for (i = 0; i < n; i++) {
      x = (i * 2) / (n - 1) - 1;
      a = Math.abs(x); segno = x < 0 ? -1 : 1;
      c[i] = a <= GOM ? x
        : segno * (GOM + (CIMA - GOM) * Math.tanh((a - GOM) / (CIMA - GOM)));
    }
    return c;
  }

  function unaSirenata() {
    if (!AUDIO || !USCITA) return;
    try {
      var t = AUDIO.currentTime + 0.02;
      var dur = SIRENATA_MS / 1000;
      var giri = 3, mezzo = dur / (giri * 2);   /* tre salite e tre discese */
      var BASSA = 620, ALTA = 1560;

      /* dentro e fuori di colpo: nessuna dissolvenza, o si perde metà colpo */
      var busta = AUDIO.createGain();
      busta.gain.setValueAtTime(0.0001, t);
      busta.gain.exponentialRampToValueAtTime(1, t + 0.012);
      busta.gain.setValueAtTime(1, t + dur - 0.06);
      busta.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      busta.connect(USCITA);

      /* quattro voci sulla stessa salita: la nota, la sua ottava, la
         dodicesima e una gemella appena scordata che fa battere il suono */
      var voci = [];
      [['sawtooth', 1, 0.50], ['square', 2, 0.30],
       ['square', 3, 0.16], ['sawtooth', 1.008, 0.34]].forEach(function (v) {
        var o = AUDIO.createOscillator(), g = AUDIO.createGain();
        o.type = v[0]; g.gain.value = v[2];
        o.frequency.setValueAtTime(BASSA * v[1], t);
        for (var i = 0; i < giri * 2; i++) {
          o.frequency.linearRampToValueAtTime((i % 2 === 0 ? ALTA : BASSA) * v[1],
            t + mezzo * (i + 1));
        }
        o.connect(g); g.connect(busta);
        o.start(t); o.stop(t + dur + 0.05);
        voci.push(o);
      });

      /* si tiene da parte per poterla spegnere a metà se qualcuno preme
         «Basta sirena»: se no continuerebbe fino alla fine dell'ululato */
      var riga = { busta: busta, voci: voci };
      SUONANDO.push(riga);
      voci[voci.length - 1].onended = function () {
        var i = SUONANDO.indexOf(riga);
        if (i >= 0) SUONANDO.splice(i, 1);
      };
    } catch (e) { }
  }

  function fermaVoci() {
    if (!AUDIO || !SUONANDO.length) return;
    var t = AUDIO.currentTime;
    SUONANDO.forEach(function (r) {
      try {
        r.busta.gain.cancelScheduledValues(t);
        r.busta.gain.setValueAtTime(Math.max(0.0001, r.busta.gain.value), t);
        r.busta.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      } catch (e) { }
      r.voci.forEach(function (o) { try { o.stop(t + 0.07); } catch (e) { } });
    });
    SUONANDO = [];
  }

  function suona() {
    if (SIRENA) return;
    preparaAudio();
    unaSirenata();
    try { if (navigator.vibrate) navigator.vibrate([700, 200, 700, 200, 1000]); } catch (e) { }
    SIRENA = setInterval(unaSirenata, SIRENATA_MS + 450);
    /* non suona all'infinito: dopo un minuto smette da sola */
    setTimeout(zittisci, 60000);
    var z = $('btnCronZitto');
    if (z) z.style.display = '';
  }
  function zittisci() {
    if (SIRENA) { clearInterval(SIRENA); SIRENA = null; }
    fermaVoci();
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { }
    var z = $('btnCronZitto');
    if (z) z.style.display = 'none';
  }

  function disegnaCronometro() {
    var sel = $('cronGioco');
    if (!sel) return;
    var c = cron();

    /* La tendina segue la scaletta: prima le gare in programma nell'ordine
       vero, con l'ora in cui toccano, poi le riserve in fondo. Si rifà solo
       se qualcosa è cambiato davvero, se no perde il tocco sotto il dito. */
    var giochi = V(DATI.giochi, []).filter(function (g) { return !g.escluso; });
    var inProg = giochi.filter(function (g) { return !g.riserva; });
    var riserve = giochi.filter(function (g) { return g.riserva; });
    var firma = giochi.map(function (g) {
      return g.id + ':' + g.nome + ':' + g.durata + ':' + V(g.orario, '') + ':' + (g.riserva ? 'r' : 'p');
    }).join('|');
    if (sel.getAttribute('data-firma') !== firma) {
      sel.setAttribute('data-firma', firma);
      sel.textContent = '';
      var vuoto = document.createElement('option');
      vuoto.value = ''; vuoto.textContent = '— scegli la gara —';
      sel.appendChild(vuoto);
      function voce(dove, g, conOra) {
        var o = document.createElement('option');
        o.value = g.id;
        o.textContent = (conOra && g.orario ? g.orario + ' · ' : '') +
          V(g.emoji, '🎯') + ' ' + g.nome + ' · ' + (g.durata || 0) + ' min';
        dove.appendChild(o);
      }
      if (inProg.length) {
        var gp = document.createElement('optgroup');
        gp.label = 'In programma';
        inProg.forEach(function (g) { voce(gp, g, true); });
        sel.appendChild(gp);
      }
      if (riserve.length) {
        var gr = document.createElement('optgroup');
        gr.label = 'Di riserva';
        riserve.forEach(function (g) { voce(gr, g, false); });
        sel.appendChild(gr);
      }
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
    disegnaScontri();
    disegnaAudio();
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

    /* a scontri il calendario prende il posto delle schede gioco per gioco,
       ma quelle che restano fuori dal calendario (la finale) si segnano
       lo stesso, con l'ordine d'arrivo di tutte le squadre */
    var aScontri = torneoR().attivo;
    if (aScontri) disegnaCalendarioScontri(el);

    /* una scheda per gioco (saltando quelli esclusi dal programma) */
    V(DATI.giochi, []).forEach(function (g) {
      if (g.escluso) return;
      if (g.tipo === 'riscaldamento') return;
      /* Nessuna gara dà punti a una persona: tutte danno punti alla squadra.
         Quindi non c'è nessun tipo di gioco che possa restare senza scheda —
         era proprio così che due gare sparivano dai punteggi. */
      if (aScontri && inCalendario(g.id)) return;
      if (aScontri && g.riserva) return;
      var c = crea('div', 'gioco-punti');
      var doppio = (g.tipo === 'finale');
      var h = crea('h3', null, V(g.emoji, '🎯') + ' ' + g.nome + (doppio ? '  (punti doppi)' : ''));
      c.appendChild(h);

      /* Niente tendine: si apre la finestra e si toccano le squadre
         nell'ordine d'arrivo. Qui resta solo il riassunto di com'è finita. */
      var ordine = V(STATO.risultati[g.id], []).filter(Boolean)
        .slice().sort(function (a, b) { return a.posizione - b.posizione; });
      var riass = crea('div', 'ordine-sq');
      if (ordine.length) {
        ordine.forEach(function (x, i) {
          var sq = STATO.squadre.filter(function (s) { return s.id === x.squadra; })[0];
          var riga = crea('div', 'posto-riga');
          riga.appendChild(crea('span', 'medaglia', ['🥇', '🥈', '🥉'][i] || (i + 1) + '°'));
          var nn = crea('span', null, sq ? sq.nome : '—');
          nn.style.flex = '1';
          riga.appendChild(nn);
          riga.appendChild(crea('span', 'tondo-punti', '+' + V(x.punti, 0)));
          riass.appendChild(riga);
        });
        var mz = V(menzioni()[g.id], {});
        var scritte = V(DATI.menzioniGara, []).filter(function (m) { return mz[m.id]; })
          .map(function (m) { return V(m.emoji, '🏅') + ' ' + nomeDiRiferimento(mz[m.id]); });
        if (scritte.length) riass.appendChild(crea('p', 'aiuto', scritte.join(' · ')));
      } else {
        riass.appendChild(crea('p', 'aiuto', 'Non ancora giocata.'));
      }
      c.appendChild(riass);

      var azg = crea('div', 'azioni');
      azg.style.cssText = 'justify-content:flex-start;margin-top:10px';
      azg.appendChild(bottone(ordine.length ? '✏️ Correggi il risultato' : '🏁 Segna il risultato',
        ordine.length ? 'chiaro' : 'verde', function () { apriModaleGara(g.id); }));
      c.appendChild(azg);
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

    /* chi ha collezionato più menzioni durante il pomeriggio: è il modo più
       veloce per decidere i premi finali senza starci a pensare */
    var conta = contoMenzioni();
    var righeMz = [];
    V(DATI.menzioniGara, []).forEach(function (mz) {
      var q = conta[mz.id];
      if (!q) return;
      var ordinati = Object.keys(q).sort(function (a, b) { return q[b] - q[a]; });
      righeMz.push(V(mz.emoji, '🏅') + ' ' + mz.nome + ': ' +
        ordinati.slice(0, 3).map(function (k) {
          return nomeDiRiferimento(k) + ' (' + q[k] + ')';
        }).join(', '));
    });
    if (righeMz.length) {
      c.appendChild(crea('h3', null, '📊 Le menzioni raccolte gara per gara'));
      c.appendChild(crea('p', 'aiuto', 'Chi le ha prese più volte: da qui si scelgono i premi.'));
      righeMz.forEach(function (r) { c.appendChild(crea('p', 'aiuto', r)); });
    }
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

    /* Il cronometro va in bacheca in sola lettura: chi guarda le classifiche
       vede scorrere il tempo della gara in corso. Si manda solo l'ora di
       partenza, non i secondi che mancano — così ogni telefono conta per
       conto suo e resta preciso anche se la bacheca arriva in ritardo. */
    var c = cron();
    var gc = giocoCron();
    if (gc && Number(c.minuti) > 0) {
      out.cronometro = {
        gioco: gc.nome, emoji: V(gc.emoji, '⏱️'),
        minuti: c.minuti, avvio: V(c.avvio, 0),
        consumato: V(c.consumato, 0), scaduto: !!c.suonato
      };
    }

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
        gruppo: V(t.gruppo, ''), premio: V(t.premio, ''),
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
  var timerBacheca = null, timerRiprovaBacheca = null;
  function aggiornaBachecaSePuoi() {
    var s = $('autoPubblica');
    if (!s || !s.checked || !SESS) { segnalaBacheca('spenta'); return; }
    if (timerBacheca) clearTimeout(timerBacheca);
    timerBacheca = setTimeout(function () {
      token().then(function (t) { return FB.scriviClassifica(t, costruisciPubblico()); })
        .then(function (ok) {
          if (!ok) throw new Error('la bacheca non ha accettato la scrittura');
          if (timerRiprovaBacheca) { clearTimeout(timerRiprovaBacheca); timerRiprovaBacheca = null; }
          var d = new Date();
          segnalaBacheca('ok', 'Ultimo aggiornamento alle ' +
            due(d.getHours()) + ':' + due(d.getMinutes()) + '. ' +
            'Chi guarda le classifiche lo vede entro una quindicina di secondi.');
        })
        /* Prima un errore qui non lo sapeva nessuno e si riprovava solo al
           punteggio successivo: sull'ultimo della giornata la pagina pubblica
           sarebbe rimasta indietro per sempre. Ora si dice e si riprova. */
        .catch(function (e) {
          segnalaBacheca('ko', V(e && e.message, 'non riesco a scrivere in bacheca') +
            '. Riprovo fra mezzo minuto.');
          if (!timerRiprovaBacheca) {
            timerRiprovaBacheca = setTimeout(function () {
              timerRiprovaBacheca = null;
              aggiornaBachecaSePuoi();
            }, 30000);
          }
        });
    }, 2500);
  }

  function segnalaBacheca(come, dettaglio) {
    var box = $('statoBacheca'), tit = $('titoloBacheca');
    if (!box || !tit) return;
    box.className = 'nota-box ' + (come === 'ok' ? 'sereno' : (come === 'ko' ? 'allarme' : 'attenzione'));
    tit.textContent = come === 'ok' ? '✅ Vanno da sole: non devi premere niente'
      : (come === 'ko' ? '⚠️ La pagina pubblica è rimasta indietro'
        : '⏸️ Aggiornamento automatico spento');
    testo('statoPubblicazione', V(dettaglio, come === 'spenta'
      ? 'La pagina pubblica resta ferma finché non lo riaccendi qui sotto.'
      : 'Ogni punteggio che registri arriva sulla pagina pubblica entro una ventina di secondi.'));
  }

  function pubblicaClassifiche() {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var doc = costruisciPubblico();
    CA.toast('Pubblico…', 20000);
    token().then(function (t) { return FB.scriviClassifica(t, doc); })
      .then(function (ok) {
        /* riuscita a mano: l'avviso deve tornare sereno, se no resta un
           allarme rosso su una cosa che ormai è a posto */
        if (ok) {
          var d = new Date();
          segnalaBacheca('ok', 'Mandata a mano alle ' + due(d.getHours()) + ':' + due(d.getMinutes()) +
            '. Chi guarda le classifiche la vede entro una quindicina di secondi.');
        } else {
          segnalaBacheca('ko', 'la bacheca non ha accettato la scrittura.');
        }
        CA.toast(ok ? '📣 Classifiche pubblicate!' : '⚠️ Pubblicazione non riuscita.', 6000);
      }).catch(function (e) {
        segnalaBacheca('ko', V(e && e.message, 'non riesco a scrivere in bacheca') + '.');
        CA.toast('⚠️ ' + e.message, 8000);
      });
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
      gr.appendChild(campoMini('Nome', g.nome, function (v) { g.nome = v; dopoModificaGiochi(); }));
      gr.appendChild(campoMini('Durata (minuti)', g.durata, function (v) {
        g.durata = Number(v) || 0; dopoModificaGiochi();
      }));
      /* l'orario non si scrive più a mano: lo decide la scaletta */
      var o = crea('div', 'campo');
      var lo = document.createElement('label'); lo.textContent = 'Quando si gioca';
      o.appendChild(lo);
      o.appendChild(crea('p', 'mini', g.riserva ? 'di riserva: fuori scaletta'
        : (g.escluso ? 'escluso' : (V(g.orario, '') || '—') + ' — lo calcola la scaletta')));
      gr.appendChild(o);
      gr.appendChild(campoMini('Chi partecipa', g.partecipanti, function (v) { g.partecipanti = v; }));
      det.appendChild(gr);
      /* serve al calendario a scontri: due materassini e quattro squadre
         vogliono dire una gara col materassino per volta */
      var sm = crea('label', 'spunta');
      sm.style.margin = '4px 0 10px';
      var cm = document.createElement('input');
      cm.type = 'checkbox';
      cm.checked = (V(g.attrezzo, '') === 'materassino');
      cm.addEventListener('change', function () {
        g.attrezzo = cm.checked ? 'materassino' : '';
        salvaBozzaFraPoco();
      });
      sm.appendChild(cm);
      sm.appendChild(crea('span', null, 'Serve il materassino'));
      det.appendChild(sm);

      /* Di norma scendono in acqua tutte le squadre insieme. Certi giochi
         però sono partite fra due — pallanuoto, baseball — e lì ha senso
         accoppiarle. */
      var ss = crea('label', 'spunta');
      ss.style.margin = '4px 0 10px';
      var cs = document.createElement('input');
      cs.type = 'checkbox';
      cs.checked = (g.scontro === true);
      cs.addEventListener('change', function () {
        g.scontro = cs.checked;
        salvaBozzaFraPoco();
        disegnaScontri();
      });
      ss.appendChild(cs);
      ss.appendChild(crea('span', null, 'Si gioca due squadre alla volta (se no giocano tutte insieme)'));
      det.appendChild(ss);

      /* e come si segna: chi arriva primo, o chi resta per ultimo */
      var se = crea('label', 'spunta');
      se.style.margin = '0 0 10px';
      var ce = document.createElement('input');
      ce.type = 'checkbox';
      ce.checked = (g.ordine === 'eliminazione');
      ce.addEventListener('change', function () {
        g.ordine = ce.checked ? 'eliminazione' : '';
        salvaBozzaFraPoco();
      });
      se.appendChild(ce);
      se.appendChild(crea('span', null, 'A eliminazione: si segna chi esce, non chi arriva'));
      det.appendChild(se);
      det.appendChild(areaMini('Descrizione', g.descrizione, function (v) { g.descrizione = v; }));
      det.appendChild(areaMini('Regole (una per riga)', V(g.regole, []).join('\n'), function (v) { g.regole = righe(v); }));
      det.appendChild(areaMini('Varianti (una per riga)', V(g.varianti, []).join('\n'), function (v) { g.varianti = righe(v); }));
    }, dopoModificaGiochi);
    contaGiochi();
    disegnaLineaTempo();
    disegnaEditMusica();
  }

  /* Un solo posto da cui passa ogni modifica alla scaletta: ridisegna
     l'elenco e rifà il programma, così le due cose non possono divergere. */
  function dopoModificaGiochi() {
    ricalcolaProgramma();
    disegnaEditGiochi();
    disegnaCronometro();
  }

  /* ==================== IL PROGRAMMA SI RIFÀ DA SOLO ===================
     La scaletta dei giochi comanda tutto: cambia l'ordine, metti un gioco
     di riserva, allunghi una durata — e gli orari del programma, quelli
     scritti su ogni gioco, la pausa e la premiazione si spostano di
     conseguenza. Restano ferme le righe che non sono giochi: accoglienza,
     formazione delle squadre e i blocchi degli adulti, che hanno una loro
     linea del tempo.                                                     */
  function minuti(o) {
    var p = String(o || '').split(':');
    var m = Number(p[0]) * 60 + Number(p[1]);
    return isFinite(m) ? m : 0;
  }
  function orario(m) { return due(Math.floor(m / 60) % 24) + ':' + due(m % 60); }

  function ricalcolaProgramma(conAvviso) {
    var auto = DATI.programmaAuto = V(DATI.programmaAuto, {});
    var inizio = minuti(V(auto.inizio, V(V(DATI.evento, {}).orario, '16:00')));
    var pausaMin = Number(V(auto.pausaMinuti, 10)) || 0;
    var inProgramma = V(DATI.giochi, []).filter(function (g) { return !g.riserva && !g.escluso; });

    /* dove va la pausa: dopo il gioco scelto, o a metà se quel gioco non si
       gioca più */
    var dopo = V(auto.pausaDopo, '');
    if (!inProgramma.some(function (g) { return g.id === dopo; })) {
      dopo = inProgramma.length ? inProgramma[Math.max(0, Math.ceil(inProgramma.length / 2) - 1)].id : '';
      auto.pausaDopo = dopo;
    }

    var vecchie = V(DATI.programma, []);
    function rigaDi(id) {
      return vecchie.filter(function (r) { return r.gioco === id; })[0] || null;
    }
    var pausa = vecchie.filter(function (r) { return r.area === 'tutti' && /pausa/i.test(r.titolo); })[0];
    var premio = vecchie.filter(function (r) { return r.area === 'tutti' && /premiazione/i.test(r.titolo); })[0];

    var t = inizio, nuove = [];
    inProgramma.forEach(function (g) {
      var vecchia = rigaDi(g.id);
      nuove.push({
        ora: orario(t), area: 'ragazzi', gioco: g.id,
        /* il titolo scritto a mano si tiene: «Palla bollente — riscaldamento» */
        titolo: (vecchia && String(vecchia.titolo).indexOf(g.nome) === 0) ? vecchia.titolo : g.nome,
        nota: vecchia ? V(vecchia.nota, '') : ''
      });
      g.orario = orario(t);
      t += Number(g.durata) || 0;
      if (g.id === dopo && pausa) { pausa.ora = orario(t); t += pausaMin; }
    });
    /* i giochi che non si giocano non hanno orario */
    V(DATI.giochi, []).forEach(function (g) {
      if (g.riserva || g.escluso) g.orario = '';
    });
    if (premio) premio.ora = orario(t);

    /* si tengono le righe che non sono giochi, si rifanno quelle che lo sono */
    var ferme = vecchie.filter(function (r) { return !r.gioco; });
    var tutte = ferme.concat(nuove);
    tutte.sort(function (a, b) {
      var d = minuti(a.ora) - minuti(b.ora);
      if (d) return d;
      var peso = { tutti: 0, ragazzi: 1, adulti: 2 };
      return V(peso[a.area], 3) - V(peso[b.area], 3);
    });
    DATI.programma = tutte;

    var el = $('c_programma');
    if (el) el.value = tutte.map(function (r) {
      return r.ora + ' | ' + r.area + ' | ' + r.titolo + (r.nota ? ' | ' + r.nota : '');
    }).join('\n');

    disegnaLineaTempo();
    salvaBozzaFraPoco();
    if (conAvviso) {
      CA.toast('🕓 Programma rifatto: ' + nuove.length + ' gare, si finisce alle ' + orario(t) + '.', 6000);
    }
    return { gare: nuove.length, fine: orario(t) };
  }

  /* la scaletta a video, così si vede subito l'effetto di ogni modifica */
  function disegnaLineaTempo() {
    var el = $('lineaTempo');
    if (!el) return;
    var auto = DATI.programmaAuto = V(DATI.programmaAuto, {});
    if ($('pa_inizio') && document.activeElement !== $('pa_inizio')) {
      $('pa_inizio').value = V(auto.inizio, '');
    }
    if ($('pa_pausaMin') && document.activeElement !== $('pa_pausaMin')) {
      $('pa_pausaMin').value = V(auto.pausaMinuti, 10);
    }
    if ($('pa_materassini') && document.activeElement !== $('pa_materassini')) {
      $('pa_materassini').value = quantiAttrezzi('materassino');
    }
    var sel = $('pa_pausaDopo');
    if (sel) {
      var inProg = V(DATI.giochi, []).filter(function (g) { return !g.riserva && !g.escluso; });
      var firma = inProg.map(function (g) { return g.id; }).join('|');
      if (sel.getAttribute('data-firma') !== firma) {
        sel.setAttribute('data-firma', firma);
        sel.textContent = '';
        inProg.forEach(function (g) {
          var o = document.createElement('option');
          o.value = g.id; o.textContent = V(g.emoji, '') + ' ' + g.nome;
          sel.appendChild(o);
        });
      }
      sel.value = V(auto.pausaDopo, '');
    }
    el.textContent = '';
    var ev = V(DATI.evento, {});
    var fine = minuti(V(ev.orarioFine, '19:00'));
    var righe = V(DATI.programma, []).filter(function (r) { return r.area !== 'adulti'; });
    righe.forEach(function (r) {
      var g = r.gioco ? V(DATI.giochi, []).filter(function (x) { return x.id === r.gioco; })[0] : null;
      var d = crea('div', 'passo' + (r.gioco ? '' : ' fisso'));
      d.appendChild(crea('span', 'ora-passo', r.ora));
      d.appendChild(crea('span', 'tit-passo',
        (g ? V(g.emoji, '') + ' ' : '') + r.titolo + (g ? ' · ' + g.durata + ' min' : '')));
      el.appendChild(d);
    });
    var ultima = righe[righe.length - 1];
    var sfora = ultima && minuti(ultima.ora) > fine;
    var ris = V(DATI.giochi, []).filter(function (g) { return g.riserva && !g.escluso; });
    var p = crea('p', 'aiuto' + (sfora ? ' sfora' : ''));
    p.textContent = (sfora
      ? '⚠️ Si sfora: l\'ultima riga cade dopo le ' + V(ev.orarioFine, '') + '. Togli un gioco o accorcia qualcosa.'
      : '✅ Tutto dentro le ' + V(ev.orarioFine, '') + '.') +
      (ris.length ? ' · ' + ris.length + ' giochi di riserva restano fuori dalla scaletta.' : '');
    el.appendChild(p);
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
      /* solo il totale: se ci sta o no lo dice la scaletta qui sotto, che
         tiene conto anche di accoglienza, pausa e premiazione. Due verdetti
         diversi sulla stessa cosa si contraddicevano. */
      t.textContent = (ore ? ore + 'h ' : '') + resto + ' min di gioco';
      t.style.color = '';
    }
    void finestra;
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
    /* Il programma porta con sé il legame fra riga e gioco: senza, al giro
       dopo il ricalcolo non saprebbe più quali righe rifare. Se il testo è
       stato ritoccato a mano si rilegge da lì, riattaccando i legami per
       nome; se no si prende quello già calcolato, legami compresi. */
    var testoOra = righe($('c_programma').value).join('\n');
    var testoCalcolato = V(DATI.programma, []).map(function (r) {
      return r.ora + ' | ' + r.area + ' | ' + r.titolo + (r.nota ? ' | ' + r.nota : '');
    }).join('\n');
    if (testoOra === testoCalcolato) {
      d.programma = DATI.programma;
    } else {
      d.programma = righe($('c_programma').value).map(function (r) {
        var p = r.split('|').map(function (x) { return x.trim(); });
        var riga = { ora: p[0] || '', area: p[1] || 'tutti', titolo: p[2] || '', nota: p[3] || '' };
        var g = V(DATI.giochi, []).filter(function (x) {
          return riga.titolo === x.nome || riga.titolo.indexOf(x.nome + ' ') === 0;
        })[0];
        if (g) riga.gioco = g.id;
        return riga;
      }).filter(function (r) { return r.titolo; });
      DATI.programma = d.programma;
    }
    d.programmaAuto = V(DATI.programmaAuto, {});
    d.attrezzi = V(DATI.attrezzi, {});
    d.collaboratori = V(DATI.collaboratori, {});
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

  /* Copia negli appunti. Il modo moderno funziona solo in pagine sicure,
     e dal telefono capita di stare su http: allora si ripiega sul vecchio
     campo nascosto, che va quasi sempre. */
  function copiaTesto(testoDaCopiare) {
    /* Prima il modo vecchio, e subito: funziona solo finché il dito è
       ancora "caldo" sul pulsante, e aspettare una promessa lo raffredda.
       Se non riesce si prova quello moderno, che su iPhone recente va
       meglio ma vuole una pagina sicura. */
    if (copiaAllaVecchia(testoDaCopiare)) return Promise.resolve(true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(testoDaCopiare)
        .then(function () { return true; })
        .catch(function () { return false; });
    }
    return Promise.resolve(false);
  }
  function copiaAllaVecchia(testoDaCopiare) {
    var a = document.createElement('textarea');
    a.value = testoDaCopiare;
    a.setAttribute('readonly', '');
    a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(a);
    a.select();
    a.setSelectionRange(0, 99999);          /* su iPhone senza questo non prende */
    var fatto = false;
    try { fatto = document.execCommand('copy'); } catch (e) { }
    a.remove();
    return fatto;
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

  function didascaliaAutomatica(video) {
    var ora = new Date();
    var orario = due(ora.getHours()) + ':' + due(ora.getMinutes());
    var che = video ? 'video · ' : '';
    var tappa = cosaSuccedeAdesso();
    if (tappa) return orario + ' — ' + che + String(tappa.titolo).replace(/^[^\wÀ-ÿ]+/, '').trim();
    var ev = V(DATI.evento, {});
    return orario + ' — ' + che + V(V(DATI.tema, {}).titolo, 'Certamen Aquaticum') +
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

  function nomeFoto(estensione) {
    var d = new Date();
    var e = estensione || 'jpg';
    return (e === 'jpg' ? 'foto_' : 'video_') +
      d.getFullYear() + due(d.getMonth() + 1) + due(d.getDate()) + '_' +
      due(d.getHours()) + due(d.getMinutes()) + due(d.getSeconds()) +
      Math.floor(Math.random() * 90 + 10) + '.' + e;
  }

  /* I video non si possono rimpicciolire nel browser: si caricano come sono.
     Oltre una certa taglia GitHub non li accetta e il telefono resta a
     macinare per niente, quindi è meglio dirlo prima di partire. */
  var VIDEO_MAX_MB = 24;

  /* una voce dell'album è un video se lo dice il tipo salvato, o se lo dice
     l'estensione: le foto vecchie non hanno il campo «tipo» */
  function eVoceVideo(v) {
    if (v && v.tipo === 'video') return true;
    return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String((v && (v.file || v.url)) || ''));
  }
  function eFileVideo(file) {
    return /^video\//.test((file && file.type) || '') ||
      /\.(mp4|mov|m4v|webm)$/i.test((file && file.name) || '');
  }
  function leggiBase64(file) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onerror = function () { ko(new Error('non riesco a leggere il file')); };
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.readAsDataURL(file);
    });
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
    var video = eFileVideo(file);
    if (!file || (!video && !/^image\//.test(file.type || ''))) {
      testo('statoFoto', '⚠️ Questo non è né una foto né un video.');
      return Promise.resolve(false);
    }
    var pesoMb = file.size / 1024 / 1024;
    if (video && pesoMb > VIDEO_MAX_MB) {
      testo('statoFoto', '⚠️ Il video pesa ' + pesoMb.toFixed(1) + ' MB: troppo, il limite è ' +
        VIDEO_MAX_MB + ' MB. Accorcialo dal telefono — apri il video, «Modifica», stringi le ' +
        'maniglie ai secondi che ti interessano e salvalo — poi ricaricalo.');
      return Promise.resolve(false);
    }
    /* le foto si rimpiccioliscono, i video si caricano come sono */
    testo('statoFoto', video ? ('⏳ Preparo il video (' + pesoMb.toFixed(1) + ' MB)…')
      : '⏳ Preparo la foto…');
    var estensione = video
      ? ((String(file.name).match(/\.([a-z0-9]+)$/i) || [, 'mp4'])[1].toLowerCase())
      : 'jpg';
    var prepara = video ? leggiBase64(file) : rimpicciolisci(file, 1600);
    return prepara.then(function (b64) {
      var nome = nomeFoto(estensione);
      testo('statoFoto', '📤 Sto caricando ' + nome + '…' +
        (video ? ' Con un video ci vuole un po\'.' : ''));
      return ghPut('images/album/' + nome, b64,
        (video ? 'Video' : 'Foto') + ' dell\'album: ' + nome)
        .then(function (risposta) {
          /* l'indirizzo diretto funziona subito, senza aspettare che il sito
             si ricostruisca: è quello che rende l'album istantaneo */
          var url = (risposta && risposta.content && risposta.content.download_url) ||
            ('images/album/' + nome);
          var voce = {
            url: url,
            file: 'images/album/' + nome,
            tipo: video ? 'video' : 'foto',
            didascalia: didascaliaAutomatica(video),
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
            testo('statoFoto', video ? '✅ Video nell\'album: già visibile a tutti.'
              : '✅ Foto nell\'album: già visibile a tutti.');
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
      el.appendChild(crea('p', 'aiuto',
        'Ancora niente. Premi «📸 Scatta una foto» oppure «🖼️ Scegli foto o video».'));
      return;
    }
    ALBUM.forEach(function (f, i) {
      var r = crea('div', 'riga-iscr');
      /* anteprima: per i video un fotogramma, così si riconoscono a colpo d'occhio */
      var eVid = eVoceVideo(f);
      var ant = document.createElement(eVid ? 'video' : 'img');
      ant.src = f.url;
      if (eVid) { ant.preload = 'metadata'; ant.muted = true; ant.playsInline = true; }
      else { ant.alt = f.didascalia || ''; ant.loading = 'lazy'; }
      ant.style.cssText = 'width:82px;height:82px;object-fit:cover;border-radius:12px;' +
        'flex:0 0 82px;background:#0a2540';
      r.appendChild(ant);

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
        if (!confirm('Tolgo questo dall\'album?')) return;
        ALBUM.splice(i, 1);
        salvaAlbum().then(function () { disegnaAlbum(); CA.toast('Foto tolta.', 4000); });
      }));
      r.appendChild(az);
      el.appendChild(r);
    });
  }

  /* ==================== CHI FA COSA IL GIORNO DELLA FESTA ==============
     Una guida da mandare a chi dà una mano: ruolo, posto, compiti. I nomi
     si cambiano qui e tutto il resto si riscrive da solo, guida stampata
     e messaggio compresi.                                                */
  function disegnaRuoli() {
    var el = $('elencoRuoli');
    if (!el) return;
    el.textContent = '';
    var c = DATI.collaboratori = V(DATI.collaboratori, {});
    var ruoli = V(c.ruoli, []);
    if (!ruoli.length) {
      el.appendChild(crea('p', 'aiuto', 'Nessun ruolo definito nei contenuti.'));
      return;
    }
    /* quello che vale per tutti, prima dei ruoli: così si legge una volta
       sola e non va ripetuto in ogni scheda */
    if (V(c.comuni, []).length) {
      var tutti = crea('div', 'nota-box info');
      tutti.style.marginBottom = '14px';
      tutti.appendChild(crea('b', null, '🤝 Questo lo fanno tutti'));
      var ut = document.createElement('ul');
      ut.style.cssText = 'margin:8px 0 0 20px;font-size:.92rem';
      c.comuni.forEach(function (x) { ut.appendChild(crea('li', null, x)); });
      tutti.appendChild(ut);
      el.appendChild(tutti);
    }

    ruoli.forEach(function (r, i) {
      var box = crea('div', 'ruolo-card');
      var t = crea('div', 'testa-ruolo');
      t.appendChild(crea('span', 'emoji-ruolo', V(r.emoji, '👤')));
      var c2 = crea('div', 'cnt');
      c2.appendChild(crea('b', null, V(r.ruolo, 'Ruolo ' + (i + 1))));
      c2.appendChild(crea('small', null, V(r.quando, '') + ' · ' + V(r.dove, '')));
      t.appendChild(c2);
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'mini'; inp.placeholder = 'nome';
      inp.value = V(r.nome, '');
      inp.style.cssText = 'max-width:190px';
      inp.addEventListener('change', function () {
        r.nome = inp.value.trim();
        salvaBozzaFraPoco();
        aggiornaLinkGuida();
      });
      t.appendChild(inp);
      box.appendChild(t);
      var ul = document.createElement('ul');
      ul.style.cssText = 'margin:8px 0 0 20px;font-size:.92rem';
      V(r.compiti, []).forEach(function (x) { ul.appendChild(crea('li', null, x)); });
      box.appendChild(ul);
      if (r.chiave) box.appendChild(crea('p', 'aiuto', '👉 ' + r.chiave));
      /* la guida intera non entra in un messaggio: a ognuno si manda la sua
         scheda, che è anche l'unica cosa che gli serve davvero */
      var az = crea('div', 'azioni');
      az.style.cssText = 'justify-content:flex-start;margin-top:8px';
      var wa = crea('a', 'btn btn-chiaro btn-piccolo',
        '💬 Manda' + (r.nome ? ' a ' + r.nome : ' questa scheda'));
      wa.target = '_blank'; wa.rel = 'noopener';
      wa.href = CA.linkWhatsApp(testoRuolo(r));
      az.appendChild(wa);
      az.appendChild(bottone('📋 Copia', 'chiaro btn-piccolo', function () {
        copiaTesto(testoRuolo(r)).then(function (fatto) {
          testo('statoGuida', fatto ? '📋 Copiata la scheda di ' + (r.nome || 'questo ruolo') + '.'
            : '⚠️ Il browser non mi lascia copiare da solo.');
        });
      }));
      box.appendChild(az);
      el.appendChild(box);
    });
    aggiornaLinkGuida();
  }

  /* il testo da mandare: lo stesso che si stampa, ma da incollare */
  function testoGuida() {
    var c = V(DATI.collaboratori, {});
    var ev = V(DATI.evento, {});
    var righe = [];
    righe.push(V(c.titolo, 'Chi fa cosa') + ' — ' + V(V(DATI.tema, {}).titolo, 'Certamen Aquaticum'));
    if (ev.data) righe.push(CA.dataIt(ev.data, true) + ', dalle ' + V(ev.orario, '') + ' alle ' + V(ev.orarioFine, ''));
    righe.push('');
    if (c.introduzione) { righe.push(c.introduzione); righe.push(''); }
    if (V(c.comuni, []).length) {
      righe.push('QUESTO LO FANNO TUTTI:');
      c.comuni.forEach(function (x) { righe.push('  • ' + x); });
      righe.push('');
    }
    V(c.ruoli, []).forEach(function (r) {
      righe.push('— ' + (V(r.nome, '') || '(da assegnare)') + ' · ' + V(r.ruolo, ''));
      righe.push('  Quando: ' + V(r.quando, '') + '. Dove: ' + V(r.dove, '') + '.');
      V(r.compiti, []).forEach(function (x) { righe.push('  • ' + x); });
      if (r.chiave) righe.push('  ' + r.chiave);
      righe.push('');
    });
    if (V(c.prima, []).length) {
      righe.push('Da controllare prima di cominciare:');
      c.prima.forEach(function (x) { righe.push('  • ' + x); });
      righe.push('');
    }
    if (V(c.regoleDoro, []).length) {
      righe.push('Le regole d\'oro:');
      c.regoleDoro.forEach(function (x) { righe.push('  • ' + x); });
      righe.push('');
    }
    righe.push('Area organizzatori: ' + CA.urlSito() + 'admin.html');
    return righe.join('\n');
  }

  /* la scheda di una persona sola: sta comoda in un messaggio */
  function testoRuolo(r) {
    var c = V(DATI.collaboratori, {});
    var righe = [];
    righe.push((V(r.nome, '') || 'Da assegnare') + ' — ' + V(r.ruolo, ''));
    righe.push('Certamen Aquaticum, sabato 15 agosto');
    righe.push('Quando: ' + V(r.quando, '') + '. Dove: ' + V(r.dove, '') + '.');
    righe.push('');
    V(r.compiti, []).forEach(function (x) { righe.push('• ' + x); });
    if (r.chiave) { righe.push(''); righe.push(r.chiave); }
    if (V(c.comuni, []).length) {
      righe.push('');
      righe.push('E questo lo facciamo tutti:');
      c.comuni.slice(0, 4).forEach(function (x) { righe.push('• ' + x); });
    }
    righe.push('');
    righe.push('Area organizzatori: ' + CA.urlSito() + 'admin.html');
    return righe.join('\n');
  }

  /* il riassunto per il gruppo: chi fa cosa in una riga a testa. La guida
     intera in un indirizzo di WhatsApp non ci sta — verrebbe troncata. */
  function testoRiassunto() {
    var c = V(DATI.collaboratori, {});
    var righe = [V(c.titolo, 'Chi fa cosa') + ' — Certamen Aquaticum, sabato 15 agosto'];
    righe.push('');
    V(c.ruoli, []).forEach(function (r) {
      righe.push((V(r.nome, '') || '(da assegnare)') + ': ' + V(r.ruolo, '') +
        ' — ' + V(r.quando, ''));
    });
    righe.push('');
    righe.push('A ognuno mando la sua scheda con i dettagli. Il programma completo è sul sito:');
    righe.push(CA.urlSito() + 'programma.html');
    return righe.join('\n');
  }

  function aggiornaLinkGuida() {
    var a = $('btnGuidaWa');
    if (a) a.href = CA.linkWhatsApp(testoRiassunto());
  }

  /* ==================== IL MESSAGGIO DI FINE GIORNATA ==================
     A premiazione fatta nessuno ha voglia di mettersi a scrivere: qui il
     messaggio è già pronto, con la classifica vera e il link all'album.  */
  function testoChiusura() {
    var righe = [];
    var t = V(DATI.tema, {}), ev = V(DATI.evento, {});
    righe.push(V(t.titolo, 'Certamen Aquaticum') + ' — è finita così!');
    if (ev.data) righe.push(CA.dataIt(ev.data, true));
    righe.push('');

    var gen = classificaRagazzi().filter(function (r) { return r.punti || r.gare; });
    if (gen.length) {
      righe.push('LE SQUADRE');
      gen.forEach(function (r, i) {
        righe.push((['1°', '2°', '3°'][i] || (i + 1) + '°') + ' ' + r.nome + ' — ' + r.punti + ' punti');
      });
      righe.push('');
    }
    var carte = [];
    torneiAttivi().forEach(function (x) {
      var st = STATO.tornei[x.id] || {};
      if (!V(st.coppie, []).length) return;
      var cl = classificaTorneo(x.id).filter(function (r) { return r.g; });
      if (!cl.length) return;
      carte.push(x.nome + ': ' + cl[0].coppia + (cl[1] ? ', poi ' + cl[1].coppia : ''));
    });
    if (carte.length) {
      righe.push('LE CARTE');
      carte.forEach(function (r) { righe.push(r); });
      righe.push('');
    }
    var titoli = V(STATO.titoli, []).filter(function (x) { return x.chi; });
    if (titoli.length) {
      righe.push('I PREMI');
      titoli.forEach(function (x) { righe.push(x.premio + ': ' + x.chi); });
      righe.push('');
    }
    var mz = contoMenzioni();
    var menz = [];
    V(DATI.menzioniGara, []).forEach(function (m) {
      var q = mz[m.id];
      if (!q) return;
      var primo = Object.keys(q).sort(function (a, b) { return q[b] - q[a]; })[0];
      menz.push(m.nome + ': ' + nomeDiRiferimento(primo) +
        (q[primo] > 1 ? ' (' + q[primo] + ' volte)' : ''));
    });
    if (menz.length) {
      righe.push('MENZIONI DEL POMERIGGIO');
      menz.forEach(function (r) { righe.push(r); });
      righe.push('');
    }
    righe.push('Le foto sono già online: ' + CA.urlSito() + 'album.html');
    righe.push('Classifiche complete: ' + CA.urlSito() + 'classifiche.html');
    righe.push('');
    righe.push('Grazie a tutti — ci si rivede l\'anno prossimo!');
    return righe.join('\n');
  }

  function disegnaChiusura(rifai) {
    var t = $('msgChiusura');
    if (!t) return;
    if (rifai || !t.value.trim()) t.value = testoChiusura();
    $('chiusuraWa').href = CA.linkWhatsApp(t.value);
    $('chiusuraTg').href = CA.linkTelegram(t.value);
  }

  /* ==================== AZZERARE DOPO LA PROVA GENERALE ===============
     Provare tutto per davvero — squadre, gare, punteggi, tabelloni — e poi
     rimettere il contatore a zero. Le iscrizioni stanno in un'altra
     collezione del database e non vengono sfiorate: qui si cancella solo
     il lavoro della giornata. Anche la bacheca pubblica va ripulita, se
     no il sito continua a mostrare i punteggi della prova.            */
  function azzeraGiornata(ancheSquadre) {
    if (!SESS) { CA.toast('Prima entra nel database.', 6000); return; }
    var quante = STATO.squadre.length;
    var gare = Object.keys(STATO.risultati || {}).length;
    var avviso = ancheSquadre
      ? ('Cancello TUTTA la giornata: ' + quante + ' squadre, ' + gare + ' gare segnate, ' +
        'tabelloni, coppie, appello e menzioni.\n\nLe iscrizioni restano tutte. Procedo?')
      : ('Cancello punteggi, tabelloni e menzioni (' + gare + ' gare segnate).\n\n' +
        'Le ' + quante + ' squadre e le coppie restano. Procedo?');
    if (!confirm(avviso)) return;

    STATO.risultati = {};
    STATO.titoli = [];
    STATO.bonus = {};
    STATO.menzioni = {};
    STATO.cronometro = cronometroVuoto();
    STATO.torneoRagazzi = { attivo: false, turni: [] };
    if (ancheSquadre) {
      STATO.squadre = [];
      STATO.configSquadre = {};
      STATO.tornei = {};
      STATO.presenze = {};
      STATO.assettoCarte = null;
      PRESENZE_MIE = {};
      sqToccato = false;
    } else {
      /* le coppie restano, i tabelloni no: si rigenerano in un tocco */
      Object.keys(STATO.tornei || {}).forEach(function (id) {
        STATO.tornei[id].incontri = [];
      });
    }
    salvaStato(true);

    /* la bacheca deve tornare pulita anche per chi guarda da fuori */
    token().then(function (t) { return FB.scriviClassifica(t, costruisciPubblico()); })
      .then(function () {
        testo('statoAzzera', '✅ Azzerato' + (ancheSquadre ? ' tutto' : ' punteggi e tabelloni') +
          '. Anche la pagina pubblica è tornata pulita. Le iscrizioni sono tutte al loro posto.');
      })
      .catch(function (e) {
        testo('statoAzzera', '⚠️ Azzerato qui, ma la pagina pubblica non si è aggiornata: ' +
          V(e && e.message, 'errore') + '. Riprova da 📣 Pubblica.');
      });
    disegnaTutto();
    CA.toast('🧹 Fatto: si riparte da zero.', 6000);
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
      /* anche il calendario degli scontri dei ragazzi: il giorno della festa
         si appende al muro e si spunta turno per turno */
      var tr = torneoR();
      if (tr.attivo && tr.turni.length) {
        trovato = true;
        var nomeSq = {};
        STATO.squadre.forEach(function (s) { nomeSq[s.id] = s.nome; });
        var hh = crea('h2', null, '🤽 Giochi in acqua — calendario degli scontri');
        hh.style.cssText = 'margin-top:18px;font-size:1.15rem';
        b2.appendChild(hh);
        var righe = [];
        tr.turni.forEach(function (turno) {
          turno.incontri.forEach(function (inc) {
            var g = V(DATI.giochi, []).filter(function (x) { return x.id === inc.gioco; })[0] || {};
            var v = vincitoreDi(inc.gioco);
            righe.push(['Turno ' + turno.n, V(g.nome, inc.gioco),
              V(nomeSq[inc.a], '—'), V(nomeSq[inc.b], '—'),
              v ? V(nomeSq[v], '—') : '____________']);
          });
        });
        b2.appendChild(tabella(['Turno', 'Gioco', 'Squadra', 'Squadra', 'Ha vinto'], righe));
      }
      if (!trovato) b2.appendChild(crea('p', null, 'Nessun tabellone generato.'));
      apriFoglio('Tabelloni e calendari', b2);
      return;
    }
    if (quale === 'diplomi') {
      /* Un foglio per ragazzo, da consegnare dopo la premiazione. A quell'età
         il pezzo di carta da portare a casa vale più della coppa. */
      var b5 = crea('div');
      var gen = classificaRagazzi();
      var posto = {};
      gen.forEach(function (r, i) { posto[r.id] = i + 1; });
      var mzTot = contoMenzioni();
      var quanti = 0;

      STATO.squadre.forEach(function (sq) {
        sq.componenti.forEach(function (id) {
          var p = perId(id);
          if (!p) return;
          quanti++;
          var f = crea('div', 'diploma');
          f.appendChild(crea('div', 'dip-occhiello',
            V(V(DATI.tema, {}).titolo, 'Certamen Aquaticum')));
          f.appendChild(crea('div', 'dip-evento',
            V(V(DATI.evento, {}).luogo, 'Residence Holiday') +
            (V(DATI.evento, {}).data ? ' · ' + CA.dataIt(DATI.evento.data, true) : '')));
          f.appendChild(crea('div', 'dip-a', 'si consegna a'));
          f.appendChild(crea('div', 'dip-nome', p.nome));
          var col = crea('div', 'dip-squadra', '🚩 ' + sq.nome +
            (sq.capitano === id ? ' · capitano' : '') + (sq.motto ? ' — «' + sq.motto + '»' : ''));
          if (sq.colore) col.style.color = sq.colore;
          f.appendChild(col);

          var pz = posto[sq.id];
          f.appendChild(crea('div', 'dip-posto',
            (pz === 1 ? '🥇 Squadra campione di Ferragosto'
              : (pz === 2 ? '🥈 Secondo posto' : (pz === 3 ? '🥉 Terzo posto' : pz + '° posto')))));

          /* le gare vinte dalla sua squadra, per nome */
          var vinte = [];
          giochiAttivi().forEach(function (g) {
            var r = V(STATO.risultati[g.id], []).filter(Boolean);
            var primo = r.filter(function (x) { return x.posizione === 1; })[0];
            if (primo && primo.squadra === sq.id) vinte.push(V(g.emoji, '') + ' ' + g.nome);
          });
          if (vinte.length) {
            f.appendChild(crea('div', 'dip-titolo-sez', 'Gare vinte'));
            f.appendChild(crea('div', 'dip-elenco', vinte.join(' · ')));
          }
          /* le menzioni prese proprio da lui */
          var sue = [];
          V(DATI.menzioniGara, []).forEach(function (m) {
            var q = mzTot[m.id];
            if (q && q['p:' + id]) {
              sue.push(V(m.emoji, '🏅') + ' ' + m.nome +
                (q['p:' + id] > 1 ? ' (' + q['p:' + id] + ' volte)' : ''));
            }
          });
          V(STATO.titoli, []).forEach(function (t2) {
            if (normalizza(V(t2.chi, '')) === normalizza(p.nome)) {
              sue.push(V(t2.emoji, '🏅') + ' ' + t2.premio);
            }
          });
          if (sue.length) {
            f.appendChild(crea('div', 'dip-titolo-sez', 'Menzioni speciali'));
            f.appendChild(crea('div', 'dip-elenco', sue.join(' · ')));
          }
          f.appendChild(crea('div', 'dip-firma', 'Gli organizzatori del Residence Holiday'));
          b5.appendChild(f);
        });
      });
      if (!quanti) {
        b5.appendChild(crea('p', null,
          'Prima forma le squadre: i diplomi prendono nome, squadra e posizione da lì.'));
      }
      apriFoglio('Diplomi', b5);
      return;
    }
    if (quale === 'collaboratori') {
      var c4 = V(DATI.collaboratori, {});
      var b4 = crea('div');
      if (c4.introduzione) {
        var intro = crea('p', null, c4.introduzione);
        intro.style.cssText = 'font-size:.95rem;margin-bottom:14px';
        b4.appendChild(intro);
      }
      if (V(c4.comuni, []).length) {
        var ht = crea('h3', null, '🤝 Questo lo fanno tutti');
        ht.style.cssText = 'font-size:1.05rem;margin:0 0 4px';
        b4.appendChild(ht);
        var ult = document.createElement('ul');
        ult.style.cssText = 'margin:0 0 14px 18px;font-size:.92rem';
        c4.comuni.forEach(function (x) { ult.appendChild(crea('li', null, x)); });
        b4.appendChild(ult);
      }
      V(c4.ruoli, []).forEach(function (r) {
        var box = crea('div');
        box.style.cssText = 'border:1px solid #ccc;border-radius:10px;padding:10px 14px;margin-bottom:10px;break-inside:avoid';
        var h = crea('h3', null, V(r.emoji, '👤') + ' ' + (V(r.nome, '') || '(da assegnare)') +
          ' — ' + V(r.ruolo, ''));
        h.style.cssText = 'font-size:1.05rem;margin:0 0 4px';
        box.appendChild(h);
        var q = crea('p', null, V(r.quando, '') + ' · ' + V(r.dove, ''));
        q.style.cssText = 'font-size:.85rem;color:#555;margin:0 0 6px';
        box.appendChild(q);
        var ul = document.createElement('ul');
        ul.style.cssText = 'margin:0 0 0 18px;font-size:.92rem';
        V(r.compiti, []).forEach(function (x) { ul.appendChild(crea('li', null, x)); });
        box.appendChild(ul);
        if (r.chiave) {
          var k = crea('p', null, '👉 ' + r.chiave);
          k.style.cssText = 'font-size:.88rem;font-style:italic;margin:6px 0 0';
          box.appendChild(k);
        }
        b4.appendChild(box);
      });
      [['Da controllare prima di cominciare', V(c4.prima, [])],
      ['Le regole d\'oro', V(c4.regoleDoro, [])]].forEach(function (par) {
        if (!par[1].length) return;
        var h2 = crea('h3', null, par[0]);
        h2.style.cssText = 'font-size:1.05rem;margin:14px 0 4px';
        b4.appendChild(h2);
        var u2 = document.createElement('ul');
        u2.style.cssText = 'margin:0 0 0 18px;font-size:.92rem';
        par[1].forEach(function (x) { u2.appendChild(crea('li', null, x)); });
        b4.appendChild(u2);
      });
      apriFoglio(V(c4.titolo, 'Chi fa cosa'), b4);
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
