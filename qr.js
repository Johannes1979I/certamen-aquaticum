/* =============================================================================
 * qr.js — Libreria QR Code per il sito "Residence Holiday"
 * -----------------------------------------------------------------------------
 * Encoder QR Code scritto da zero secondo ISO/IEC 18004.
 *
 *   - modalita' byte con testo codificato in UTF-8 (multibyte gestiti a mano)
 *   - livelli di correzione d'errore L / M / Q / H
 *   - versioni da 1 a 40, con scelta automatica della versione minima capace
 *   - correzione d'errore Reed-Solomon su GF(256), polinomio primitivo 0x11D
 *   - interlacciamento di blocchi dati e blocchi ECC secondo la tabella ufficiale
 *   - tutti e 8 i pattern di maschera, scelti con le 4 penalita' (3/3/40/10)
 *   - format information con BCH(15,5) e maschera 0x5412
 *   - version information con BCH(18,6) per le versioni >= 7
 *
 * Nessuna dipendenza esterna, nessun font, nessuna rete, nessun build step.
 * QR.matrix() e QR.svg() funzionano anche senza DOM (utili per test da riga di
 * comando); solo QR.draw() richiede un <canvas> vero.
 *
 * API pubblica (globale window.QR):
 *   QR.matrix(testo, ecc)        -> array di array di booleani (true = nero)
 *   QR.svg(testo, opzioni)       -> stringa SVG completa
 *   QR.draw(canvas, testo, opz)  -> disegna su un <canvas>
 *   QR._selfTest()               -> true/false, verifiche interne (in fondo)
 * ========================================================================== */

(function (radice, fabbrica) {
  'use strict';
  var QR = fabbrica();
  // Esportazione principale: la globale window.QR richiesta dalle pagine.
  if (radice) { radice.QR = QR; }
  // Comodita' per eseguire i test fuori dal browser. Non e' una dipendenza.
  if (typeof module === 'object' && module && module.exports) { module.exports = QR; }
}(
  typeof window !== 'undefined' ? window
    : (typeof globalThis !== 'undefined' ? globalThis : null),
  function () {
    'use strict';

    /* =========================================================================
     * 1. ARITMETICA SU GF(256)
     * -------------------------------------------------------------------------
     * Campo di Galois a 256 elementi generato dal polinomio primitivo
     * x^8 + x^4 + x^3 + x^2 + 1  (0x11D), con elemento generatore alfa = 2.
     * Precalcoliamo le tabelle di esponenziale e logaritmo: la moltiplicazione
     * diventa una somma di logaritmi.
     * ====================================================================== */

    var EXP = new Array(512); // EXP[i] = alfa^i (duplicata per evitare i modulo)
    var LOG = new Array(256); // LOG[x] = i tale che alfa^i = x

    (function inizializzaCampo() {
      var x = 1;
      for (var i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) { x ^= 0x11D; } // riduzione modulo il polinomio primitivo
      }
      for (var j = 255; j < 512; j++) { EXP[j] = EXP[j - 255]; }
      LOG[0] = 0; // valore di comodo: lo zero non ha logaritmo, non va mai usato
    }());

    // Moltiplicazione nel campo. Lo zero e' assorbente.
    function gfMul(a, b) {
      if (a === 0 || b === 0) { return 0; }
      return EXP[LOG[a] + LOG[b]];
    }

    /* =========================================================================
     * 2. POLINOMIO GENERATORE E RESTO DI REED-SOLOMON
     * -------------------------------------------------------------------------
     * Il generatore di grado n e' il prodotto (x - alfa^0)(x - alfa^1)...
     * ...(x - alfa^(n-1)). In GF(2^m) la sottrazione coincide con lo XOR.
     * I coefficienti sono memorizzati dal grado piu' alto al piu' basso.
     * ====================================================================== */

    var CACHE_GENERATORI = {};

    function polinomioGeneratore(grado) {
      if (CACHE_GENERATORI[grado]) { return CACHE_GENERATORI[grado]; }
      var poly = [1]; // polinomio costante 1
      for (var i = 0; i < grado; i++) {
        var prossimo = new Array(poly.length + 1);
        for (var z = 0; z < prossimo.length; z++) { prossimo[z] = 0; }
        for (var j = 0; j < poly.length; j++) {
          prossimo[j] ^= poly[j];                        // moltiplicazione per x
          prossimo[j + 1] ^= gfMul(poly[j], EXP[i]);     // e per alfa^i
        }
        poly = prossimo;
      }
      CACHE_GENERATORI[grado] = poly;
      return poly;
    }

    // Divisione polinomiale: ritorna gli "nEc" codeword di correzione d'errore.
    function restoReedSolomon(dati, nEc) {
      var gen = polinomioGeneratore(nEc); // lunghezza nEc+1, gen[0] === 1
      var resto = new Array(nEc);
      var i, j;
      for (i = 0; i < nEc; i++) { resto[i] = 0; }
      for (i = 0; i < dati.length; i++) {
        var fattore = dati[i] ^ resto[0];
        resto.shift();
        resto.push(0);
        if (fattore !== 0) {
          for (j = 0; j < nEc; j++) {
            resto[j] ^= gfMul(gen[j + 1], fattore);
          }
        }
      }
      return resto;
    }

    /* =========================================================================
     * 3. TABELLA UFFICIALE DEI BLOCCHI DI CORREZIONE D'ERRORE
     * -------------------------------------------------------------------------
     * Per ogni versione (1..40) e per ogni livello (L, M, Q, H):
     *
     *   [ ecPerBlocco, blocchiGruppo1, datiGruppo1, blocchiGruppo2, datiGruppo2 ]
     *
     * I blocchi del gruppo 2, quando presenti, contengono sempre esattamente un
     * codeword di dati in piu' rispetto a quelli del gruppo 1.
     * Invariante verificata da QR._selfTest():
     *   ecPerBlocco * (blocchi1 + blocchi2) + dati1*blocchi1 + dati2*blocchi2
     *   === codeword totali della versione (ricavati dal layout del simbolo).
     * Questa tabella e' la fonte piu' comune di errori: NON modificarla senza
     * rieseguire QR._selfTest().
     * ====================================================================== */

    var LIVELLI = { L: 0, M: 1, Q: 2, H: 3 };

    // Bit del livello di correzione usati nella format information (non e'
    // l'ordine L/M/Q/H: il valore e' definito dallo standard).
    var BIT_LIVELLO = { L: 1, M: 0, Q: 3, H: 2 };

    var BLOCCHI_EC = [
      /* v1  */[[7, 1, 19, 0, 0], [10, 1, 16, 0, 0], [13, 1, 13, 0, 0], [17, 1, 9, 0, 0]],
      /* v2  */[[10, 1, 34, 0, 0], [16, 1, 28, 0, 0], [22, 1, 22, 0, 0], [28, 1, 16, 0, 0]],
      /* v3  */[[15, 1, 55, 0, 0], [26, 1, 44, 0, 0], [18, 2, 17, 0, 0], [22, 2, 13, 0, 0]],
      /* v4  */[[20, 1, 80, 0, 0], [18, 2, 32, 0, 0], [26, 2, 24, 0, 0], [16, 4, 9, 0, 0]],
      /* v5  */[[26, 1, 108, 0, 0], [24, 2, 43, 0, 0], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
      /* v6  */[[18, 2, 68, 0, 0], [16, 4, 27, 0, 0], [24, 4, 19, 0, 0], [28, 4, 15, 0, 0]],
      /* v7  */[[20, 2, 78, 0, 0], [18, 4, 31, 0, 0], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
      /* v8  */[[24, 2, 97, 0, 0], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
      /* v9  */[[30, 2, 116, 0, 0], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
      /* v10 */[[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
      /* v11 */[[20, 4, 81, 0, 0], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]],
      /* v12 */[[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
      /* v13 */[[26, 4, 107, 0, 0], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]],
      /* v14 */[[30, 3, 115, 1, 116], [24, 4, 40, 5, 41], [20, 11, 16, 5, 17], [24, 11, 12, 5, 13]],
      /* v15 */[[22, 5, 87, 1, 88], [24, 5, 41, 5, 42], [30, 5, 24, 7, 25], [24, 11, 12, 7, 13]],
      /* v16 */[[24, 5, 98, 1, 99], [28, 7, 45, 3, 46], [24, 15, 19, 2, 20], [30, 3, 15, 13, 16]],
      /* v17 */[[28, 1, 107, 5, 108], [28, 10, 46, 1, 47], [28, 1, 22, 15, 23], [28, 2, 14, 17, 15]],
      /* v18 */[[30, 5, 120, 1, 121], [26, 9, 43, 4, 44], [28, 17, 22, 1, 23], [28, 2, 14, 19, 15]],
      /* v19 */[[28, 3, 113, 4, 114], [26, 3, 44, 11, 45], [26, 17, 21, 4, 22], [26, 9, 13, 16, 14]],
      /* v20 */[[28, 3, 107, 5, 108], [26, 3, 41, 13, 42], [30, 15, 24, 5, 25], [28, 15, 15, 10, 16]],
      /* v21 */[[28, 4, 116, 4, 117], [26, 17, 42, 0, 0], [28, 17, 22, 6, 23], [30, 19, 16, 6, 17]],
      /* v22 */[[28, 2, 111, 7, 112], [28, 17, 46, 0, 0], [30, 7, 24, 16, 25], [24, 34, 13, 0, 0]],
      /* v23 */[[30, 4, 121, 5, 122], [28, 4, 47, 14, 48], [30, 11, 24, 14, 25], [30, 16, 15, 14, 16]],
      /* v24 */[[30, 6, 117, 4, 118], [28, 6, 45, 14, 46], [30, 11, 24, 16, 25], [30, 30, 16, 2, 17]],
      /* v25 */[[26, 8, 106, 4, 107], [28, 8, 47, 13, 48], [30, 7, 24, 22, 25], [30, 22, 15, 13, 16]],
      /* v26 */[[28, 10, 114, 2, 115], [28, 19, 46, 4, 47], [28, 28, 22, 6, 23], [30, 33, 16, 4, 17]],
      /* v27 */[[30, 8, 122, 4, 123], [28, 22, 45, 3, 46], [30, 8, 23, 26, 24], [30, 12, 15, 28, 16]],
      /* v28 */[[30, 3, 117, 10, 118], [28, 3, 45, 23, 46], [30, 4, 24, 31, 25], [30, 11, 15, 31, 16]],
      /* v29 */[[30, 7, 116, 7, 117], [28, 21, 45, 7, 46], [30, 1, 23, 37, 24], [30, 19, 15, 26, 16]],
      /* v30 */[[30, 5, 115, 10, 116], [28, 19, 47, 10, 48], [30, 15, 24, 25, 25], [30, 23, 15, 25, 16]],
      /* v31 */[[30, 13, 115, 3, 116], [28, 2, 46, 29, 47], [30, 42, 24, 1, 25], [30, 23, 15, 28, 16]],
      /* v32 */[[30, 17, 115, 0, 0], [28, 10, 46, 23, 47], [30, 10, 24, 35, 25], [30, 19, 15, 35, 16]],
      /* v33 */[[30, 17, 115, 1, 116], [28, 14, 46, 21, 47], [30, 29, 24, 19, 25], [30, 11, 15, 46, 16]],
      /* v34 */[[30, 13, 115, 6, 116], [28, 14, 46, 23, 47], [30, 44, 24, 7, 25], [30, 59, 16, 1, 17]],
      /* v35 */[[30, 12, 121, 7, 122], [28, 12, 47, 26, 48], [30, 39, 24, 14, 25], [30, 22, 15, 41, 16]],
      /* v36 */[[30, 6, 121, 14, 122], [28, 6, 47, 34, 48], [30, 46, 24, 10, 25], [30, 2, 15, 64, 16]],
      /* v37 */[[30, 17, 122, 4, 123], [28, 29, 46, 14, 47], [30, 49, 24, 10, 25], [30, 24, 15, 46, 16]],
      /* v38 */[[30, 4, 122, 18, 123], [28, 13, 46, 32, 47], [30, 48, 24, 14, 25], [30, 42, 15, 32, 16]],
      /* v39 */[[30, 20, 117, 4, 118], [28, 40, 47, 7, 48], [30, 43, 24, 22, 25], [30, 10, 15, 67, 16]],
      /* v40 */[[30, 19, 118, 6, 119], [28, 18, 47, 31, 48], [30, 34, 24, 34, 25], [30, 20, 15, 61, 16]]
    ];

    var VERSIONE_MIN = 1;
    var VERSIONE_MAX = 40;

    // Restituisce la descrizione dei blocchi in forma leggibile.
    function specBlocchi(versione, indiceLivello) {
      var r = BLOCCHI_EC[versione - 1][indiceLivello];
      var totDati = r[1] * r[2] + r[3] * r[4];
      return {
        ec: r[0],          // codeword di correzione per ciascun blocco
        b1: r[1], d1: r[2], // gruppo 1: quanti blocchi, quanti dati ciascuno
        b2: r[3], d2: r[4], // gruppo 2: idem (0 se assente)
        blocchi: r[1] + r[3],
        totDati: totDati,                       // codeword di dati totali
        totEc: r[0] * (r[1] + r[3]),            // codeword di correzione totali
        totale: totDati + r[0] * (r[1] + r[3])  // codeword complessivi
      };
    }

    /* =========================================================================
     * 4. CODIFICA UTF-8 DEL TESTO
     * -------------------------------------------------------------------------
     * Scritta a mano per non dipendere da TextEncoder e per gestire in modo
     * esplicito le coppie surrogate (emoji e simboli fuori dal BMP).
     * ====================================================================== */

    function byteUtf8(testo) {
      var out = [];
      var s = String(testo);
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 0xD800 && c <= 0xDBFF) {
          // Possibile surrogato alto: cerchiamo il basso per ricostruire il
          // codepoint completo (es. le emoji, che stanno oltre U+FFFF).
          var c2 = (i + 1 < s.length) ? s.charCodeAt(i + 1) : 0;
          if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
            c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
            i++;
          } else {
            c = 0xFFFD; // surrogato spaiato: carattere di sostituzione
          }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          c = 0xFFFD; // surrogato basso isolato
        }

        if (c < 0x80) {
          out.push(c);
        } else if (c < 0x800) {
          out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
        } else if (c < 0x10000) {
          out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        } else {
          out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F),
                   0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        }
      }
      return out;
    }

    /* =========================================================================
     * 5. SCHELETRO DEL SIMBOLO (pattern di funzione)
     * -------------------------------------------------------------------------
     * Costruisce la matrice con finder pattern, separatori, alignment pattern,
     * timing pattern, modulo scuro e aree riservate a format/version info.
     * La mappa "fn" segna i moduli di funzione: la trama dei dati li salta e la
     * maschera non li tocca mai.
     * ====================================================================== */

    // Posizioni dei centri degli alignment pattern, calcolate secondo la regola
    // dell'Annex E: primo centro sempre a 6, ultimo a 4*versione+10, gli altri
    // equispaziati (passo pari) partendo dal fondo. La versione 32 e' l'unica
    // eccezione della formula e usa passo 26.
    var CACHE_ALLINEAMENTI = {};

    function posizioniAllineamento(versione) {
      if (CACHE_ALLINEAMENTI[versione]) { return CACHE_ALLINEAMENTI[versione]; }
      var res;
      if (versione === 1) {
        res = [];
      } else {
        var quanti = Math.floor(versione / 7) + 2;
        var passo = (versione === 32)
          ? 26
          : Math.floor((versione * 4 + quanti * 2 + 1) / (quanti * 2 - 2)) * 2;
        res = [6];
        var pos = versione * 4 + 10;
        for (var i = 0; i < quanti - 1; i++) {
          res.splice(1, 0, pos);
          pos -= passo;
        }
      }
      CACHE_ALLINEAMENTI[versione] = res;
      return res;
    }

    function matriceVuota(lato, valore) {
      var m = new Array(lato);
      for (var r = 0; r < lato; r++) {
        m[r] = new Array(lato);
        for (var c = 0; c < lato; c++) { m[r][c] = valore; }
      }
      return m;
    }

    function scheletro(versione) {
      var lato = versione * 4 + 17;
      var mod = matriceVuota(lato, 0);     // 0 = chiaro, 1 = scuro
      var fn = matriceVuota(lato, false);  // true = modulo di funzione
      var r, c, i, j;

      function set(riga, col, scuro) {
        mod[riga][col] = scuro ? 1 : 0;
        fn[riga][col] = true;
      }

      // --- Timing pattern: riga 6 e colonna 6, moduli alternati -------------
      for (i = 0; i < lato; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
      }

      // --- Finder pattern 7x7 + separatore chiaro tutto intorno -------------
      // Il centro e' passato come (riga, colonna); disegniamo il riquadro 9x9
      // che comprende anche il separatore, ignorando cio' che cade fuori.
      function finder(cr, cc) {
        for (var dr = -4; dr <= 4; dr++) {
          for (var dc = -4; dc <= 4; dc++) {
            var dist = Math.max(Math.abs(dr), Math.abs(dc)); // distanza di Chebyshev
            var rr = cr + dr, cc2 = cc + dc;
            if (rr >= 0 && rr < lato && cc2 >= 0 && cc2 < lato) {
              // anelli: 0 scuro, 1 chiaro, 2 scuro, 3 chiaro (separatore), 4 chiaro
              set(rr, cc2, dist !== 2 && dist !== 4);
            }
          }
        }
      }
      finder(3, 3);              // alto a sinistra
      finder(3, lato - 4);       // alto a destra
      finder(lato - 4, 3);       // basso a sinistra

      // --- Alignment pattern 5x5 -------------------------------------------
      var pos = posizioniAllineamento(versione);
      var n = pos.length;
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          // I tre angoli sono occupati dai finder pattern: si saltano.
          if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) {
            continue;
          }
          for (var dr2 = -2; dr2 <= 2; dr2++) {
            for (var dc2 = -2; dc2 <= 2; dc2++) {
              var d = Math.max(Math.abs(dr2), Math.abs(dc2));
              set(pos[i] + dr2, pos[j] + dc2, d !== 1); // anello chiaro a distanza 1
            }
          }
        }
      }

      // --- Modulo scuro obbligatorio in (4*versione + 9, 8) -----------------
      set(lato - 8, 8, true);

      // --- Aree riservate alla format information (15 bit x 2 copie) --------
      for (i = 0; i <= 8; i++) {
        if (!fn[i][8]) { set(i, 8, false); }
        if (!fn[8][i]) { set(8, i, false); }
      }
      for (i = 0; i < 8; i++) {
        if (!fn[8][lato - 1 - i]) { set(8, lato - 1 - i, false); }
      }
      for (i = 0; i < 7; i++) {
        if (!fn[lato - 1 - i][8]) { set(lato - 1 - i, 8, false); }
      }

      // --- Aree riservate alla version information (solo versioni >= 7) -----
      if (versione >= 7) {
        for (i = 0; i < 18; i++) {
          var a = lato - 11 + (i % 3);
          var b = Math.floor(i / 3);
          set(b, a, false); // blocco in alto a destra
          set(a, b, false); // blocco in basso a sinistra
        }
      }

      return { lato: lato, mod: mod, fn: fn };
    }

    // Numero di codeword (dati + correzione) che il simbolo puo' contenere.
    // Lo ricaviamo dal layout invece che da una tabella trascritta a mano: cosi'
    // e' impossibile sbagliare la trascrizione.
    var CACHE_CAPACITA = {};

    function codewordTotali(versione) {
      if (CACHE_CAPACITA[versione] !== undefined) { return CACHE_CAPACITA[versione]; }
      var s = scheletro(versione);
      var liberi = 0;
      for (var r = 0; r < s.lato; r++) {
        for (var c = 0; c < s.lato; c++) {
          if (!s.fn[r][c]) { liberi++; }
        }
      }
      // I bit di resto (liberi % 8) restano chiari, come previsto dallo standard.
      CACHE_CAPACITA[versione] = Math.floor(liberi / 8);
      return CACHE_CAPACITA[versione];
    }

    /* =========================================================================
     * 6. COSTRUZIONE DEL FLUSSO DI BIT E DEI CODEWORD
     * ====================================================================== */

    // Bit del contatore di caratteri in modalita' byte.
    function bitContatore(versione) { return versione <= 9 ? 8 : 16; }

    function BufferBit() { this.bit = []; }

    BufferBit.prototype.put = function (valore, lunghezza) {
      for (var i = lunghezza - 1; i >= 0; i--) {
        this.bit.push((valore >>> i) & 1);
      }
    };

    // Sceglie la versione minima capace di contenere i byte al livello richiesto.
    function versioneMinima(nByte, indiceLivello) {
      for (var v = VERSIONE_MIN; v <= VERSIONE_MAX; v++) {
        var bitNecessari = 4 + bitContatore(v) + nByte * 8;
        if (bitNecessari <= specBlocchi(v, indiceLivello).totDati * 8) { return v; }
      }
      return -1;
    }

    // Dal testo ai codeword di dati: indicatore di modo, contatore, byte,
    // terminatore, padding a byte, byte di riempimento 0xEC / 0x11 alternati.
    function codewordDati(byte_, versione, indiceLivello) {
      var spec = specBlocchi(versione, indiceLivello);
      var capacitaBit = spec.totDati * 8;
      var bb = new BufferBit();
      var i;

      bb.put(0x4, 4);                                   // indicatore di modo "byte"
      bb.put(byte_.length, bitContatore(versione));     // contatore di caratteri
      for (i = 0; i < byte_.length; i++) { bb.put(byte_[i], 8); }

      // Terminatore: fino a 4 bit a zero, meno se non c'e' spazio.
      var terminatore = Math.min(4, capacitaBit - bb.bit.length);
      if (terminatore > 0) { bb.put(0, terminatore); }

      // Allineamento al byte.
      while (bb.bit.length % 8 !== 0) { bb.bit.push(0); }

      // Impacchettamento dei bit in byte.
      var out = [];
      for (i = 0; i < bb.bit.length; i += 8) {
        var b = 0;
        for (var k = 0; k < 8; k++) { b = (b << 1) | bb.bit[i + k]; }
        out.push(b);
      }

      // Byte di riempimento alternati fino a saturare la capacita' dati.
      var riempitivi = [0xEC, 0x11];
      var p = 0;
      while (out.length < spec.totDati) {
        out.push(riempitivi[p]);
        p ^= 1;
      }
      return out;
    }

    // Divide i dati nei blocchi dei due gruppi, calcola l'ECC di ciascun blocco
    // e interlaccia il tutto nell'ordine previsto dallo standard: prima i
    // codeword di dati presi "a colonne" fra i blocchi, poi quelli di ECC.
    function codewordInterlacciati(dati, versione, indiceLivello) {
      var spec = specBlocchi(versione, indiceLivello);
      var blocchiDati = [];
      var blocchiEc = [];
      var offset = 0;
      var b, i;

      for (b = 0; b < spec.b1; b++) {
        blocchiDati.push(dati.slice(offset, offset + spec.d1));
        offset += spec.d1;
      }
      for (b = 0; b < spec.b2; b++) {
        blocchiDati.push(dati.slice(offset, offset + spec.d2));
        offset += spec.d2;
      }
      for (b = 0; b < blocchiDati.length; b++) {
        blocchiEc.push(restoReedSolomon(blocchiDati[b], spec.ec));
      }

      var out = [];
      var maxDati = Math.max(spec.d1, spec.d2);
      for (i = 0; i < maxDati; i++) {
        for (b = 0; b < blocchiDati.length; b++) {
          if (i < blocchiDati[b].length) { out.push(blocchiDati[b][i]); }
        }
      }
      for (i = 0; i < spec.ec; i++) {
        for (b = 0; b < blocchiEc.length; b++) { out.push(blocchiEc[b][i]); }
      }
      return out;
    }

    /* =========================================================================
     * 7. INFORMAZIONI DI FORMATO E DI VERSIONE
     * ====================================================================== */

    // BCH(15,5): 5 bit di dato (2 di livello + 3 di maschera), 10 di controllo
    // con generatore 0x537, il tutto mascherato con 0x5412.
    function bitFormato(livello, maschera) {
      var dato = (BIT_LIVELLO[livello] << 3) | maschera;
      var resto = dato;
      for (var i = 0; i < 10; i++) {
        resto = (resto << 1) ^ (((resto >> 9) & 1) * 0x537);
      }
      return (((dato << 10) | resto) ^ 0x5412) & 0x7FFF;
    }

    // BCH(18,6): 6 bit di versione + 12 di controllo con generatore 0x1F25.
    // Nessuna maschera applicata.
    function bitVersione(versione) {
      var resto = versione;
      for (var i = 0; i < 12; i++) {
        resto = (resto << 1) ^ (((resto >> 11) & 1) * 0x1F25);
      }
      return ((versione << 12) | resto) & 0x3FFFF;
    }

    function bitDi(valore, indice) { return (valore >>> indice) & 1; }

    // Scrive le due copie della format information nella matrice.
    function scriviFormato(mod, lato, livello, maschera) {
      var bits = bitFormato(livello, maschera);
      var i;

      // Prima copia, attorno al finder in alto a sinistra.
      for (i = 0; i <= 5; i++) { mod[i][8] = bitDi(bits, i); }
      mod[7][8] = bitDi(bits, 6);
      mod[8][8] = bitDi(bits, 7);
      mod[8][7] = bitDi(bits, 8);
      for (i = 9; i <= 14; i++) { mod[8][14 - i] = bitDi(bits, i); }

      // Seconda copia: 8 moduli in alto a destra, 7 in basso a sinistra.
      for (i = 0; i <= 7; i++) { mod[8][lato - 1 - i] = bitDi(bits, i); }
      for (i = 8; i <= 14; i++) { mod[lato - 15 + i][8] = bitDi(bits, i); }

      // Il modulo scuro obbligatorio non fa parte della format information.
      mod[lato - 8][8] = 1;
    }

    // Scrive le due copie della version information (solo versioni >= 7).
    function scriviVersione(mod, lato, versione) {
      if (versione < 7) { return; }
      var bits = bitVersione(versione);
      for (var i = 0; i < 18; i++) {
        var b = bitDi(bits, i);
        var a = lato - 11 + (i % 3);
        var c = Math.floor(i / 3);
        mod[c][a] = b; // blocco 3x6 in alto a destra
        mod[a][c] = b; // blocco 6x3 in basso a sinistra
      }
    }

    /* =========================================================================
     * 8. POSA DEI DATI NELLA MATRICE
     * -------------------------------------------------------------------------
     * Percorso a zig-zag su colonne larghe due moduli, da destra a sinistra,
     * alternando risalita e discesa, saltando la colonna 6 (timing verticale)
     * e tutti i moduli di funzione.
     * ====================================================================== */

    function posaCodeword(mod, fn, lato, codeword) {
      var indiceBit = 0;
      var totBit = codeword.length * 8;

      for (var destra = lato - 1; destra >= 1; destra -= 2) {
        if (destra === 6) { destra = 5; } // si salta la colonna del timing
        for (var v = 0; v < lato; v++) {
          for (var j = 0; j < 2; j++) {
            var col = destra - j;
            var versoAlto = ((destra + 1) & 2) === 0;
            var riga = versoAlto ? (lato - 1 - v) : v;
            if (!fn[riga][col] && indiceBit < totBit) {
              // Bit piu' significativo per primo dentro ogni codeword.
              mod[riga][col] = (codeword[indiceBit >> 3] >>> (7 - (indiceBit & 7))) & 1;
              indiceBit++;
            }
          }
        }
      }
      return indiceBit;
    }

    /* =========================================================================
     * 9. MASCHERE E VALUTAZIONE DELLE PENALITA'
     * ====================================================================== */

    // Le 8 maschere standard. riga = i, colonna = j.
    function condizioneMaschera(n, riga, col) {
      switch (n) {
        case 0: return (riga + col) % 2 === 0;
        case 1: return riga % 2 === 0;
        case 2: return col % 3 === 0;
        case 3: return (riga + col) % 3 === 0;
        case 4: return (Math.floor(riga / 2) + Math.floor(col / 3)) % 2 === 0;
        case 5: return ((riga * col) % 2) + ((riga * col) % 3) === 0;
        case 6: return ((((riga * col) % 2) + ((riga * col) % 3)) % 2) === 0;
        case 7: return ((((riga + col) % 2) + ((riga * col) % 3)) % 2) === 0;
        default: return false;
      }
    }

    function applicaMaschera(mod, fn, lato, n) {
      for (var r = 0; r < lato; r++) {
        for (var c = 0; c < lato; c++) {
          if (!fn[r][c] && condizioneMaschera(n, r, c)) {
            mod[r][c] ^= 1;
          }
        }
      }
    }

    var N1 = 3, N2 = 3, N3 = 40, N4 = 10;

    // Nucleo del pattern "finder-like" 1:1:3:1:1 usato dalla regola N3.
    var NUCLEO_N3 = [1, 0, 1, 1, 1, 0, 1];

    // Regola 1: serie di 5 o piu' moduli dello stesso colore in riga o colonna.
    function penalitaRegola1(linee) {
      var punti = 0;
      for (var l = 0; l < linee.length; l++) {
        var linea = linee[l];
        var run = 1;
        for (var i = 1; i < linea.length; i++) {
          if (linea[i] === linea[i - 1]) {
            run++;
          } else {
            if (run >= 5) { punti += N1 + (run - 5); }
            run = 1;
          }
        }
        if (run >= 5) { punti += N1 + (run - 5); }
      }
      return punti;
    }

    // Regola 2: ogni blocco 2x2 monocromatico.
    function penalitaRegola2(mod, lato) {
      var punti = 0;
      for (var r = 0; r < lato - 1; r++) {
        for (var c = 0; c < lato - 1; c++) {
          var v = mod[r][c];
          if (v === mod[r][c + 1] && v === mod[r + 1][c] && v === mod[r + 1][c + 1]) {
            punti += N2;
          }
        }
      }
      return punti;
    }

    // Regola 3: pattern 1:1:3:1:1 preceduto o seguito da 4 moduli chiari.
    // Fuori dal simbolo c'e' la quiet zone, quindi il bordo conta come chiaro.
    function penalitaRegola3(linee) {
      var punti = 0;
      for (var l = 0; l < linee.length; l++) {
        var linea = linee[l];
        var n = linea.length;
        for (var i = 0; i + 7 <= n; i++) {
          var ok = true;
          for (var k = 0; k < 7; k++) {
            if (linea[i + k] !== NUCLEO_N3[k]) { ok = false; break; }
          }
          if (!ok) { continue; }
          if (quattroChiari(linea, i - 4, i - 1) || quattroChiari(linea, i + 7, i + 10)) {
            punti += N3;
          }
        }
      }
      return punti;
    }

    // true se i moduli fra "da" e "a" sono tutti chiari; le posizioni fuori dal
    // simbolo sono considerate chiare (quiet zone).
    function quattroChiari(linea, da, a) {
      for (var i = da; i <= a; i++) {
        if (i >= 0 && i < linea.length && linea[i] !== 0) { return false; }
      }
      return true;
    }

    // Regola 4: scostamento della percentuale di moduli scuri dal 50%.
    function penalitaRegola4(mod, lato) {
      var scuri = 0;
      for (var r = 0; r < lato; r++) {
        for (var c = 0; c < lato; c++) { scuri += mod[r][c]; }
      }
      var totale = lato * lato;
      var percentuale = (scuri * 100) / totale;
      var k = Math.floor(Math.abs(percentuale - 50) / 5);
      return k * N4;
    }

    function penalitaTotale(mod, lato) {
      var righe = mod;
      var colonne = new Array(lato);
      for (var c = 0; c < lato; c++) {
        colonne[c] = new Array(lato);
        for (var r = 0; r < lato; r++) { colonne[c][r] = mod[r][c]; }
      }
      return penalitaRegola1(righe) + penalitaRegola1(colonne)
        + penalitaRegola2(mod, lato)
        + penalitaRegola3(righe) + penalitaRegola3(colonne)
        + penalitaRegola4(mod, lato);
    }

    /* =========================================================================
     * 10. GENERAZIONE COMPLETA DEL SIMBOLO
     * ====================================================================== */

    function copiaMatrice(m) {
      var out = new Array(m.length);
      for (var r = 0; r < m.length; r++) { out[r] = m[r].slice(); }
      return out;
    }

    function normalizzaLivello(ecc) {
      var l = String(ecc === undefined || ecc === null ? 'M' : ecc).toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(LIVELLI, l)) {
        throw new Error('QR: livello di correzione non valido "' + ecc + '" (usa L, M, Q o H)');
      }
      return l;
    }

    // Cuore della libreria: dal testo al simbolo completo.
    function genera(testo, ecc, versioneForzata) {
      var livello = normalizzaLivello(ecc);
      var indiceLivello = LIVELLI[livello];
      var byte_ = byteUtf8(testo);

      var versione = versioneForzata || versioneMinima(byte_.length, indiceLivello);
      if (versione < 1) {
        throw new Error('QR: testo troppo lungo (' + byte_.length
          + ' byte) per un QR con correzione ' + livello);
      }
      var spec = specBlocchi(versione, indiceLivello);
      var bitNecessari = 4 + bitContatore(versione) + byte_.length * 8;
      if (bitNecessari > spec.totDati * 8) {
        throw new Error('QR: testo troppo lungo per la versione ' + versione
          + ' con correzione ' + livello);
      }

      var dati = codewordDati(byte_, versione, indiceLivello);
      var finali = codewordInterlacciati(dati, versione, indiceLivello);

      var base = scheletro(versione);
      posaCodeword(base.mod, base.fn, base.lato, finali);

      // Prova tutte e 8 le maschere e tiene quella con penalita' minore.
      var miglioreMod = null;
      var miglioreMaschera = 0;
      var migliorePenalita = Infinity;
      for (var m = 0; m < 8; m++) {
        var prova = copiaMatrice(base.mod);
        applicaMaschera(prova, base.fn, base.lato, m);
        scriviVersione(prova, base.lato, versione);
        scriviFormato(prova, base.lato, livello, m);
        var p = penalitaTotale(prova, base.lato);
        if (p < migliorePenalita) {
          migliorePenalita = p;
          miglioreMaschera = m;
          miglioreMod = prova;
        }
      }

      return {
        versione: versione,
        livello: livello,
        lato: base.lato,
        maschera: miglioreMaschera,
        penalita: migliorePenalita,
        byte: byte_.length,
        codeword: finali,
        mod: miglioreMod,
        fn: base.fn
      };
    }

    /* =========================================================================
     * 11. API PUBBLICA
     * ====================================================================== */

    // Converte la matrice interna (0/1) in array di array di booleani.
    function aBooleani(mod) {
      var out = new Array(mod.length);
      for (var r = 0; r < mod.length; r++) {
        out[r] = new Array(mod.length);
        for (var c = 0; c < mod.length; c++) { out[r][c] = mod[r][c] === 1; }
      }
      return out;
    }

    var QR = {};

    /**
     * QR.matrix(testo, ecc)
     * Ritorna un array di array di booleani (true = modulo nero), senza margine.
     * ecc: 'L' | 'M' | 'Q' | 'H' (default 'M'). Non richiede il DOM.
     */
    QR.matrix = function (testo, ecc) {
      return aBooleani(genera(testo, ecc).mod);
    };

    // Escape minimale per gli attributi dell'SVG (colori e etichetta).
    function escAttr(v) {
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * QR.svg(testo, opzioni)
     * Ritorna una stringa SVG completa e autonoma. Non richiede il DOM.
     * opzioni: { ecc:'M', margin:4, size:256, dark:'#000', light:'#fff', label:'' }
     *   - margin e' espresso in moduli (la quiet zone standard e' 4);
     *   - size e' la dimensione in pixel dell'immagine risultante;
     *   - i moduli neri sono raccolti in un unico <path>, con le sequenze
     *     orizzontali fuse per tenere il file piccolo.
     */
    QR.svg = function (testo, opzioni) {
      var o = opzioni || {};
      var res = genera(testo, o.ecc);
      var lato = res.lato;
      var margine = (o.margin === undefined || o.margin === null) ? 4 : Math.max(0, o.margin | 0);
      var totale = lato + margine * 2;
      var pixel = (o.size === undefined || o.size === null) ? 256 : Math.max(1, o.size | 0);
      var scuro = o.dark || '#000000';
      var chiaro = o.light || '#ffffff';
      var etichetta = o.label || 'Codice QR';

      // Costruzione del path: per ogni riga fondiamo i moduli neri contigui.
      var pezzi = [];
      for (var r = 0; r < lato; r++) {
        var c = 0;
        while (c < lato) {
          if (res.mod[r][c] === 1) {
            var inizio = c;
            while (c < lato && res.mod[r][c] === 1) { c++; }
            var larghezza = c - inizio;
            pezzi.push('M' + (inizio + margine) + ' ' + (r + margine)
              + 'h' + larghezza + 'v1h-' + larghezza + 'z');
          } else {
            c++;
          }
        }
      }

      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + pixel + '" height="' + pixel
        + '" viewBox="0 0 ' + totale + ' ' + totale + '"'
        + ' shape-rendering="crispEdges" role="img" aria-label="' + escAttr(etichetta) + '">'
        + '<rect x="0" y="0" width="' + totale + '" height="' + totale
        + '" fill="' + escAttr(chiaro) + '"/>'
        + '<path fill="' + escAttr(scuro) + '" d="' + pezzi.join('') + '"/>'
        + '</svg>';
    };

    /**
     * QR.draw(canvas, testo, opzioni)
     * Disegna il QR su un <canvas> gia' presente nel documento.
     * opzioni: { ecc:'M', margin:4, dark:'#000', light:'#fff', size:<px> }
     * La dimensione del canvas viene portata a un multiplo esatto del numero di
     * moduli, cosi' i quadretti restano nitidi e non sfocati.
     * Ritorna il canvas stesso.
     */
    QR.draw = function (canvas, testo, opzioni) {
      if (!canvas || typeof canvas.getContext !== 'function') {
        throw new Error('QR.draw: serve un elemento <canvas> valido');
      }
      var o = opzioni || {};
      var res = genera(testo, o.ecc);
      var lato = res.lato;
      var margine = (o.margin === undefined || o.margin === null) ? 4 : Math.max(0, o.margin | 0);
      var totale = lato + margine * 2;
      var scuro = o.dark || '#000000';
      var chiaro = o.light || '#ffffff';

      var richiesta = o.size || canvas.width || 256;
      var scala = Math.max(1, Math.floor(richiesta / totale));
      var pixel = totale * scala;
      canvas.width = pixel;
      canvas.height = pixel;

      var ctx = canvas.getContext('2d');
      ctx.fillStyle = chiaro;
      ctx.fillRect(0, 0, pixel, pixel);
      ctx.fillStyle = scuro;
      for (var r = 0; r < lato; r++) {
        var c = 0;
        while (c < lato) {
          if (res.mod[r][c] === 1) {
            var inizio = c;
            while (c < lato && res.mod[r][c] === 1) { c++; }
            ctx.fillRect((inizio + margine) * scala, (r + margine) * scala,
              (c - inizio) * scala, scala);
          } else {
            c++;
          }
        }
      }
      return canvas;
    };

    // Accesso interno usato dai test: non fa parte dell'API pubblica.
    QR._encode = function (testo, ecc, versione) { return genera(testo, ecc, versione); };

    /* =========================================================================
     * 12. AUTODIAGNOSI — QR._selfTest()
     * -------------------------------------------------------------------------
     * Verifica interna delle proprieta' strutturali e dei valori tabellari.
     * Ritorna true se tutto e' coerente, false al primo controllo fallito
     * (i dettagli finiscono su console.warn, se la console esiste).
     * Non serve al funzionamento del sito: e' una rete di sicurezza da poter
     * richiamare a mano dalla console del browser (QR._selfTest()).
     * ====================================================================== */

    QR._selfTest = function () {
      var errori = [];

      function ok(condizione, descrizione) {
        if (!condizione) { errori.push(descrizione); }
      }

      var v, l, i, r, c;
      var nomiLivelli = ['L', 'M', 'Q', 'H'];

      // --- 12.1 Tabella dei blocchi coerente con la capacita' del simbolo ----
      // Per ogni versione e livello: ec*blocchi + dati === codeword totali
      // ricavati contando i moduli liberi nel layout.
      for (v = VERSIONE_MIN; v <= VERSIONE_MAX; v++) {
        var totali = codewordTotali(v);
        for (l = 0; l < 4; l++) {
          var s = specBlocchi(v, l);
          ok(s.totale === totali,
            'tabella EC incoerente: versione ' + v + ' livello ' + nomiLivelli[l]
            + ' -> ' + s.totale + ' invece di ' + totali);
          // I blocchi del gruppo 2 hanno sempre un codeword di dati in piu'.
          ok(s.b2 === 0 || s.d2 === s.d1 + 1,
            'gruppo 2 incoerente alla versione ' + v + ' livello ' + nomiLivelli[l]);
          ok(s.blocchi > 0 && s.d1 > 0, 'blocchi nulli alla versione ' + v);
        }
      }

      // --- 12.2 Polinomi generatori di Reed-Solomon -------------------------
      // Confronto con gli esponenti di alfa pubblicati nello standard.
      var attesiGen = {
        7: [0, 87, 229, 146, 149, 238, 102, 21],
        10: [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45],
        13: [0, 74, 152, 176, 100, 86, 100, 106, 104, 130, 218, 206, 140, 78]
      };
      Object.keys(attesiGen).forEach(function (grado) {
        var g = polinomioGeneratore(Number(grado));
        var atteso = attesiGen[grado];
        var uguale = g.length === atteso.length;
        for (var k = 0; uguale && k < g.length; k++) {
          if (LOG[g[k]] !== atteso[k]) { uguale = false; }
        }
        ok(uguale, 'polinomio generatore di grado ' + grado + ' non corrisponde');
      });

      // --- 12.3 Format information (BCH 15,5 + maschera 0x5412) -------------
      // Alcuni valori della tabella C.1 dello standard.
      ok(bitFormato('L', 0) === parseInt('111011111000100', 2), 'format info L/maschera 0 errata');
      ok(bitFormato('M', 0) === parseInt('101010000010010', 2), 'format info M/maschera 0 errata');
      ok(bitFormato('Q', 4) === parseInt('010010010110100', 2), 'format info Q/maschera 4 errata');
      ok(bitFormato('H', 7) === parseInt('000100000111011', 2), 'format info H/maschera 7 errata');

      // --- 12.4 Version information (BCH 18,6) ------------------------------
      ok(bitVersione(7) === parseInt('000111110010010100', 2), 'version info v7 errata');
      ok(bitVersione(40) === parseInt('101000110001101001', 2), 'version info v40 errata');

      // --- 12.5 Posizioni degli alignment pattern ---------------------------
      // La formula viene confrontata con la tabella dell'Annex E.
      var tabellaAllineamenti = {
        1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
        7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
        11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
        15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
        18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
        32: [6, 34, 60, 86, 112, 138], 40: [6, 30, 58, 86, 114, 142, 170]
      };
      Object.keys(tabellaAllineamenti).forEach(function (chiave) {
        var calcolate = posizioniAllineamento(Number(chiave)).join(',');
        var attese = tabellaAllineamenti[chiave].join(',');
        ok(calcolate === attese,
          'posizioni allineamento versione ' + chiave + ': ' + calcolate + ' invece di ' + attese);
      });

      // --- 12.6 Codifica UTF-8 dei caratteri multibyte ----------------------
      ok(byteUtf8('a').length === 1, 'UTF-8: ASCII deve occupare 1 byte');
      ok(byteUtf8('à').length === 2, 'UTF-8: "a accentata" deve occupare 2 byte');
      ok(byteUtf8('€').length === 3, 'UTF-8: il simbolo euro deve occupare 3 byte');
      ok(byteUtf8('🍕').length === 4, 'UTF-8: le emoji devono occupare 4 byte');
      ok(byteUtf8('à')[0] === 0xC3 && byteUtf8('à')[1] === 0xA0,
        'UTF-8: byte errati per "a accentata"');

      // --- 12.7 Proprieta' strutturali dei simboli generati -----------------
      var campioni = [
        { t: 'https://johannes1979i.github.io/residence-holiday/', e: 'M' },
        { t: 'RH-0808-K7QA', e: 'H' },
        { t: 'Perché no? Pizza 🍕 a 8€ — Residence Holiday', e: 'Q' },
        { t: 'x', e: 'L' }
      ];
      // Un testo lungo che obbliga a salire di versione.
      var lungo = '';
      while (lungo.length < 700) { lungo += 'Serata Pizza in Piscina 2026. '; }
      campioni.push({ t: lungo.slice(0, 700), e: 'L' });

      for (i = 0; i < campioni.length; i++) {
        var res;
        try {
          res = genera(campioni[i].t, campioni[i].e);
        } catch (err) {
          errori.push('generazione fallita per il campione ' + i + ': ' + err.message);
          continue;
        }
        var lato = res.lato;

        // Dimensione della matrice = 4 * versione + 17.
        ok(lato === 4 * res.versione + 17,
          'dimensione errata: ' + lato + ' invece di ' + (4 * res.versione + 17));
        ok(res.mod.length === lato && res.mod[0].length === lato,
          'la matrice non e\' quadrata al campione ' + i);

        // Finder pattern nei tre angoli: anello scuro esterno, anello chiaro,
        // nucleo 3x3 scuro.
        var angoli = [[0, 0], [0, lato - 7], [lato - 7, 0]];
        for (var a = 0; a < angoli.length; a++) {
          var r0 = angoli[a][0], c0 = angoli[a][1];
          var finderOk = true;
          for (r = 0; r < 7; r++) {
            for (c = 0; c < 7; c++) {
              var d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
              var atteso = (d !== 2) ? 1 : 0;
              if (res.mod[r0 + r][c0 + c] !== atteso) { finderOk = false; }
            }
          }
          ok(finderOk, 'finder pattern errato all\'angolo ' + a + ' del campione ' + i);
        }

        // Separatori: la cornice chiara che isola i tre finder pattern.
        var sepOk = true;
        for (c = 0; c < 8; c++) {
          if (res.mod[7][c] !== 0) { sepOk = false; }
          if (res.mod[c][7] !== 0) { sepOk = false; }
          if (res.mod[7][lato - 1 - c] !== 0) { sepOk = false; }
          if (res.mod[lato - 1 - c][7] !== 0) { sepOk = false; }
        }
        ok(sepOk, 'separatori non chiari al campione ' + i);

        // Timing pattern: riga 6 e colonna 6 alternate.
        var timingOk = true;
        for (var t = 8; t < lato - 8; t++) {
          if (res.mod[6][t] !== (t % 2 === 0 ? 1 : 0)) { timingOk = false; }
          if (res.mod[t][6] !== (t % 2 === 0 ? 1 : 0)) { timingOk = false; }
        }
        ok(timingOk, 'timing pattern errato al campione ' + i);

        // Modulo scuro obbligatorio.
        ok(res.mod[lato - 8][8] === 1, 'modulo scuro mancante al campione ' + i);

        // Maschera nell'intervallo valido.
        ok(res.maschera >= 0 && res.maschera <= 7, 'maschera fuori intervallo al campione ' + i);

        // Capacita' rispettata: i codeword prodotti riempiono esattamente il
        // simbolo, ne' uno di piu' ne' uno di meno.
        var specC = specBlocchi(res.versione, LIVELLI[res.livello]);
        ok(res.codeword.length === specC.totale,
          'codeword prodotti ' + res.codeword.length + ' invece di ' + specC.totale);
        ok(specC.totale === codewordTotali(res.versione),
          'capacita\' non rispettata alla versione ' + res.versione);
        ok(4 + bitContatore(res.versione) + res.byte * 8 <= specC.totDati * 8,
          'i dati non entrano nella versione scelta al campione ' + i);

        // La versione scelta deve essere davvero la minima possibile.
        if (res.versione > 1) {
          var precedente = specBlocchi(res.versione - 1, LIVELLI[res.livello]);
          ok(4 + bitContatore(res.versione - 1) + res.byte * 8 > precedente.totDati * 8,
            'versione non minima al campione ' + i + ' (scelta ' + res.versione + ')');
        }
      }

      // --- 12.8 Superamento della capacita' -> errore esplicito -------------
      var troppo = new Array(3000).join('W');
      var haLanciato = false;
      try { genera(troppo, 'H'); } catch (e2) { haLanciato = true; }
      ok(haLanciato, 'un testo oltre la capacita\' massima deve lanciare un errore');

      // --- 12.9 Coerenza dell'API pubblica ---------------------------------
      var m = QR.matrix('Residence Holiday', 'M');
      ok(Array.isArray(m) && typeof m[0][0] === 'boolean', 'QR.matrix deve tornare booleani');
      var s2 = QR.svg('Residence Holiday', { size: 200, margin: 4 });
      ok(s2.indexOf('<svg') === 0 && s2.indexOf('viewBox="0 0 ') > 0
        && s2.indexOf('shape-rendering="crispEdges"') > 0 && s2.indexOf('</svg>') > 0,
        'QR.svg deve produrre un SVG con viewBox e crispEdges');
      ok(s2.indexOf('<path') > 0 && s2.indexOf('<rect') > 0,
        'QR.svg deve contenere sfondo e moduli');

      // Determinismo: due chiamate con gli stessi dati danno lo stesso risultato.
      ok(QR.svg('Residence Holiday') === QR.svg('Residence Holiday'),
        'la generazione deve essere deterministica');

      if (errori.length && typeof console !== 'undefined' && console.warn) {
        console.warn('QR._selfTest: ' + errori.length + ' problemi trovati');
        for (var q = 0; q < errori.length; q++) { console.warn('  - ' + errori[q]); }
      }
      return errori.length === 0;
    };

    return QR;
  }
));
