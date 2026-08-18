/* =========================================================================
   firebase.js — collegamento al database (Firestore + Login)
   Senza SDK: solo chiamate REST con fetch, così il sito resta leggero e
   senza dipendenze esterne caricate da CDN.

   Il progetto Firebase è lo stesso della festa, ma le COLLEZIONI sono nuove
   e separate, così i due eventi non si mescolano mai:

     iscrizioni            un documento per ogni iscritto
                             nome     (stringa)  — serve alle regole
                             area     (stringa)  — "ragazzi" | "adulti"
                             codice   (stringa)  — codice del pass
                             stato    (stringa)  — "attiva" | "cestino"
                             creatoIl (stringa)  — data/ora ISO
                             json     (stringa)  — TUTTA l'iscrizione in JSON

     pubblico_certamen/contatore   SOLO NUMERI, leggibile da chiunque:
                                     ragazzi, adulti
     pubblico_certamen/classifica  quello che l'organizzatore decide di
                                   rendere pubblico (squadre, punti,
                                   tabellone), in un campo json

     stato_certamen/gara           il lavoro degli organizzatori: squadre
                                   formate, punteggi di ogni gioco, tabellone
                                   dei tornei. Contiene i nomi veri, quindi si
                                   legge e si scrive SOLO dopo il login.

   Regola d'oro: chiunque può CREARE un'iscrizione, ma solo chi fa il LOGIN
   (l'organizzatore) può leggere nomi e recapiti. I numeri aggregati stanno
   nei documenti pubblici, che non contengono dati personali.
   ========================================================================= */
(function () {
  function V(v, def) { return (v === undefined || v === null) ? def : v; }
  var API = '', PROJ = '', BASE = '';
  var COLL = 'iscrizioni';
  var DOC_CONT = 'pubblico_certamen/contatore';
  var DOC_CLASS = 'pubblico_certamen/classifica';
  var DOC_STATO = 'stato_certamen/gara';
  /* Le voci del contatore pubblico. Oltre alle due grandi aree ci sono le due
     iscrizioni delle carte, che hanno un numero proprio: chi guarda la pagina
     dei tornei vede quanti si sono iscritti ai giochi all'italiana e quanti
     al burraco. Restano solo numeri: nessun nome, nessun recapito. */
  var AREE = ['ragazzi', 'adulti', 'italiana', 'burraco'];

  function cfg(apiKey, projectId) {
    API = String(apiKey || '');
    PROJ = String(projectId || '');
    BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJ + '/databases/(default)/documents';
  }
  function attivo() { return !!(API && PROJ); }

  /* ---- conversione valori <-> formato tipizzato di Firestore ---- */
  function toFields(obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v === null || v === undefined) return;
      f[k] = { stringValue: String(v) };
    });
    return { fields: f };
  }
  function fromDoc(doc) {
    var f = (doc && doc.fields) || {};
    var o = { _id: doc && doc.name ? doc.name.split('/').pop() : null };
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      o[k] = (v.stringValue !== undefined) ? v.stringValue
        : (v.integerValue !== undefined) ? v.integerValue
          : (v.booleanValue !== undefined) ? v.booleanValue : '';
    });
    return o;
  }
  function jget(r) { return r.json().catch(function () { return {}; }); }

  /* ---- LOGIN (email + password dell'organizzatore) ---- */
  function signIn(email, password) {
    return fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'login fallito');
      return {
        idToken: d.idToken, refreshToken: d.refreshToken, email: d.email,
        scadenza: Date.now() + (Number(d.expiresIn || 3600) * 1000)
      };
    });
  }
  function refresh(refreshToken) {
    return fetch('https://securetoken.googleapis.com/v1/token?key=' + API, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'sessione scaduta');
      return {
        idToken: d.id_token, refreshToken: d.refresh_token,
        scadenza: Date.now() + (Number(d.expires_in || 3600) * 1000)
      };
    });
  }

  /* ---- CREA un'iscrizione (dal sito, senza login) ---- */
  function creaIscrizione(obj) {
    return fetch(BASE + '/' + COLL + '?key=' + API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFields(obj))
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'scrittura fallita');
      return fromDoc(d);
    });
  }

  /* ---- ELENCO di tutte le iscrizioni (richiede login) ---- */
  function elenco(idToken) {
    var out = [];
    function pagina(tok) {
      var url = BASE + '/' + COLL + '?key=' + API + '&pageSize=300' + (tok ? '&pageToken=' + tok : '');
      return fetch(url, { headers: { 'Authorization': 'Bearer ' + idToken } })
        .then(jget).then(function (d) {
          if (d.error) throw new Error(d.error.message || 'lettura fallita');
          (d.documents || []).forEach(function (doc) { out.push(fromDoc(doc)); });
          if (d.nextPageToken) return pagina(d.nextPageToken);
          return out;
        });
    }
    return pagina(null);
  }

  /* ---- AGGIORNA i campi indicati (richiede login) ---- */
  function aggiorna(idToken, id, obj) {
    var mask = Object.keys(obj).map(function (k) {
      return 'updateMask.fieldPaths=' + encodeURIComponent(k);
    }).join('&');
    return fetch(BASE + '/' + COLL + '/' + id + '?key=' + API + '&' + mask, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(toFields(obj))
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'aggiornamento fallito');
      return fromDoc(d);
    });
  }

  /* ---- ELIMINA definitivamente (richiede login) ---- */
  function elimina(idToken, id) {
    return fetch(BASE + '/' + COLL + '/' + id + '?key=' + API, {
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + idToken }
    }).then(function (r) {
      if (r.ok) return true;
      return jget(r).then(function (d) { throw new Error((d.error && d.error.message) || ('HTTP ' + r.status)); });
    });
  }

  /* ================= CONTATORE PUBBLICO DEGLI ISCRITTI =================
     Un solo documento con due numeri: quanti ragazzi e quanti adulti si sono
     iscritti. È l'unico dato leggibile senza password: nessun nome, nessun
     recapito. Serve alla home per mostrare i contatori in tempo reale.     */
  function leggiContatori() {
    return fetch(BASE + '/' + DOC_CONT + '?key=' + API + '&_=' + Date.now(), { cache: 'no-store' })
      .then(jget).then(function (d) {
        /* Il documento non c'è ancora perché non si è ancora iscritto nessuno:
           non è un errore, è zero. Distinguerlo dal "non ho il permesso" evita
           che la home mostri un trattino al posto dei numeri. */
        if (d.error && String(d.error.status || '') === 'NOT_FOUND') {
          var vuoto = {};
          AREE.forEach(function (a) { vuoto[a] = 0; });
          return vuoto;
        }
        if (d.error) return null;                    /* permesso negato */
        var f = d.fields || {};
        var out = {};
        AREE.forEach(function (a) {
          var v = f[a] || {};
          var n = Number(v.integerValue !== undefined ? v.integerValue : v.doubleValue);
          out[a] = isFinite(n) ? n : 0;
        });
        return out;
      })
      .catch(function () { return null; });
  }

  /* Incremento atomico: due persone che si iscrivono insieme non si
     sovrascrivono a vicenda. */
  function incrementaContatore(area, quante) {
    var a = (AREE.indexOf(String(area)) >= 0) ? String(area) : null;
    var n = Math.max(0, Math.round(Number(quante) || 0));
    if (!a || !n) return Promise.resolve(true);
    var nomeDoc = 'projects/' + PROJ + '/databases/(default)/documents/' + DOC_CONT;
    var corpo = {
      writes: [{
        transform: {
          document: nomeDoc,
          fieldTransforms: [{ fieldPath: a, increment: { integerValue: String(n) } }]
        }
      }]
    };
    function commit() {
      return fetch('https://firestore.googleapis.com/v1/projects/' + PROJ +
        '/databases/(default)/documents:commit?key=' + API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
      }).then(jget);
    }
    return commit().then(function (d) {
      if (!d.error) return true;
      /* la prima volta il documento non esiste: lo creo e riprovo una volta */
      if (String(d.error.status || '') === 'NOT_FOUND') {
        var v = {}; v[a] = n;
        return scriviContatori(null, v);
      }
      return false;
    }).catch(function () { return false; });
  }

  /* Scrive i valori esatti. Con idToken lo fa l'organizzatore (ricalcolo dal
     registro, che resta la fonte di verità); senza, serve alla prima creazione. */
  function scriviContatori(idToken, valori) {
    var v = valori || {};
    var headers = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = 'Bearer ' + idToken;
    var fields = {}, mask = [];
    AREE.forEach(function (a) {
      if (v[a] === undefined) return;
      fields[a] = { integerValue: String(Math.max(0, Math.round(Number(v[a]) || 0))) };
      mask.push('updateMask.fieldPaths=' + a);
    });
    if (!mask.length) return Promise.resolve(true);
    return fetch(BASE + '/' + DOC_CONT + '?key=' + API + '&' + mask.join('&'), {
      method: 'PATCH', headers: headers, body: JSON.stringify({ fields: fields })
    }).then(jget).then(function (d) { return !d.error; })
      .catch(function () { return false; });
  }

  /* ============= CLASSIFICHE E TABELLONE PUBBLICI =============
     Documento scritto solo dall'organizzatore (serve il login) e leggibile
     da chiunque. Contiene esclusivamente quello che si vuole appendere in
     bacheca: nomi di squadra, punti, turni. Mai recapiti. */
  function leggiClassifica() {
    return fetch(BASE + '/' + DOC_CLASS + '?key=' + API + '&_=' + Date.now(), { cache: 'no-store' })
      .then(jget).then(function (d) {
        if (d.error) return null;
        var f = d.fields || {};
        var testo = (f.json && f.json.stringValue) || '';
        if (!testo) return null;
        try { return JSON.parse(testo); } catch (e) { return null; }
      })
      .catch(function () { return null; });
  }

  function scriviClassifica(idToken, oggetto) {
    if (!idToken) return Promise.resolve(false);
    var corpo = {
      fields: {
        json: { stringValue: JSON.stringify(oggetto || {}) },
        aggiornatoIl: { stringValue: new Date().toISOString() }
      }
    };
    return fetch(BASE + '/' + DOC_CLASS + '?key=' + API +
      '&updateMask.fieldPaths=json&updateMask.fieldPaths=aggiornatoIl', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(corpo)
    }).then(jget).then(function (d) { return !d.error; })
      .catch(function () { return false; });
  }

  /* ================= STATO DELLA GARA (solo organizzatori) =================
     Squadre formate, punteggi gioco per gioco, tabellone dei tornei: tutto
     vive qui, in un unico documento nel database. Serve il login sia per
     leggerlo sia per scriverlo, perché contiene i nomi veri dei partecipanti.

     È il documento che permette di lavorare dal telefono a bordo piscina e
     ritrovare tutto sul computer: non c'è niente di importante che resti
     chiuso nella memoria di un solo browser. */
  function leggiStato(idToken) {
    if (!idToken) return Promise.resolve(null);
    return fetch(BASE + '/' + DOC_STATO + '?key=' + API + '&_=' + Date.now(), {
      headers: { 'Authorization': 'Bearer ' + idToken }, cache: 'no-store'
    }).then(jget).then(function (d) {
      if (d.error) return null;                     /* non esiste ancora */
      var f = d.fields || {};
      var testo = (f.json && f.json.stringValue) || '';
      if (!testo) return null;
      try {
        var o = JSON.parse(testo);
        o._aggiornatoIl = (f.aggiornatoIl && f.aggiornatoIl.stringValue) || '';
        return o;
      } catch (e) { return null; }
    }).catch(function () { return null; });
  }

  function scriviStato(idToken, oggetto) {
    if (!idToken) return Promise.resolve(false);
    var corpo = {
      fields: {
        json: { stringValue: JSON.stringify(oggetto || {}) },
        aggiornatoIl: { stringValue: new Date().toISOString() }
      }
    };
    return fetch(BASE + '/' + DOC_STATO + '?key=' + API +
      '&updateMask.fieldPaths=json&updateMask.fieldPaths=aggiornatoIl', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(corpo)
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'salvataggio fallito');
      return true;
    });
  }

  /* ======================= ALBUM DELLA GIORNATA ========================
     Le foto scattate durante la festa. Vive in un documento pubblico, così
     l'album si riempie sotto gli occhi di chi guarda la pagina, senza dover
     ripubblicare il sito: le immagini stanno su GitHub, qui ci sono solo gli
     indirizzi e le didascalie. Lo scrive solo chi ha fatto il login.      */
  /* L'album porta con sé anche il proprio interruttore: così basta scattare
     una foto per farlo comparire sul sito, senza dover anche ripubblicare i
     contenuti — cosa che il giorno della festa nessuno si ricorderebbe. */
  function leggiAlbum() {
    return fetch(BASE + '/pubblico_certamen/album?key=' + API + '&_=' + Date.now(),
      { cache: 'no-store' })
      .then(jget).then(function (d) {
        if (d.error) return null;
        var f = d.fields || {};
        var testo = (f.json && f.json.stringValue) || '';
        if (!testo) return null;
        try {
          var o = JSON.parse(testo);
          if (Array.isArray(o)) return { attivo: o.length > 0, foto: o };   /* formato vecchio */
          return { attivo: o.attivo !== false, foto: Array.isArray(o.foto) ? o.foto : [] };
        } catch (e) { return null; }
      }).catch(function () { return null; });
  }

  /* Serve alla diagnosi: dice se l'album è bloccato dalle regole, cosa che
     leggiAlbum() nasconde apposta per non disturbare chi guarda il sito. */
  function provaAlbum() {
    return fetch(BASE + '/pubblico_certamen/album?key=' + API + '&_=' + Date.now(),
      { cache: 'no-store' })
      .then(jget).then(function (d) {
        if (d.error && /PERMISSION_DENIED/i.test(String(d.error.status || d.error.message || ''))) {
          return 'bloccato';
        }
        if (d.error && String(d.error.status || '') === 'NOT_FOUND') return 'vuoto';
        if (d.error) return 'errore';
        return 'ok';
      }).catch(function () { return 'errore'; });
  }

  function scriviAlbum(idToken, album) {
    if (!idToken) return Promise.resolve(false);
    var o = Array.isArray(album) ? { attivo: album.length > 0, foto: album } : (album || {});
    return fetch(BASE + '/pubblico_certamen/album?key=' + API +
      '&updateMask.fieldPaths=json&updateMask.fieldPaths=aggiornatoIl', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({
        fields: {
          json: { stringValue: JSON.stringify({ attivo: o.attivo !== false, foto: V(o.foto, []) }) },
          aggiornatoIl: { stringValue: new Date().toISOString() }
        }
      })
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'salvataggio album fallito');
      return true;
    });
  }

  /* ============ LAVORO A PIÙ MANI: LO STATO SPEZZATO IN PEZZI ==========
     Il giorno della festa gli operatori sono più d'uno: chi segue i giochi in
     acqua, chi il Trittico, chi il Burraco. Se tutti scrivessero nello stesso
     documento, l'ultimo che salva cancellerebbe il lavoro degli altri.
     Per questo lo stato è diviso in documenti separati — uno per le squadre,
     uno per i punteggi dei giochi, uno per ogni torneo, uno per i titoli — e
     ognuno scrive solo il proprio. Chi segna il Burraco non tocca il Trittico.

       stato_certamen/squadre          squadre, configurazione, punti bonus
       stato_certamen/risultati        punteggi delle gare dei ragazzi
       stato_certamen/titoli           premi individuali
       stato_certamen/torneo_<id>      coppie, tabellone e punteggi di un torneo
  */
  function leggiPezzi(idToken) {
    if (!idToken) return Promise.resolve({});
    return fetch(BASE + '/stato_certamen?key=' + API + '&pageSize=100&_=' + Date.now(), {
      headers: { 'Authorization': 'Bearer ' + idToken }, cache: 'no-store'
    }).then(jget).then(function (d) {
      var out = {};
      if (d.error) return out;
      (d.documents || []).forEach(function (doc) {
        var nome = doc.name.split('/').pop();
        var f = doc.fields || {};
        var testo = (f.json && f.json.stringValue) || '';
        if (!testo) return;
        try {
          out[nome] = {
            dati: JSON.parse(testo),
            quando: (f.aggiornatoIl && f.aggiornatoIl.stringValue) || '',
            chi: (f.chi && f.chi.stringValue) || ''
          };
        } catch (e) { }
      });
      return out;
    }).catch(function () { return {}; });
  }

  function scriviPezzo(idToken, nome, oggetto, chi) {
    if (!idToken || !nome) return Promise.resolve(false);
    var corpo = {
      fields: {
        json: { stringValue: JSON.stringify(oggetto === undefined ? null : oggetto) },
        aggiornatoIl: { stringValue: new Date().toISOString() },
        chi: { stringValue: String(chi || '') }
      }
    };
    return fetch(BASE + '/stato_certamen/' + encodeURIComponent(nome) + '?key=' + API +
      '&updateMask.fieldPaths=json&updateMask.fieldPaths=aggiornatoIl&updateMask.fieldPaths=chi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(corpo)
    }).then(jget).then(function (d) {
      if (d.error) throw new Error(d.error.message || 'salvataggio fallito');
      return true;
    });
  }

  /* ---- CANCELLA un pezzo dello stato (richiede login) ----
     Serve per buttare via davvero un torneo: non «archiviato», proprio via
     dal database, come se non fosse mai stato giocato. */
  function cancellaPezzo(idToken, nome) {
    if (!idToken || !nome) return Promise.resolve(false);
    return fetch(BASE + '/stato_certamen/' + encodeURIComponent(nome) + '?key=' + API, {
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + idToken }
    }).then(function (r) {
      if (r.ok) return true;
      return jget(r).then(function (d) { throw new Error((d.error && d.error.message) || ('HTTP ' + r.status)); });
    });
  }

  window.FB = {
    cfg: cfg, attivo: attivo,
    signIn: signIn, refresh: refresh,
    creaIscrizione: creaIscrizione, elenco: elenco, aggiorna: aggiorna, elimina: elimina,
    leggiContatori: leggiContatori, incrementaContatore: incrementaContatore,
    scriviContatori: scriviContatori,
    leggiClassifica: leggiClassifica, scriviClassifica: scriviClassifica,
    leggiStato: leggiStato, scriviStato: scriviStato,
    leggiPezzi: leggiPezzi, scriviPezzo: scriviPezzo, cancellaPezzo: cancellaPezzo,
    leggiAlbum: leggiAlbum, scriviAlbum: scriviAlbum, provaAlbum: provaAlbum
  };
})();
