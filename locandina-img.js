/* =========================================================================
   locandina-img.js — la locandina disegnata su una tela, come immagine PNG,
   e la condivisione con l'immagine allegata.

   Perché serve: i collegamenti «wa.me» e «t.me/share» portano soltanto del
   testo, un allegato non ci sta. Per mandare anche la locandina si usa la
   condivisione del telefono (navigator.share), quella che apre il foglio con
   tutte le app: lì immagine e messaggio partono insieme. Dove non c'è — di
   solito sui computer — si ripiega scaricando l'immagine e copiando il testo.

   Richiede comune.js (per i contenuti) e qr.js (per il codice QR).
   ========================================================================= */
(function () {
  'use strict';

  var V = CA.V;
  var LARG = 1240, ALT = 1754;          /* A4 a 150 punti per pollice */
  var K = LARG / 210;                   /* punti per millimetro */

  /* ------------------------- attrezzi da disegno ------------------------ */
  function spezza(ctx, testo, larghezza) {
    var parole = String(testo || '').split(/\s+/).filter(Boolean);
    var righe = [], riga = '';
    parole.forEach(function (p) {
      var prova = riga ? (riga + ' ' + p) : p;
      if (ctx.measureText(prova).width > larghezza && riga) { righe.push(riga); riga = p; }
      else { riga = prova; }
    });
    if (riga) righe.push(riga);
    return righe.length ? righe : [''];
  }
  function angoli(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function riquadro(ctx, x, y, w, h, r, riempi, bordo) {
    angoli(ctx, x, y, w, h, r);
    if (riempi) { ctx.fillStyle = riempi; ctx.fill(); }
    if (bordo) { ctx.strokeStyle = bordo; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function pillola(ctx, x, y, w, h, colore) { riquadro(ctx, x, y, w, h, h / 2, colore, null); }

  function cartaMondo(ctx, x, y, w, h, c1, c2, titolo, testo) {
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    angoli(ctx, x, y, w, h, 34);
    ctx.fillStyle = g; ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.fillText(titolo, x + 30, y + 62);
    ctx.font = '27px "Trebuchet MS", sans-serif';
    var yy = y + 112;
    spezza(ctx, testo, w - 60).slice(0, 4).forEach(function (r) { ctx.fillText(r, x + 30, yy); yy += 36; });
    ctx.textAlign = 'center';
  }

  /* la foto della locandina, caricata a parte perché serve pronta */
  function caricaFoto() {
    var d = CA.dati();
    var loc = V(d.locandina, {});
    var src = V(loc.foto, V(d.fotoHero, (V(d.foto, [])[0] || '')));
    if (!src) return Promise.resolve(null);
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }

  /* --------------------------- la locandina ---------------------------- */
  function disegna() {
    return caricaFoto().then(function (img) {
      var d = CA.dati();
      var t = V(d.tema, {}), ev = V(d.evento, {}), res = V(d.residence, {});
      var loc = V(d.locandina, {}), con = V(d.contatti, {}), q = V(d.quota, {});
      var aree = V(d.aree, {}), rag = V(aree.ragazzi, {}), adu = V(aree.adulti, {});

      var c = document.createElement('canvas');
      c.width = LARG; c.height = ALT;
      var x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, LARG, ALT);

      var altFoto = Math.round(104 * K);
      var marg = Math.round(14 * K);

      /* foto in alto, ritagliata dentro la sua fascia */
      x.save();
      x.beginPath(); x.rect(0, 0, LARG, altFoto); x.clip();
      if (img && img.naturalWidth) {
        var scala = Math.max(LARG / img.naturalWidth, altFoto / img.naturalHeight);
        var w = img.naturalWidth * scala, h = img.naturalHeight * scala;
        x.drawImage(img, (LARG - w) / 2, (altFoto - h) * 0.55, w, h);
      } else {
        x.fillStyle = '#cfe6f5'; x.fillRect(0, 0, LARG, altFoto);
      }
      x.restore();

      var velo = x.createLinearGradient(0, 0, LARG * 0.35, altFoto);
      velo.addColorStop(0, 'rgba(6,50,92,.78)');
      velo.addColorStop(0.55, 'rgba(11,127,212,.55)');
      velo.addColorStop(1, 'rgba(11,127,212,.05)');
      x.fillStyle = velo;
      x.fillRect(0, 0, LARG, altFoto);

      /* targhetta gialla */
      var occhiello = String(V(t.occhiello, 'Ferragosto')).toUpperCase();
      x.font = 'bold 30px "Trebuchet MS", sans-serif';
      x.textBaseline = 'middle';
      pillola(x, marg, Math.round(12 * K), x.measureText(occhiello).width + 56, 60, '#ffc233');
      x.fillStyle = '#4a2c00';
      x.fillText(occhiello, marg + 28, Math.round(12 * K) + 31);
      x.textBaseline = 'alphabetic';

      /* titolo e sottotitolo */
      x.fillStyle = '#ffffff';
      x.font = 'bold 100px "Trebuchet MS", sans-serif';
      var righeTit = spezza(x, V(loc.titolo, V(t.titolo, '')), LARG - marg * 2);
      var yTit = altFoto - Math.round(20 * K) - (righeTit.length - 1) * 104;
      righeTit.forEach(function (r, i) { x.fillText(r, marg, yTit + i * 104); });
      x.font = '36px "Trebuchet MS", sans-serif';
      x.fillStyle = 'rgba(255,255,255,.95)';
      x.fillText(V(loc.sottotitolo, V(t.sottotitolo, '')), marg, altFoto - Math.round(7 * K));

      /* claim */
      var y = altFoto + 74;
      x.fillStyle = CA.colore(t.colorePrimario, '#0b7fd4');
      x.font = 'bold 46px "Trebuchet MS", sans-serif';
      x.textAlign = 'center';
      var righeClaim = spezza(x, V(loc.claim, ''), LARG - marg * 2);
      righeClaim.forEach(function (r, i) { x.fillText(r, LARG / 2, y + i * 56); });
      y += (righeClaim.length - 1) * 56 + 60;

      /* quando, orario, dove */
      var voci = [[CA.dataIt(ev.data, false), 'quando'],
      [V(ev.orario, '') + ' – ' + V(ev.orarioFine, ''), 'orario'],
      [V(ev.luogo, ''), 'dove']];
      var wBox = Math.round((LARG - marg * 2 - 40) / 3), hBox = 136;
      voci.forEach(function (v, i) {
        var bx = marg + i * (wBox + 20);
        riquadro(x, bx, y, wBox, hBox, 28, '#f2f8fd', 'rgba(10,37,64,.14)');
        x.fillStyle = '#0a2540';
        x.font = 'bold 32px "Trebuchet MS", sans-serif';
        var righe = spezza(x, v[0], wBox - 30).slice(0, 2);
        var partenza = y + (righe.length > 1 ? 48 : 62);
        righe.forEach(function (r, k) { x.fillText(r, bx + wBox / 2, partenza + k * 38); });
        x.fillStyle = '#5a7583';
        x.font = '24px "Trebuchet MS", sans-serif';
        x.fillText(v[1], bx + wBox / 2, y + hBox - 22);
      });
      y += hBox + 54;

      /* i due mondi */
      var wCard = Math.round((LARG - marg * 2 - 30) / 2), hCard = 250;
      cartaMondo(x, marg, y, wCard, hCard, '#14c4b4', '#0b7fd4',
        V(rag.nome, 'Giochi in acqua'),
        CA.giochiAttivi().length + ' giochi a squadre con palloni e materassini. Per ' +
        V(rag.etichetta, 'ragazzi') + (rag.eta ? ' ' + rag.eta : '') + '.');
      cartaMondo(x, marg + wCard + 30, y, wCard, hCard, '#0b7fd4', '#1f8a5b',
        V(adu.nome, 'Tornei di carte'),
        CA.torneiAttivi().map(function (v) { return v.nome; }).join(', ') + '. Si gioca a coppie.');
      y += hCard + Math.round(10 * K);

      /* QR e istruzioni */
      var lato = 300;
      try {
        var tela = document.createElement('canvas');
        QR.draw(tela, CA.urlSito(), { size: lato, margin: 2, ecc: 'M', dark: '#0a2540', light: '#ffffff' });
        x.drawImage(tela, marg, y, lato, lato);
        x.strokeStyle = '#0a2540'; x.lineWidth = 6;
        x.strokeRect(marg, y, lato, lato);
      } catch (e) { }

      x.textAlign = 'left';
      var tx = marg + lato + 44, tw = LARG - tx - marg;
      x.fillStyle = '#0a2540';
      x.font = 'bold 40px "Trebuchet MS", sans-serif';
      x.fillText(q.attiva === true ? 'Iscriviti online' : 'Iscriviti online, è gratis', tx, y + 44);
      x.fillStyle = '#33566b';
      x.font = '30px "Trebuchet MS", sans-serif';
      var yy = y + 96;
      spezza(x, V(loc.istruzioniQr, ''), tw).forEach(function (r) { x.fillText(r, tx, yy); yy += 40; });

      var nota = V(loc.nota, '') + (q.attiva === true ? (' · quota ' + CA.eur(q.importo) + ' a persona') : '');
      if (nota) {
        x.font = 'bold 28px "Trebuchet MS", sans-serif';
        var righeNota = spezza(x, nota, tw - 40);
        riquadro(x, tx, yy + 6, tw, righeNota.length * 38 + 26, 14, '#ffc233', null);
        x.fillStyle = '#4a2c00';
        righeNota.forEach(function (r, i) { x.fillText(r, tx + 20, yy + 44 + i * 38); });
      }

      /* piedino */
      x.strokeStyle = 'rgba(10,37,64,.18)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(marg, ALT - 90); x.lineTo(LARG - marg, ALT - 90); x.stroke();
      x.fillStyle = '#5a7583';
      x.font = '26px "Trebuchet MS", sans-serif';
      x.fillText(V(res.nome, '') + (res.localita ? ' — ' + res.localita : ''), marg, ALT - 48);
      if (con.telefono) {
        x.textAlign = 'right';
        x.fillText('Informazioni: ' + con.telefono, LARG - marg, ALT - 48);
      }
      return c;
    });
  }

  /* PNG per chi la scarica (nitida, buona anche da stampare); JPEG per la
     condivisione, che pesa un quinto e nei gruppi viene comunque ricompressa. */
  function file(perCondividere) {
    return disegna().then(function (c) {
      return new Promise(function (ok) {
        if (perCondividere) {
          c.toBlob(function (b) {
            ok(new File([b], 'locandina-certamen-aquaticum.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.94);
        } else {
          c.toBlob(function (b) {
            ok(new File([b], 'locandina-certamen-aquaticum.png', { type: 'image/png' }));
          }, 'image/png');
        }
      });
    });
  }

  function scarica() {
    return file().then(function (f) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return true;
    });
  }

  /* Può il telefono condividere un'immagine insieme al testo? */
  function sannoFarlo() {
    if (!navigator.share || !navigator.canShare) return false;
    try {
      var finto = new File([new Blob(['x'])], 'p.png', { type: 'image/png' });
      return navigator.canShare({ files: [finto] });
    } catch (e) { return false; }
  }

  /* Condivide locandina + messaggio. Da chiamare al tocco di un pulsante:
     i telefoni non aprono il foglio di condivisione se non c'è un gesto. */
  function condividi(alFallimento) {
    var testo = CA.messaggioInvito();
    if (!sannoFarlo()) {
      /* niente condivisione con allegati: si scarica l'immagine e si copia il
         testo, poi la persona allega a mano nel gruppo */
      return scarica().then(function () {
        copiaTesto(testo);
        if (alFallimento) alFallimento();
        return 'scaricata';
      });
    }
    return file(true).then(function (f) {
      return navigator.share({
        files: [f],
        text: testo,
        title: V(CA.dati().tema, {}).titolo || 'Certamen Aquaticum'
      }).then(function () { return 'condivisa'; });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return 'annullata';   /* ha chiuso il foglio */
      return scarica().then(function () {
        copiaTesto(testo);
        if (alFallimento) alFallimento();
        return 'scaricata';
      });
    });
  }

  function copiaTesto(t) {
    try {
      if (navigator.clipboard) { navigator.clipboard.writeText(t); return true; }
    } catch (e) { }
    return false;
  }

  window.LOC = {
    disegna: disegna, file: file, scarica: scarica,
    condividi: condividi, sannoFarlo: sannoFarlo
  };
})();
