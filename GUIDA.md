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
| `index.html` | Ingresso: informazioni generali, contatori in tempo reale, riquadri verso le sezioni, **la sigla e il jingle da ascoltare** |
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
| `tabellone.html` | Tabellone a schermo pieno per un tablet a bordo vasca |

## Dove stanno i dati

Tutto quello che conta vive nel **database Firebase** del progetto
`residence-holiday-ef6e9`, in collezioni nuove e separate da quelle della festa:

| Dove | Cosa | Chi lo legge |
|---|---|---|
| `iscrizioni` | Un documento per iscritto, con nome e recapiti | solo con password |
| `pubblico_certamen/contatore` | Solo numeri: ragazzi, adulti, italiana, burraco | chiunque |
| `pubblico_certamen/classifica` | Classifiche, tabellone e cronometro della gara | chiunque |
| `pubblico_certamen/album` | Le foto e i video della giornata | chiunque |
| `stato_certamen/<pezzo>` | Squadre, punteggi, tabelloni, cronometro: uno per operatore | solo con password |

**Regola d'oro**: nomi e recapiti si leggono solo con la password. Nei documenti
pubblici finiscono numeri, nomi di squadra e — se lo decidi tu — i nomi dei
ragazzi accorciati (`Giulia B.`).

I **contenuti** del sito (testi, giochi, orari, foto, musica) stanno invece in
`contenuti.json`, che si modifica dall'admin e si pubblica su GitHub.

## Aprire e chiudere le iscrizioni

`📋 Iscrizioni`, primo riquadro: **🎟️ Iscrizioni aperte o chiuse**. In cima c'è
sempre scritto cosa vede chi apre il sito **adesso**, e sotto tre pulsanti:

- **🔓 Aperte** — restano aperte finché non dici tu, data ignorata. È quello da
  usare quando devi aggiungere qualcuno all'ultimo momento;
- **📅 Si chiudono da sole** — vale la data qui sotto, ed è il comportamento di
  sempre;
- **🔒 Chiuse** — chiuse subito, anche se la data non è ancora arrivata: serve
  quando i posti sono finiti.

La scelta sta in `contenuti.json`, quindi **va pubblicata**: il pulsante lo fa
da solo se hai il token di GitHub, e sul sito si vede in una trentina di
secondi. Se il token manca — capita sul telefono — la scelta resta salvata lì
e compare un riquadro rosso che te lo dice: non ti sposta di scheda, e quando
vuoi c'è il pulsante per sistemarlo.

A iscrizioni chiuse **tu puoi sempre aggiungere una persona a mano**, con
`➕ Aggiungi a mano` nel registro qui sotto: chiudere lo sportello ferma il
sito, non te.

## Come si lavora il giorno della festa

1. **Accoglienza** — scheda `✅ Appello`:
   ci sono tutti i nomi, e si tocca `C'è` o `Manca`. Se le squadre sono già
   fatte i nomi arrivano raggruppati per squadra. In alto il conto: quanti
   presenti, quanti assenti, quanti da spuntare.
   Lo tengono **in più persone insieme**: le spunte si fondono, nessuno
   cancella quelle degli altri. `✅ Sono arrivati tutti` chiude in fretta
   quando manca poco, senza toccare chi hai già segnato assente.
   Se preferisci la carta, l'elenco stampato è sempre in `🖨️ Stampe`.
2. **Squadre** — scheda `🚩 Squadre`: la procedura guidata ti dice quante
   squadre conviene fare, poi scegli:
   - **automatico bilanciato**: contano **solo età e capacità in acqua**. Le
     preferenze («vorrei stare con…») di serie **non si guardano**: si
     leggono, si elencano, e non entrano nel calcolo. Nell'ordine:
     1. a ogni ragazzo si dà un **peso in acqua** = età + capacità
        (nuota bene +1, nuota poco −1,5): è quello che si pareggia, non l'età
        media, che nasconde gli sbilanciamenti. **Comanda l'età**: il nuoto
        sposta ma non ribalta. Prima i due numeri erano così larghi che un
        decenne che nuota bene valeva più di un tredicenne che nuota poco —
        in acqua non è così;
     2. si mettono tutti in fila dal più forte al più debole e si dividono a
        **scaglioni**: dai primi due uno per squadra, dai secondi due uno per
        squadra, e così via — nessuno può prendersi la fascia alta;
     3. si pareggiano le **fasce**, mai più di uno di differenza fra una
        squadra e l'altra: i ragazzi dai 15 in su, i più piccoli fino a 10
        anni, chi nuota poco e — se la categoria è indicata — **maschi e
        femmine**;
     4. per ultimo il vincolo di chi **non deve mai stare insieme**.
     Con il menù *«Quanto contano le preferenze»* puoi cambiare idea: di serie
     sta su ***Ignorale***, ma ci sono ancora i tre livelli di prima se un
     anno vorrai accontentare qualcuno. Anche ignorandole, le richieste
     arrivate te le elenca lo stesso — se vuoi accontentare due amici basta
     spostarli a mano dopo;
   - **a mano**: trascini i nomi, o li tocchi e poi tocchi la squadra.
   **Chi non deve mai stare con chi**: nel pieghevole sotto le due tendine,
   `Chi non deve mai finire nella stessa squadra`. Si scelgono i due nomi
   dalle tendine (non si scrivono: un nome sbagliato è una regola che sembra
   attiva e non lo è) e da lì in poi il programma li tiene divisi **sempre**,
   anche se si sono dichiarati amici e anche se hai messo «Prima le
   preferenze». È un vincolo, non un desiderio: viene applicato per ultimo,
   quando tutto il resto è già pareggiato, scegliendo lo scambio che costa
   meno in equilibrio. Se proprio non ci riesce, te lo dice invece di tacere.
   Di serie c'è già Adriano Gelasi mai con Matteo Papale.
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
   Se una sola coppia non va, non serve rifare tutto: nella scheda
   `👥 Le coppie` **sposta i nomi**. Trascina un nome sopra un altro e i due
   si scambiano di posto; dal telefono tocca il primo e poi il secondo.
   Il tabellone non si tocca: le partite restano quelle, cambia solo chi
   siede al tavolo — si può fare anche a torneo cominciato.
   Se invece non ti convince nessuna, `🔄 Rifai le coppie da capo` le
   ricalcola: chi si è dichiarato un compagno resta con il suo, e cambiano
   solo gli abbinamenti fatti dal sito — che ogni volta escono diversi, pur
   restando sempre un esperto con un principiante. Premilo finché non sei
   contento. `🧹 Azzera le coppie` invece le toglie e basta.
   Tutti e due chiedono conferma e ti dicono prima cosa se ne va: il
   tabellone si rigenera in un secondo, ma **i punteggi già segnati no**.
   Nel **Trittico** col **girone all'italiana** si gioca tutto: ogni coppia
   incontra tutte le altre **a ognuna delle prove**. Prima il giro completo di
   briscola, poi quello di scopone, poi quello di tresette; la coppia resta la
   stessa e i punti si sommano in una classifica unica. Se scegli due giochi su
   tre, i giri diventano due. Negli altri formati — gironi, eliminazione — le
   prove si alternano invece turno dopo turno, se no non ci starebbe.
   **Segnare una partita mano per mano.** Sotto ogni partita del tabellone c'è
   `🧮 Segna le mani, una per una`: si apre, si preme `➕ Un'altra mano` e si
   scrivono i punti dei due lati. Il totale in cima si aggiorna da solo a ogni
   cifra, e sotto c'è scritto quanto manca a ciascuna coppia — *«Mancano 15
   punti a Marco R. – Sara N. e 36 a Anna B. – Paolo G.»*. Appena una arriva al
   traguardo, la riga diventa verde e dice **«🏆 Partita finita: … ha passato i
   41»**: non devi sommare niente e non devi dichiarare il vincitore, la
   classifica si aggiorna da sé. Se sbagli una mano la correggi o la butti col
   cestino, e tutto si ricalcola.
   Il traguardo si cambia in `⚙️ Contenuti`, dentro il torneo o dentro la
   singola prova, alla voce «traguardo»: di serie 41.

   Sotto la formula c'è il **riquadro dei tempi**: quanti turni, quante
   partite, quanti tavoli in parallelo e quanto dura in tutto, confrontato con
   la finestra vera del torneo. Se non ci sta te lo dice prima, con le vie
   d'uscita e i minuti giusti per ognuna.
   Due cose che il riquadro sa e che sfuggono sempre:
   - **il tempo lo fanno i turni, non le partite**. I tavoli giocano insieme,
     quindi raddoppiare le coppie non raddoppia la durata: quello che conta è
     quante volte tutti si alzano e si rimettono a sedere;
   - **con un numero dispari di coppie una resta a guardare a ogni turno**.
     Trovare due persone in più non allunga il torneo di un minuto e fa
     giocare tutti: il riquadro te lo ricorda da solo.
   - **ogni gioco ha il suo passo**: una partita intera di scopone dura il
     doppio di una di tresette, e il conto lo tiene in considerazione invece
     di usare una media che non corrisponde a nessuna partita vera.

   Come sta la giornata delle carte: **16:00 → 18:00**, due ore piene. Si
   giocano **scopone e tresette**, partite intere **a 41 punti**, segnate mano
   per mano. Niente partite troncate dal cronometro.
   Sono **3 turni da quaranta minuti** su due tavoli, 6 partite: girone
   all'italiana con le prove che si alternano — **16:00 scopone, 16:40
   tresette, 17:20 scopone** — e coppa alle 18:00. Ogni coppia incontra tutte
   le altre una volta e gioca tutti e due i giochi.
   **Si gioca sempre tutto insieme**: dentro un turno le partite partono nello
   stesso momento, una per tavolo, e tutte le coppie sono in gioco. Sopra ogni
   turno c'è scritto quante ne partono insieme, ogni partita dice il suo
   tavolo, e se le coppie fossero dispari dice anche chi riposa.
   Con partite a 41 un turno vuole quaranta minuti: in due ore ce ne stanno
   tre, non sei. Per questo le prove si alternano invece di fare un giro
   completo per ognuna — la scelta è in `🃏 Tornei`, sotto «Quante volte si
   incontrano le coppie», e un altro anno con più tempo si cambia.
   Il **burraco è messo da parte**: nessun iscritto, e i tavoli servono alle
   carte italiane. Si rimette togliendo la spunta «escluso» in ⚙️ Contenuti.
   La **briscola è messa da parte**, non cancellata: le sue regole restano nel
   catalogo e un tocco su `🂡 Briscola` nella scheda Tornei la rimette dentro
   (ma allora i turni diventano 9 e si sfora nella domenica).
   Con due prove il torneo non si chiama più «Trittico»: il sito lo ribattezza
   da solo col nome dei giochi che si fanno.
   La formula la consiglia il sito in base a quante coppie ci sono:
   - 2 coppie → sfida diretta al meglio delle tre
   - 3–6 coppie → girone all'italiana
   - 7–12 coppie → due gironi, semifinali e finale
   - 13 e più → tabellone a eliminazione diretta
4. **Punteggi** — scheda `🏅 Punteggi`. In cima trovi **la sigla e il
   jingle**, pronti da far partire sull'altoparlante senza cercarli nel
   telefono. **Si scaricano da soli appena apri la scheda**, non quando premi
   play: la sigla pesa quattro megabyte, e cominciare a scaricarla col dito
   già sul pulsante vuol dire restare lì ad aspettare davanti a tutti. Sotto i
   due lettori c'è scritto a che punto è — *«⏳ sto scaricando»*, poi
   *«✅ Musica pronta: parte al primo tocco (3:05 e 0:13)»*. Apri la scheda
   qualche minuto prima delle 16:00 e non ci pensi più. Subito sotto c'è il **cronometro della
   gara**. Scegli la gara, premi **▶ Via** e il tempo scorre; 🎵 apre la
   scaletta di quel gioco. Quando scade suona la sirena: se nessuna squadra
   ha già vinto, vince chi è avanti in quel momento e scrivi tu l'ordine
   d'arrivo. Sotto, per ogni gara c'è **🏁 Segna il risultato**: si apre una
   finestra e si **toccano le squadre nell'ordine in cui sono arrivate** —
   primo tocco, primo posto. I punti li mette il programma. Nella stessa
   finestra ci sono le **menzioni della gara**: ⭐ migliore in gioco,
   😄 il più simpatico, 🤝 squadra più corretta. Per le carte scrivi i punti
   delle partite. Si salva tutto da solo nel database.
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

## Chi gioca insieme e chi due alla volta

**Di regola giocano tutte le squadre insieme**, a ogni gara: si parte al via e i
punti si danno per ordine d'arrivo. Non serve nessun calendario.

Fanno eccezione **la pallanuoto e il baseball**, che sono partite fra due
squadre con la palla. Quelli hanno la spunta *«Si gioca due squadre alla volta»*
in `🎯 Settaggio giochi acquatici`, dentro ogni gioco, e per loro il pulsante
`🎲 Genera gli accoppiamenti` in `🏅 Punteggi` fa le partite: con quattro squadre
sono due partite per gioco, e **giocano tutte lo stesso**. Gli accoppiamenti
cambiano da un gioco all'altro, così non si incontrano sempre le stesse.

Se un domani ti servisse anche per un altro gioco, basta spuntarlo lì.

**Nessuna gara dà punti a una persona**: tutte danno punti alla squadra, 5/3/2/1
(la finale il doppio). Anche quelle che si giocano uno alla volta — il nuoto col
pallone, King of the Mat — sono gare di squadra: nel nuoto col pallone i
piazzamenti delle batterie si sommano, in King of the Mat i componenti si
sfidano a duello e la squadra che resta senza ha perso.
Vuol dire anche che **nessun gioco può più restare senza scheda**: prima i tipi
«individuale» venivano saltati dai punteggi, ed è così che due gare in programma
erano diventate impossibili da segnare. Adesso ogni gioco ha la sua strada, o la
scheda con l'ordine d'arrivo o il calendario a coppie.
Le corone restano: Re e Regina del materassino, miglior giocatore, miglior
capitano si assegnano in `🏆 Premi e titoli`, alla fine, e non tolgono né danno
punti a nessuno.

## Le gare all'ultimo rimasto

**Palla bollente**, **Cavalca il materassino** e **Re e regina del materassino**
si giocano tutti insieme, alla *battle royale*: si va avanti a eliminare finché
resta una squadra sola.

- **Palla bollente** — chi resta con la palla in mano esce.
- **Cavalca il materassino** — a ogni batteria parte un componente per squadra,
  quattro materassini, e l'ultimo che arriva esce.
- **Re e regina del materassino** — sui materassini si sale a due per volta, uno
  contro uno, e chi tocca l'acqua esce. Con quattro materassini si combattono
  quattro duelli insieme: si fa in fretta anche con venti ragazzi.

In tutte e tre: **la squadra che per prima resta senza nessuno è ultima**, poi la
penultima, e vince quella che ha in acqua l'ultimo ragazzo rimasto. I punti sono
i soliti 5/3/2/1.

## Come si segnano: si tocca chi esce

In `🏁 Segna il risultato`
la finestra cambia da sola: **tocchi le squadre nell'ordine in cui escono**, e
accanto compare *«1ª uscita», «2ª uscita»*. La classifica la gira il programma —
chi non tocchi mai è quello che è rimasto in acqua per ultimo, e vince.

È fatta così perché durante la gara si vede una cosa sola: chi esce. Segnare
l'ordine d'arrivo vorrebbe dire ricostruirlo a mente al contrario, con venti
ragazzi che urlano.

La spunta *«A eliminazione»* sta accanto all'altra, in `🎯 Settaggio giochi
acquatici`: vale per qualunque gioco tu voglia giocare così.

## I materassini e le gare in contemporanea

Ne avete **quattro**, uno per squadra: a ogni gara scendono in acqua **tutte
insieme**, anche a quelle col materassino, e i punti si danno per ordine
d'arrivo. Il numero si cambia in `🎯 Settaggio giochi acquatici`, alla voce
«Quanti materassini avete», e tutto il resto si regola da solo.

Le **gare a scontri** (due squadre alla volta, in parallelo su giochi diversi)
sono nate quando i materassini erano due e non bastavano. Adesso non servono
più: restano se ti piacciono — partite corte, una contro una, più partite in
tutto — ma non sono più obbligate. Il riquadro in `🏅 Punteggi` te lo dice da
solo: *«Hai 4 materassini per 4 squadre: uno per squadra, non c'è più bisogno
di dividersi»*. Se un domani le squadre diventassero cinque, lo stesso riquadro
ti avviserebbe che alle gare col materassino non ci stanno tutte insieme.

## Segnare il risultato di una gara

Niente tendine e niente numeri da scrivere: in `🏅 Punteggi`, sotto ogni gara,
c'è **🏁 Segna il risultato**. Si apre una finestra e si **toccano le squadre
nell'ordine in cui sono arrivate**: il primo tocco è il primo posto, il secondo
il secondo, e così via. Accanto a ogni squadra compare la medaglia e i punti
che si prende — 5, 3, 2, 1, e il doppio nella finale.

Se sbagli, tocchi di nuovo quella squadra e torna in fondo. `↩️ Ricomincia`
azzera tutto.

Nella stessa finestra, sotto, ci sono le **menzioni della gara**, facoltative:

| | |
|---|---|
| ⭐ | Migliore in gioco |
| 😄 | Il più simpatico |
| 🤝 | Squadra più corretta |

Servono a fine giornata: in `⭐ Titoli e premi` compare il conto di chi le ha
raccolte più volte — *«Migliore in gioco: Marco (3)»* — e i premi finali si
scelgono da soli, senza doverci pensare mentre si smonta tutto.

Le menzioni si cambiano nei contenuti, come tutto il resto.

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

- Scrivi il tuo nome in `📊 Cruscotto → Chi sei` (Gianpaolo, Lorenzo…):
  serve solo a far capire agli altri chi ha cambiato cosa.
- Ognuno tocca la sua parte e **si salva solo quella**: le squadre, i punteggi
  di una gara, il tabellone di un torneo viaggiano separati. Chi non tocca il
  burraco non lo può sovrascrivere, nemmeno per sbaglio.
- Ogni dieci secondi arriva il lavoro degli altri, con un avviso in basso —
  *«🔄 Lorenzo ha aggiornato: burraco»*. Quello che stai scrivendo tu in quel
  momento non viene toccato.
- In `📊 Cruscotto → 👥 Chi sta lavorando` vedi chi è collegato e a cosa ha
  messo mano per ultimo.

**Se salta la rete** (in piscina succede): continua a segnare come se niente
fosse. In alto compare *«⏳ da mandare quando torna la rete»* e i punteggi
restano nel telefono; appena il segnale torna partono da soli e l'avviso
diventa *«✅ salvato nel database»*. Non chiudere il sito prima di aver visto
la spunta verde.

## Maschi e femmine nelle squadre

All'iscrizione la **categoria** è facoltativa («preferisco non dirlo»), ma se
c'è viene usata: ragazze e ragazzi si spartiscono fra le squadre come le fasce
d'età, mai più di uno di differenza.

Chi non l'ha detta la completi in un attimo: in `🚩 Squadre`, sopra la
procedura guidata, compare un riquadro giallo con i nomi che mancano e due
pulsanti a testa, **♀ Ragazza** e **♂ Ragazzo**. Un tocco e via, senza aprire
la scheda di nessuno. Quando non ne manca più nessuno il riquadro diventa
verde e dice quante sono e quanti sono.

- Se **nessuno** l'ha indicata, il criterio resta fuori: le squadre si fanno
  come prima, su età e capacità.
- Se l'hanno indicata **in parte**, chi manca viene comunque distribuito in
  modo da non finire tutto nella stessa squadra — ma alla cieca.
- Sotto ogni squadra compare il conto: *♀ 3 · ♂ 2*.
- Lasciarla in bianco non esclude nessuno da niente: serve solo a spartire.

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

## Chi fa cosa, e la guida da mandare ai collaboratori

In `🖨️ Stampe → 👥 Chi fa cosa il giorno della festa` c'è la divisione dei
ruoli, con i nomi modificabili. Cambi un nome e si riscrive tutto: la guida
stampata e il messaggio da mandare.

| | Chi | Cosa fa |
|---|---|---|
| 🎤 | **Gianpaolo** | Regia: microfono, cronometro, musica, punteggi |
| 🛟 | **Laura** | Arbitra la gara col materassino |
| 🤝 | **Simona** | Assiste la stessa gara: conta, tiene in riga, e dice a Gianpaolo chi ha vinto |
| ⚽ | **Lorenzo** | Arbitra l'altra gara, in parallelo |
| 🃏 | **Serena** | Assiste l'altra gara, e tiene i tavoli delle carte fra un turno e l'altro |

**Ogni gara ha due persone**: una arbitra e guarda solo la gara, l'altra conta,
tiene in ordine chi aspetta e porta il risultato a Gianpaolo. Se scoppia il
caos si è in due: una ferma tutto, l'altra rimette in fila.

**Accoglienza, materiale e raduno delle squadre non sono di nessuno**: c'è un
elenco di otto cose che fanno tutti, in cima alla guida, e la regola è sempre
la stessa — le fa chi in quel momento ha le mani libere.

Come mandarla: **🖨️ Stampa la guida intera** (un foglio da appendere),
**💬 Riassunto al gruppo** (chi fa cosa in una riga) e, sotto ogni nome,
**💬 Manda a…** con la sua scheda. La guida intera in un messaggio non ci sta:
WhatsApp la troncherebbe.

Il segnale è il braccio alzato dell'arbitro verso la squadra che ha vinto: è
l'unica cosa da concordare prima, e fa funzionare tutto il resto.

## Gare a scontri, quando l'attrezzatura non basta

Con quattro squadre e **due materassini** non si può far giocare tutti insieme
ai giochi che li usano. In `🏅 Punteggi` c'è l'interruttore **«Gioca a scontri
invece che tutti insieme»**: due squadre si sfidano al gioco col materassino,
le altre due a un gioco che non ne ha bisogno, e al turno dopo si scambiano.

Premi **🎲 Genera il calendario** e viene fuori tutto: turni, accoppiamenti,
chi gioca a cosa. Poi durante la festa **tocchi la squadra che ha vinto** —
niente da scrivere, con le mani bagnate — e prende i punti del primo, l'altra
quelli del secondo. La classifica generale si aggiorna sotto i tuoi occhi e
finisce in bacheca come sempre. Toccando di nuovo la stessa squadra si annulla.

Cosa fa da solo:

- **gli accoppiamenti** girano come in un girone all'italiana, così ogni
  squadra incontra tutte le altre;
- **il materassino** tocca a turno a chi l'ha usato di meno: in fondo alla
  pagina c'è il conto, squadra per squadra;
- se le squadre sono **dispari**, a ogni turno una riposa — e c'è scritto chi;
- con **due squadre sole** non serve nessun turno: le gare si mettono in fila
  nell'ordine del programma, una dopo l'altra.

Due cose restano fuori dal calendario, apposta:

- il **riscaldamento**, che non dà punti;
- la **finale**, che vale doppio: ridurla a due squadre mentre le altre
  guardano sarebbe il modo peggiore di chiudere la giornata. Si segna sotto il
  calendario, con l'ordine d'arrivo di tutte.

Quanti materassini avete si scrive in `🎯 Settaggio giochi acquatici → 🕓 Come
viene il pomeriggio`. E se un gioco vuole il materassino o no lo dici tu, dalla
sua scheda: la spunta *«Serve il materassino»*. Se un giorno ne comprate altri
due, cambi il numero e il calendario si rifà con due gare col materassino in
parallelo.

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
  parte la **sirena**: un ululato di due secondi e mezzo che sale e scende,
  ripetuto, con la vibrazione sul telefono. È fatta per coprire una piscina
  piena di ragazzi che urlano, quindi tienila al volume giusto e non farla
  partire con l'orecchio attaccato alla cassa. `🔕 Basta sirena` la zittisce
  sul colpo, e comunque smette da sola dopo un minuto.
- **A tempo scaduto la gara finisce lì**: se nessuna squadra ha già vinto,
  vince chi è avanti in quel momento. L'ordine d'arrivo lo scrivi tu subito
  sotto, nella stessa schermata.
- Il cronometro è **uno solo per tutti**: se lo fa partire Lorenzo dal suo
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

### La sigla e il jingle

In `🏅 Punteggi`, in cima, ci sono due lettori: **la sigla** dell'estate 2026 e
**il jingle** di apertura. Si premono e partono, senza cercare niente nel
telefono. I file stanno nel sito, dentro `audio/`.

- Per **cambiarli o aggiungerli** c'è il pulsante sotto ogni lettore: scegli il
  file dal telefono, sale nel sito da solo. Poi va premuto una volta
  `🌐 Pubblica contenuti.json`, se no il sito non sa che c'è.
- Il jingle è **predisposto ma vuoto**: appena lo generi, caricalo lì.
- Il testo della canzone e i prompt per Suno sono in `CANZONE.md`, dentro il
  progetto.

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

## Il token di GitHub, quando sparisce

Sta in `📣 Pubblica → 🔑 Collegamento a GitHub`, nel riquadro azzurro
**«Rifare il token al volo»**. Serve per pubblicare i contenuti e per caricare
foto e musica.

- **⚡ Fai un token nuovo** apre GitHub con nome e permesso già impostati: ti
  resta da scegliere la scadenza e premere *Generate token*. Poi copi la sigla
  che comincia con `ghp_` e la incolli nel campo qui sotto.
- **📋 Copia il token** copia quello già salvato in questo browser, per
  passarlo dal computer al telefono senza rigenerarlo. Se non c'è niente da
  copiare te lo dice, invece di non fare niente.
- Nel pieghevole c'è anche il **token «fine-grained»**: più prudente ma più
  scomodo dal telefono. Il primo vale per tutti i tuoi repository ma è
  immediato, il secondo vale solo per `certamen-aquaticum`. Per un sito di
  condominio il primo va benissimo.

**Perché dal telefono sparisce di continuo**: Safari e Chrome cancellano i dati
dei siti che non apri da qualche giorno. Il rimedio è aprire l'admin, fare
**Condividi → Aggiungi a Home** e usare da lì in poi quell'icona: il telefono lo
tratta come un'app e il token resta molto più a lungo.

Il token **non lascia mai il browser**: non finisce nel sito, non va nel
database, non lo vede nessun altro.

## L'album della giornata: foto e video

Scheda **`📷 Album`**, nel menù in cima alla pagina. Dal telefono premi **📸 Scatta una foto**: si apre
la fotocamera, scatti, e la foto compare nell'album del sito **subito**, senza
pubblicare niente. Con `🖼️ Scegli foto o video` ne mandi anche parecchie in
una volta, **e vanno anche i video**.

- I **video** si guardano nell'album come le foto, dentro la pagina, con i
  comandi di riproduzione. Se ne parte uno, gli altri si fermano da soli.
  Nell'elenco dell'admin l'anteprima è un fotogramma, così li riconosci al volo.
- Le foto si rimpiccioliscono da sole, **i video no**: il browser non sa
  comprimerli. Quindi tienili corti — il limite è **24 MB**, una ventina di
  secondi. Se ne carichi uno più pesante te lo dice subito, prima di far
  macinare il telefono per niente: apri il video sul telefono, **Modifica**,
  stringi le maniglie ai secondi che ti interessano, salva e ricaricalo.
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
  ti dirà che manca e ti porterà nel riquadro giusto. Vedi qui sotto.
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

## Le cose della fine

**🎓 I diplomi** — `🖨️ Stampe → Diplomi per i ragazzi`: un foglio A4 a testa, con
nome, squadra, posizione finale, le gare vinte dalla sua squadra e le menzioni
che ha preso lui. Si stampano tutti insieme dopo la premiazione. A quell'età il
pezzo di carta da appendere in camera vale più della coppa.

**📣 Il messaggio di chiusura** — `📣 Pubblica → Il messaggio di fine giornata`:
già scritto con la classifica vera, i premi assegnati, le menzioni e il link
all'album. Si manda al gruppo mentre ancora si smonta. `🔄 Rifallo con i dati di
adesso` lo riscrive se nel frattempo hai aggiunto qualcosa; se lo ritocchi a
mano resta come l'hai lasciato.

**📺 Il tabellone** — `tabellone.html`, o il pulsante nel cronometro. Una pagina
a schermo pieno per un tablet appoggiato al bordo: la gara in corso col tempo
che scorre, e sotto la classifica generale a caratteri grandi. Fondo scuro,
niente menù, si aggiorna da sola. Non si tocca: si guarda.

**🔊 La prova della sirena** — nel cronometro, sotto `Provare la sirena prima del
giorno`. Falla suonare dal dispositivo che userai davvero, con la cassa
collegata: il 15 agosto è tardi per scoprire che non si sente. Va già al
massimo che il dispositivo consente — se ti sembra piano, il volume da alzare
è quello del dispositivo, non c'è altro margine da questa parte.

## Provare tutto, e poi ricominciare da zero

Prima del 15 agosto conviene fare una prova generale: formare le squadre,
segnare qualche gara, generare un tabellone, guardare come vengono le
classifiche sul sito. Poi si azzera.

In `🖨️ Stampe → 🧹 Prova generale` ci sono due pulsanti:

| | Cosa cancella | Cosa resta |
|---|---|---|
| **🏁 Azzera punteggi e tabelloni** | risultati, menzioni, tabelloni, cronometro, calendario degli scontri | squadre, coppie, appello |
| **🧹 Azzera tutta la giornata** | tutto quanto sopra, più squadre, coppie, appello e assetto delle carte | — |

**Le iscrizioni non si toccano mai**, con nessuno dei due: nomi, recapiti e
codici restano tutti. Nemmeno i contenuti del sito vengono sfiorati — giochi,
orari, musica, foto, regole.

Tutti e due chiedono conferma dicendo esattamente quante squadre e quante gare
stanno per sparire, e tutti e due **ripuliscono anche la pagina pubblica**: se
no il sito resterebbe a mostrare i punteggi della prova.

Prima di azzerare, scarica la **copia di sicurezza** (è il riquadro subito
sotto): se cancelli per sbaglio, da lì rimetti tutto com'era.

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
