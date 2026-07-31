# Certamen Aquaticum — guida per l'organizzatore

Il torneo di Ferragosto del Residence Holiday: giochi in acqua per i ragazzi,
tornei di carte per gli adulti.

- **Sito pubblico**: <https://johannes1979i.github.io/certamen-aquaticum/>
- **Area organizzatori**: <https://johannes1979i.github.io/certamen-aquaticum/admin.html>
  (password `holiday2026`, poi email e password Firebase)

Dopo ogni pubblicazione premi **⌘⇧R** per vedere davvero le modifiche.

---

## Le pagine del sito

| Pagina | Cosa contiene |
|---|---|
| `index.html` | Ingresso: informazioni generali, contatori in tempo reale, riquadri verso le sezioni |
| `ragazzi.html` | I giochi in acqua, con regole, varianti, illustrazione e canzone |
| `carte.html` | I tornei di carte e **le due iscrizioni separate** (all'italiana / burraco) |
| `iscrizione-ragazzi.html` | Iscrizione ai giochi in acqua |
| `iscrizione-italiana.html` | Iscrizione a scopone, briscola e tresette |
| `iscrizione-burraco.html` | Iscrizione al burraco |
| `programma.html` | Il programma ora per ora |
| `classifiche.html` | Classifiche e tabellone, aggiornati dal vivo |
| `regole.html` | Sicurezza in acqua, regolamento, premi |
| `piscina.html` | Le foto della piscina |
| `admin.html` | Area organizzatori |
| `locandina.html` | Locandina A4 con QR, da stampare |

## Dove stanno i dati

Tutto quello che conta vive nel **database Firebase** del progetto
`residence-holiday-ef6e9`, in collezioni nuove e separate da quelle della festa:

| Dove | Cosa | Chi lo legge |
|---|---|---|
| `iscrizioni` | Un documento per iscritto, con nome e recapiti | solo con password |
| `stato_certamen/gara` | Squadre, punteggi, coppie, tabelloni | solo con password |
| `pubblico_certamen/contatore` | Solo numeri: ragazzi, adulti, italiana, burraco | chiunque |
| `pubblico_certamen/classifica` | Classifiche e tabellone da appendere in bacheca | chiunque |

**Regola d'oro**: nomi e recapiti si leggono solo con la password. Nei documenti
pubblici finiscono numeri, nomi di squadra e — se lo decidi tu — i nomi dei
ragazzi accorciati (`Giulia B.`).

I **contenuti** del sito (testi, giochi, orari, foto, musica) stanno invece in
`contenuti.json`, che si modifica dall'admin e si pubblica su GitHub.

## Come si lavora il giorno della festa

1. **Accoglienza** — stampa l'elenco da `🖨️ Stampe → Elenco per l'accoglienza`
   e spunta chi arriva.
2. **Squadre** — scheda `🚩 Squadre`: la procedura guidata ti dice quante
   squadre conviene fare, poi scegli:
   - **automatico bilanciato**: tiene conto di tutte e tre le cose chieste
     all'iscrizione — la **preferenza** («vorrei stare con…»), l'**età** e la
     **capacità in acqua**. Prima mette insieme chi si è scelto (chi si è
     scelto a vicenda ha la precedenza, e riconosce anche i nomi scritti a
     metà, tipo «Sofia» per «Sofia Greco»), poi distribuisce le età a
     serpentina e sparpaglia chi nuota poco. Alla fine ti dice quante
     preferenze ha rispettato e quali no, con il motivo;
   - **a mano**: trascini i nomi, o li tocchi e poi tocchi la squadra.
   Il 🧢 accanto a un nome lo nomina capitano. Nome e grido si scrivono nei
   due campi in cima a ogni colonna.
3. **Tornei** — scheda `🃏 Tornei`: prima `Forma le coppie` (usa i compagni
   dichiarati, poi abbina i rimasti mettendo insieme un esperto e un
   principiante), poi scegli la formula e `Genera il tabellone`.
   Nel **Trittico** ogni turno gioca una prova diversa — briscola, scopone,
   tresette — e il nome del turno lo dice: la coppia resta la stessa e i punti
   delle tre prove si sommano in una classifica unica.
   La formula la consiglia il sito in base a quante coppie ci sono:
   - 2 coppie → sfida diretta al meglio delle tre
   - 3–6 coppie → girone all'italiana
   - 7–12 coppie → due gironi, semifinali e finale
   - 13 e più → tabellone a eliminazione diretta
4. **Punteggi** — scheda `🏅 Punteggi`: per i ragazzi scegli chi è arrivato
   primo, secondo, terzo…; per le carte scrivi i punti delle partite.
   Si salva tutto da solo nel database.
5. **Pubblica** — non devi fare niente: con l'interruttore
   **«Aggiorna la bacheca da sola»** acceso (lo è di serie), ogni punteggio che
   registri finisce in bacheca entro pochi secondi, e chi guarda le classifiche
   dal telefono le vede cambiare da sole ogni quindici secondi, con un lampo
   verde quando arrivano dati nuovi. Il pulsante `Pubblica adesso` serve solo
   se hai spento l'automatismo o vuoi forzare l'aggiornamento.

## Scegliere i giochi e metterli in ordine

In `⚙️ Contenuti → 🎯 Giochi in acqua` (e lo stesso per i tornei) ogni voce si
può **spostare** trascinando la maniglia ⠿ oppure con le frecce ▲▼ — dal
telefono usa le frecce, il trascinamento col dito è scomodo. Ogni voce ha tre
stati:

- **✅ In programma** — si gioca, e compare nell'elenco del sito;
- **🔄 Di riserva** — resta sul sito ma segnata come «se avanza tempo»;
- **🚫 Escluso** — sparisce da tutto: sito, punteggi, classifiche e stampe.

Sotto l'elenco c'è la **somma delle durate** dei giochi in programma,
confrontata con le ore dell'evento: se diventa rossa, hai messo troppa roba.

## La musica dei giochi

Ogni gioco dei ragazzi ha la sua canzone con il **collegamento diretto al
video** su YouTube, modificabile in `⚙️ Contenuti → 🎵 Musica dei giochi`.
Per cambiare brano incolla l'indirizzo del video nuovo. Se svuoti il campo, il
sito apre la ricerca del titolo: è la rete di sicurezza nel caso un video venga
rimosso.

## Gli avvisi su Telegram

A ogni iscrizione arriva un messaggio con nome, sezione, recapito e i totali
aggiornati. Usa lo stesso bot della festa, **@holiday_prenotazioni_feste_bot**:
i messaggi del Certamen cominciano con `🏊 CERTAMEN AQUATICUM`, così non si
confondono con le prenotazioni della festa.

In `📣 Pubblica → 🤖 Avvisi su Telegram` trovi il token, l'id della chat e il
pulsante **Manda un messaggio di prova**: premilo ogni tanto prima dell'evento,
per essere sicuro che funzioni.

**Se vuoi un bot dedicato al Certamen** (per esempio per farlo scrivere nel
gruppo del residence invece che a te):

1. Su Telegram cerca **@BotFather** e scrivigli `/newbot`
2. Dai un nome e un nome utente che finisca per `bot`
3. Copia il token che ti risponde e incollalo nel campo «Token del bot»
4. Apri la chat col bot nuovo e mandagli un messaggio qualsiasi: senza,
   Telegram non gli permette di scriverti per primo
5. Premi **Qual è il mio id?** per farti dire dove deve scrivere, poi
   **Manda un messaggio di prova**
6. Alla fine premi **Pubblica contenuti.json**, altrimenti resta valido il
   vecchio bot

Per gli avvisi in un **gruppo**: aggiungi il bot al gruppo, scrivici dentro un
messaggio, poi premi «Qual è il mio id?» e scegli l'id del gruppo (comincia
con `-100`).

## Far girare la voce

In `📣 Pubblica → Invita la gente` trovi il **messaggio già pronto** con data,
giochi e link per iscriversi: puoi copiarlo o aprire direttamente WhatsApp o
Telegram. Gli stessi pulsanti stanno anche in fondo alla home del sito.

Per allegare la **locandina** apri `locandina.html` e premi
**⬇️ Scarica come immagine**: viene fuori un PNG in formato A4, che WhatsApp e
Telegram mostrano subito nel messaggio (i PDF no).

## Se le modifiche non si pubblicano

Per mandare online i contenuti serve un **token di GitHub**, una volta sola.
L'area admin ti apre la sezione giusta e ti spiega i tre passi. Nel frattempo
**non perdi niente**: ogni modifica viene salvata come bozza in questo browser,
e alla riapertura l'admin ti chiede se vuoi riprenderla.

## Regole di sicurezza di Firestore

Da incollare nella console Firebase (Firestore → Regole):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- FESTA IN PISCINA (lasciare com'era) ---
    match /prenotazioni/{doc} {
      allow create: if request.resource.data.nome is string;
      allow read, update, delete: if request.auth != null;
    }
    match /pubblico/{doc} {
      allow read: if true;
      allow write: if true;
    }

    // --- CERTAMEN AQUATICUM ---

    // Chiunque può iscriversi; nomi e recapiti si leggono solo con il login.
    match /iscrizioni/{doc} {
      allow create: if request.resource.data.nome is string
                    && request.resource.data.area in ['ragazzi', 'adulti'];
      allow read, update, delete: if request.auth != null;
    }

    // Documenti pubblici: solo numeri e classifiche, niente recapiti.
    // Il contatore lo scrive anche chi si iscrive (senza login);
    // la classifica la scrive solo l'organizzatore.
    match /pubblico_certamen/contatore {
      allow read: if true;
      allow write: if true;
    }
    match /pubblico_certamen/classifica {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Il lavoro degli organizzatori: squadre, punteggi, tabelloni.
    match /stato_certamen/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Vincoli tecnici

- Sito statico puro: HTML, CSS e JavaScript. **Nessun CDN, nessuna libreria
  esterna, nessun build step.**
- Le illustrazioni dei giochi sono SVG scritti a mano dentro
  `illustrazioni.js`: nessuna immagine da scaricare.
- Mobile-first, ma a piena larghezza su ogni schermo.
- Mai `innerHTML` con dati che arrivano da fuori.

## Se qualcosa non va

Prima cosa in assoluto: **📊 Cruscotto → 🩺 Stato del database →
Controlla il collegamento**. Ti dice in italiano che cosa è bloccato e, se
mancano le regole di sicurezza, te le prepara già pronte da copiare.

- **«Missing or insufficient permissions»** → mancano le regole di sicurezza.
  Le iscrizioni **non vengono salvate** (l'avviso Telegram arriva lo stesso,
  ma il registro resta vuoto). Incolla le regole e ricontrolla.
- **«Non vedo le modifiche»** → quasi sempre è la cache: **⌘⇧R**.
- **«Non riesco a pubblicare i contenuti»** → manca il token GitHub: si
  incolla in `📣 Pubblica → Collegamento a GitHub`.
- **Un'iscrizione è arrivata su Telegram ma non nel registro** → succede se il
  database era bloccato in quel momento. Due strade: se la persona riapre la
  pagina di iscrizione dal suo telefono, il sito riprova da solo e la
  registra; altrimenti aggiungila a mano da `📋 Iscrizioni → Aggiungi a mano`,
  copiando i dati dal messaggio Telegram.

### Le credenziali, chiare una volta per tutte

Sono tre cose diverse e si confondono facilmente:

| Cosa | Dove si usa | A cosa serve |
|---|---|---|
| Password `holiday2026` | schermata d'ingresso dell'admin | apre l'area organizzatori |
| Email + password Firebase | «Entra nel database» dentro l'admin | legge iscrizioni, squadre e punteggi |
| Account Google del progetto | console di Firebase, sul sito di Google | cambia le **regole di sicurezza** |

Le prime due non danno accesso alle regole: quelle si cambiano solo dalla
console di Firebase, con l'account Google proprietario del progetto.
