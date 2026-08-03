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
| `classifiche.html` | Classifiche, tabellone e **il tempo della gara in corso**, dal vivo |
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
| `pubblico_certamen/contatore` | Solo numeri: ragazzi, adulti, italiana, burraco | chiunque |
| `pubblico_certamen/classifica` | Classifiche, tabellone e cronometro della gara | chiunque |
| `pubblico_certamen/album` | Le foto scattate durante la festa | chiunque |
| `stato_certamen/<pezzo>` | Squadre, punteggi, tabelloni, cronometro: uno per operatore | solo con password |

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
   - **automatico bilanciato**: l'equilibrio viene prima di tutto, e le
     preferenze vengono per ultime. Nell'ordine:
     1. a ogni ragazzo si dà un **peso in acqua** = età + capacità
        (nuota bene +2, nuota poco −3): è quello che si pareggia, non l'età
        media, che nasconde gli sbilanciamenti;
     2. si mettono tutti in fila dal più forte al più debole e si dividono a
        **scaglioni**: dai primi due uno per squadra, dai secondi due uno per
        squadra, e così via — nessuno può prendersi la fascia alta;
     3. si pareggiano le **fasce**: i ragazzi dai 15 in su, i più piccoli
        fino a 10 anni e chi nuota poco, mai più di uno di differenza;
     4. **solo alla fine** le preferenze, e solo se non rovinano niente: le
        squadre si fanno due volte, una tenendo insieme gli amici e una
        ignorandoli, e vince la più equilibrata. Due amichetti di otto anni
        che si scelgono a vicenda vengono separati, perché insieme
        affonderebbero la loro squadra; due tredicenni che si scelgono
        restano insieme, perché non costa niente.
     Con il menù *«Quanto contano le preferenze»* decidi tu quanto pesano:
     di serie sta su *Prima l'equilibrio* (solo chi si è scelto a vicenda,
     e a coppie). Alla fine ti dice quante preferenze ha rispettato e quali
     no, con il motivo;
   - **a mano**: trascini i nomi, o li tocchi e poi tocchi la squadra.
   Il 🧢 accanto a un nome lo nomina capitano. Nome e grido si scrivono nei
   due campi in cima a ogni colonna.
3. **Tornei** — scheda `🃏 Tornei`. In cima decidi **come si giocano le carte
   italiane**: puoi tenerle insieme nel Trittico, giocarne solo due, oppure
   fare un torneo separato per ogni disciplina — e persino una disciplina
   sola. Tocchi i giochi che vuoi, scegli *un torneo solo* o *tornei
   separati*, e da lì escono da soli nomi, regole, tabelloni, classifiche e
   coppe. Chi si è iscritto alle carte italiane gioca tutto quello che
   decidi: non deve reiscriversi, e le coppie già formate si portano dietro.
   Poi, per ogni torneo: prima `Forma le coppie` (usa i compagni
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
4. **Punteggi** — scheda `🏅 Punteggi`: in cima c'è il **cronometro della
   gara**. Scegli la gara, premi **▶ Via** e il tempo scorre; 🎵 apre la
   scaletta di quel gioco. Quando scade suona la sirena: se nessuna squadra
   ha già vinto, vince chi è avanti in quel momento e scrivi tu l'ordine
   d'arrivo. Sotto, per i ragazzi scegli chi è arrivato primo, secondo,
   terzo…; per le carte scrivi i punti delle partite. Si salva tutto da
   solo nel database.
5. **Pubblica** — non devi fare niente. Ogni punteggio che registri arriva
   sulla pagina pubblica **da solo**, in una ventina di secondi: sei per
   scrivere nel database e mandare la bacheca, gli altri sono l'attesa del
   telefono di chi guarda. Vanno online classifiche, ordine d'arrivo di ogni
   gara, tabelloni partita per partita e il cronometro.
   In `📣 Pubblica` c'è un riquadro verde che dice *«Vanno da sole»* con l'ora
   dell'ultimo invio. Se diventa rosso qualcosa non è passato: il sito riprova
   da solo ogni mezzo minuto, e nel pieghevole lì sotto c'è il pulsante per
   forzarlo subito.
6. **Foto** — scheda `📷 Album`, pulsante `📸 Scatta una foto`:
   dal telefono si apre la fotocamera e la foto è **subito** nell'album del
   sito. Vedi sotto.

## I due «pubblica», che non sono la stessa cosa

Si confondono facilmente, ma fanno due mestieri diversi.

| | Cosa manda | Va premuto? |
|---|---|---|
| **classifiche, punteggi, tabelloni** | quello che cambia durante la festa | **no**, si fanno da sole |
| **🌐 Pubblica contenuti.json** | testi, giochi, orari, musica, regole | **sì**, quando cambi i contenuti |

I punteggi viaggiano nel **database**, come le iscrizioni: appena li scrivi
partono. I contenuti stanno invece in un **file del sito**, e quel file va
mandato a mano quando lo cambi — è l'unico pulsante che devi ricordarti.

## Lavorare in più persone

Il giorno della festa il sito lo tenete aperto in tre o quattro: uno al
Trittico, uno al burraco, uno ai giochi in acqua. Non vi pestate i piedi.

- Scrivi il tuo nome in `📊 Cruscotto → Chi sei` (Gianpaolo, Veronica…):
  serve solo a far capire agli altri chi ha cambiato cosa.
- Ognuno tocca la sua parte e **si salva solo quella**: le squadre, i punteggi
  di una gara, il tabellone di un torneo viaggiano separati. Chi non tocca il
  burraco non lo può sovrascrivere, nemmeno per sbaglio.
- Ogni dieci secondi arriva il lavoro degli altri, con un avviso in basso —
  *«🔄 Veronica ha aggiornato: burraco»*. Quello che stai scrivendo tu in quel
  momento non viene toccato.
- In `📊 Cruscotto → 👥 Chi sta lavorando` vedi chi è collegato e a cosa ha
  messo mano per ultimo.

**Se salta la rete** (in piscina succede): continua a segnare come se niente
fosse. In alto compare *«⏳ da mandare quando torna la rete»* e i punteggi
restano nel telefono; appena il segnale torna partono da soli e l'avviso
diventa *«✅ salvato nel database»*. Non chiudere il sito prima di aver visto
la spunta verde.

## La scaletta comanda tutto

I giochi dei ragazzi si sistemano in `🎯 Settaggio giochi acquatici`. Quello che
decidi lì **si propaga da solo**: non c'è nessun orario da scrivere a mano.

Sposti un gioco, lo metti di riserva, ne attivi un altro, gli cambi la durata —
e nello stesso momento si rifanno:

- gli **orari di ogni gioco**, incatenati uno dopo l'altro;
- il **programma** del pomeriggio, con la pausa e la premiazione che scivolano
  di conseguenza (le righe che non sono giochi restano dove sono: accoglienza,
  formazione delle squadre e i blocchi degli adulti);
- la **tendina del cronometro** in `🏅 Punteggi`, che elenca le gare
  nell'ordine vero con l'ora in cui toccano, e tiene le riserve in fondo;
- il **sito**, appena pubblichi: pagina dei giochi, pagina del programma,
  durate, riserve.

Sotto l'elenco dei giochi c'è **🕓 Come viene il pomeriggio**: la scaletta
completa, aggiornata a ogni tocco. Ti dice anche se si sfora — *«⚠️ Si sfora:
l'ultima riga cade dopo le 19:00»* — così te ne accorgi subito e non il giorno
della festa.

Tre cose si regolano lì:

| Comando | A cosa serve |
|---|---|
| **Il primo gioco comincia alle** | sposta in blocco tutto il pomeriggio |
| **La pausa va dopo** | scegli dopo quale gioco si va all'ombra |
| **Quanto dura la pausa** | in minuti |

Se un gioco di riserva viene attivato prende il posto che ha nell'elenco: se lo
vuoi altrove, spostalo con ⠿ o con le frecce ▲▼.

## Come far giocare le carte italiane

Briscola, scopone e tresette sono tre giochi: il giorno della festa decidi tu
come metterli insieme, in `🃏 Tornei → 🗂️ Come si giocano le carte italiane`.

| Se scegli | Viene fuori |
|---|---|
| tutte e tre, **un torneo solo** | *Il Trittico*: le prove si alternano turno dopo turno, punti sommati, una classifica e una coppa |
| due prove, **un torneo solo** | un torneo che si chiama con i due giochi, per esempio *Scopone scientifico e Tresette* |
| due o tre prove, **tornei separati** | un torneo per gioco, ognuno col suo tabellone, la sua classifica e la sua coppa |
| **una disciplina sola** | *Torneo di Scopone*, con le regole di quel gioco e basta |

Quello che cambia da solo: il nome del torneo, la coppa, la descrizione, le
regole, i turni del tabellone, la prova della finale e le classifiche. Non
devi toccare nient'altro.

- Chi si è iscritto «alle carte italiane» **gioca tutti i tornei** che decidi:
  l'iscrizione è al gruppo, non al singolo torneo.
- Le **coppie già formate si portano dietro**: se cambi idea a metà, non devi
  rifarle. Nei tornei separati puoi comunque riformarle diverse per ognuno.
- `↩️ Rimetti il Trittico` riporta tutto com'era.
- Sul sito, nella pagina degli adulti, sono elencate tutte le strade
  possibili; appena pubblichi le classifiche compare anche **quale hai
  scelto**.

## Il cronometro e la musica

Ogni gioco ha un **tempo massimo**, quello scritto nella sua durata. Il
cronometro sta in cima alla scheda `🏅 Punteggi`.

- Scegli la gara nella tendina: il tempo lo prende da solo dalla durata.
- **▶ Via** fa partire il conto alla rovescia. **⏸ Pausa** lo ferma dove sta
  (serve quando ci si ferma a spiegare), **↺ Azzera** lo riporta all'inizio.
- Sotto il minuto i numeri diventano arancioni; a zero diventano rossi e
  parte la **sirena**, con la vibrazione sul telefono. `🔕 Basta sirena` la
  zittisce, e comunque smette da sola dopo un minuto.
- **A tempo scaduto la gara finisce lì**: se nessuna squadra ha già vinto,
  vince chi è avanti in quel momento. L'ordine d'arrivo lo scrivi tu subito
  sotto, nella stessa schermata.
- Il cronometro è **uno solo per tutti**: se lo fa partire Veronica dal suo
  telefono, sullo schermo di Gianpaolo compare la stessa gara con lo stesso
  tempo. Il conto si calcola dall'ora di partenza, quindi non si sfasa mai,
  nemmeno se ricarichi la pagina.
- Una cosa da sapere: se **blocchi il telefono o vai su un'altra app**, il
  browser mette in pausa i conti e la sirena può arrivare in ritardo. Il
  tempo resta giusto — appena riguardi lo schermo si rimette in pari da
  solo — ma se vuoi la sirena puntuale tieni la pagina davanti.
- **Lo vedono anche i ragazzi**: in cima alla pagina delle classifiche
  compare una striscia con la gara in corso e il tempo che manca, verde
  mentre scorre, arancione nell'ultimo minuto, rossa a tempo scaduto. È in
  sola lettura: i comandi restano solo qui nell'admin. Un tablet appoggiato
  al bordo vasca su quella pagina fa da tabellone. Sparisce da sola tre
  minuti dopo la fine della gara.

### La scaletta di ogni gioco

Ogni gioco ha la sua **scaletta**, lunga quanto il gioco: quattro brani per
dieci minuti, otto per venticinque. Si modifica in `🎯 Settaggio giochi acquatici →
🎵 Musica dei giochi`: aggiungi brani, li sposti con ▲▼, li togli col
cestino. Sotto il nome del gioco c'è la stima — *«5 brani · circa 17 min —
coprono i 15 min del gioco»* — che diventa rossa se la scaletta è corta.

- Il **primo brano** è anche la canzone che compare sul sito accanto al
  gioco: cambiando l'uno cambia l'altro, non si sdoppiano.
- Il campo del collegamento YouTube è facoltativo. Con **almeno due
  collegamenti incollati** i brani partono in fila da soli con un tocco;
  senza, si apre solo il primo e gli altri si cercano a mano. Le canzoni che
  ho proposto io hanno il collegamento solo sulla prima: se vuoi la fila
  automatica, incolla gli indirizzi degli altri.
- Sono **solo proposte**: cambiale tutte, sono lì per non partire dal vuoto.

## L'album della giornata

Scheda **`📷 Album`**, nel menù in cima alla pagina. Dal telefono premi **📸 Scatta una foto**: si apre
la fotocamera, scatti, e la foto compare nell'album del sito **subito**, senza
pubblicare niente. Con `🖼️ Scegli dalla galleria` ne mandi anche parecchie in
una volta.

- La **didascalia se la scrive da sola** guardando l'ora e il programma —
  alle 16:40 scriverà *«16:40 — Staffetta con pallone»*. La correggi scrivendo
  nella riga sotto la foto: si salva da sola.
- L'album **si accende alla prima foto**: la spunta *«Mostra l'album sul sito»*
  vale immediatamente, sia per accendere che per spegnere.
- Le foto vengono rimpicciolite prima di partire (lato lungo 1600 px), così
  anche con la rete del cellulare partono in un attimo.
- Servono le impostazioni di GitHub in `📣 Pubblica` (le stesse che usi per
  pubblicare): la foto vera finisce nel sito, il suo indirizzo nel database.
  **Il token vale per un browser solo**: la prima volta che scatti dal telefono
  ti dirà che manca e ti porterà nel riquadro giusto. Lì lo incolli una volta e
  non ci pensi più. Per averlo sul telefono: dal computer, in `📣 Pubblica →
  🔑 Collegamento a GitHub`, premi `📋 Copia` e mandatelo con un messaggio a te
  stesso (poi cancella il messaggio); oppure rifai i tre passi di GitHub
  direttamente dal telefono, che è altrettanto veloce.
- Le foto stanno nel database, che è più veloce ma non è per sempre: quando la
  festa è finita premi **`📥 Porta le foto nei contenuti`** e poi
  `Pubblica contenuti.json`. Da quel momento l'album è dentro al sito e resta
  lì per sempre.

## L'avviso in cima al sito

`⚙️ Contenuti → 📢 Avviso`: accendi la spunta, scrivi due righe e appare una
fascia in cima a **tutte** le pagine. Serve per le cose dell'ultimo minuto —
*«Rinviato di un'ora per il temporale»*, *«Iscrizioni chiuse»*. Tre colori:
informazione (azzurro), attenzione (giallo), allarme (rosso). Va pubblicato
come tutti gli altri contenuti.

## La copia di sicurezza

`🖨️ Stampe → 💾 Copia di sicurezza`: scarica un file con **tutto** — iscritti,
squadre, tabelloni, punteggi, contatori, bacheca. Fanne una la mattina della
festa e una alla fine.

Per rimetterla: stesso posto, `Ripristina da una copia`. Rimette squadre,
tabelloni e punteggi; **le iscrizioni no**, perché quelle vivono nel database e
si rischierebbe di far tornare in vita gente cancellata.

> Il file contiene nomi, età e numeri di telefono: tienilo sul tuo telefono,
> non mandarlo in giro e non metterlo nel sito.

## Scegliere i giochi e metterli in ordine

In `🎯 Settaggio giochi acquatici` (e lo stesso per i tornei) ogni voce si
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
video** su YouTube, modificabile in `🎯 Settaggio giochi acquatici → 🎵 Musica dei giochi`.
Per cambiare brano incolla l'indirizzo del video nuovo. Se svuoti il campo, il
sito apre la ricerca del titolo: è la rete di sicurezza nel caso un video venga
rimosso.

## I numeri che si aggiornano da soli

| Cosa | Ogni quanto |
|---|---|
| Contatore iscritti (home, giochi, carte, iscrizione) | 15 secondi |
| Classifiche e tabellone | 15 secondi |
| Registro delle iscrizioni nell'admin | 1 minuto |

Quando un numero cambia **lampeggia in verde** e compare l'avviso, così se ne
accorge anche chi stava guardando altro.

⚠️ **Con la pagina in secondo piano il conteggio si ferma**, apposta, per non
consumare la batteria: appena torni sulla scheda si aggiorna subito. Se stai
provando il sito con la pagina aperta in un'altra scheda, è normale non vedere
il numero salire finché non ci torni sopra.

Nell'admin il registro **non si aggiorna mentre stai scrivendo** in un campo:
altrimenti ti cancellerebbe quello che stai battendo.

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

I pulsanti **💬 Manda su WhatsApp** e **✈️ Manda su Telegram** mandano il
messaggio con la **locandina in testa**: l'app la prende da sola dal sito, non
devi allegare niente. Funziona anche dal computer. Li trovi in fondo alla home,
nella pagina della locandina e in `📣 Pubblica → Invita la gente`.

Il messaggio nel riquadro dell'admin è **modificabile**, e i pulsanti mandano
esattamente quello che ci leggi dentro. Niente emoji: su parecchi telefoni
arrivano come quadratini.

### L'immagine che compare sopra al messaggio

È il file `images/anteprima-social.jpg` (1200×630). WhatsApp e Telegram vanno a
prenderla da soli quando qualcuno incolla il link.

**Se cambi data, titolo o luogo dell'evento, va rifatta**, altrimenti resta
quella vecchia: apri `locandina.html`, premi **🔄 Rigenera l'anteprima**, e
rimetti il file scaricato dentro `images/` con lo stesso nome.

⚠️ WhatsApp tiene in memoria l'anteprima per qualche giorno: dopo averla
cambiata, la prima volta potresti vedere ancora quella vecchia.

Sui telefoni compare anche **📎 Manda come immagine**, che allega il file vero
della locandina invece del link. Attenzione: quando WhatsApp riceve un'immagine
**scarta il testo** — arriva solo la foto. Per avere immagine *e* messaggio
insieme usa i due pulsanti principali.

## Se le modifiche non si pubblicano

Per mandare online i contenuti serve un **token di GitHub**, una volta sola.
L'area admin ti apre la sezione giusta e ti spiega i tre passi. Nel frattempo
**non perdi niente**: ogni modifica viene salvata come bozza in questo browser,
e alla riapertura l'admin ti chiede se vuoi riprenderla.

## Regole di sicurezza di Firestore

Queste sono le regole **davvero in vigore** nella console Firebase
(Firestore → Regole), pubblicate il 1 agosto 2026. Il blocco della festa in
piscina è copiato parola per parola da quello che c'era prima: non va toccato.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============ FESTA IN PISCINA — identiche a prima ============
    match /prenotazioni/{id} {
      allow create: if request.resource.data.nome is string
                    && request.resource.data.nome.size() < 200;
      allow read, update, delete: if request.auth != null;
    }
    match /pubblico/{doc} {
      allow read: if true;
      allow write: if request.resource.data.partecipanti is int
                   && request.resource.data.partecipanti >= 0
                   && request.resource.data.partecipanti <= 100000;
    }

    // ================ CERTAMEN AQUATICUM — nuove =================

    // Chiunque puo iscriversi; nomi e recapiti si leggono solo col login.
    match /iscrizioni/{id} {
      allow create: if request.resource.data.nome is string
                    && request.resource.data.nome.size() < 200
                    && request.resource.data.area in ['ragazzi', 'adulti'];
      allow read, update, delete: if request.auth != null;
    }

    // Solo quattro numeri: quanti iscritti per sezione.
    match /pubblico_certamen/contatore {
      allow read: if true;
      allow write: if request.auth != null
                   || request.resource.data.keys().hasOnly(['ragazzi', 'adulti', 'italiana', 'burraco']);
    }

    // Classifiche, tabellone e album fotografico: li legge chiunque,
    // li scrive solo l'organizzatore dopo il login.
    match /pubblico_certamen/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Squadre, punteggi e tabelloni: contengono i nomi veri.
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
