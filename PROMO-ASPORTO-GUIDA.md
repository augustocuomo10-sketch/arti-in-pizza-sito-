# Promo Asporto — Bibita + patatine (o birra) in omaggio

Guida operativa per far vivere la promo su **sito**, **Google Maps / Business Profile** e **Google Ads**.

---

## 1) Cosa è stato aggiunto al sito

- **Banda promo** in alto in [index.html](index.html) (sotto l'header, sopra l'hero). Rimanda a `promo-asporto.html`.
- **Landing page** dedicata: [promo-asporto.html](promo-asporto.html) — destinazione ideale degli annunci Google Ads.
- **Pagina animata** per registrare il video promo: [promo-video.html](promo-video.html) (formato 1080×1080, dura ~10 s).
- **Foto della promo** in [assets/img/promo/](assets/img/promo/) (1–4.webp).
- Stile della banda in [assets/css/styles.css](assets/css/styles.css) (in fondo, sezione "Banda promo asporto"). Versione asset (`?v=`) del CSS aggiornata a `202609191100` — se cambi il CSS ricordati di bumpare la stringa (vedi memoria `etichetta-versione-asset`).

Per fare andare online il tutto → commit + push su `main` (Cloudflare Pages rideploya). Verifica che la build **non sia errored**, altrimenti resta bloccata (memoria `pages-deploy-bloccato`).

---

## 2) Video per Google Maps / Business Profile

Google Business Profile accetta video **fino a 30 s**, max 100 MB, **720p+**. Formato consigliato: **quadrato (1080×1080) o verticale (1080×1920)**. `promo-video.html` è già a 1080×1080.

**Come registrarlo (Mac, senza software esterno):**

1. Apri `promo-video.html` in Safari/Chrome a schermo intero (⌃⌘F).
2. QuickTime Player → *File* → *Nuova registrazione schermo* → seleziona l'area della slide 1080×1080.
3. Registra ~12 s (l'animazione dura ~10 s + 2 s di margine) e ferma.
4. Esporta in .mp4 (H.264). Se il file supera 100 MB comprimilo con HandBrake preset "Fast 1080p30".

**Come caricarlo su Google Business Profile / Maps:**

1. Vai su [business.google.com](https://business.google.com) → seleziona **Arti in Pizza**.
2. Sezione *"Aggiungi foto"* → tab **Video** → carica il file .mp4.
3. Nella descrizione della scheda aggiungi: *"Ordinando in asporto dal sito artiinpizza.com hai bibita in lattina + patatine gratis (o birra in vetro). Scopri qui: https://artiinpizza.com/promo-asporto.html"*.
4. Crea anche un **Post → Novità** (o **Offerta**) con la stessa foto/video e link a `promo-asporto.html`.
5. Se hai un **Offer post**: imposta *"Valido dal … al …"* e come pulsante "Ordina online" → link `https://artiinpizza.com/menu.html`.

I video appaiono in Maps entro qualche ora (a volte 24 h).

---

## 3) Google Ads — Campagna consigliata

Obiettivo: **portare ordini in asporto dal sito** a chi cerca pizza a Como / dintorni.

### 3.1 Struttura

- **Tipo campagna**: *Ricerca* (Search) — non Performance Max.
- **Obiettivo**: *Vendite* → conversione **"acquisto"** (già impostata secondo [GA4-SETUP-GUIDE.md](GA4-SETUP-GUIDE.md) e [GOOGLE-ADS-STRATEGY.md](GOOGLE-ADS-STRATEGY.md)).
- **Budget iniziale**: 5–8 €/giorno per testare.
- **Strategia offerte**: iniziale *"Massimizza clic"* con **CPC max 0,40 €**; dopo ~30 conversioni passa a *Maximize Conversions* o *Target CPA* (obiettivo 3–5 €).

### 3.2 Targeting

- **Località**: raggio di **8 km** intorno a Via Carloni 12, Como (o città di Como + comuni contigui: Cernobbio, Tavernola, Ponte Chiasso, Grandate, Casnate, Lipomo, Albate). Escludi il resto d'Italia.
- **Presenza**: *"Persone che si trovano nella zona di destinazione"* (non "interesse").
- **Lingue**: italiano.
- **Dispositivi**: tutti, con **regolazione +20 % su mobile** (le persone cercano pizza dal telefono).
- **Orari**: attiva dalle **11:00 alle 14:00** e dalle **17:30 alle 22:30** (chiudi negli orari in cui non consegnate).

### 3.3 Gruppi di annunci

**Gruppo 1 — "Pizza asporto Como"** (parole chiave a corrispondenza a frase e ampia modificata):
- `"pizza asporto como"`
- `"pizza da asporto como"`
- `"pizzeria como asporto"`
- `"ordinare pizza como"`
- `"pizza a domicilio como"` (usata per intercettare anche chi vorrebbe la consegna ma può convertire in asporto vedendo l'omaggio)

**Gruppo 2 — "Promo pizza Como"**:
- `"promo pizza como"`
- `"pizza in omaggio como"`
- `"pizza economica como"`

**Parole chiave negative (obbligatorie)**: `gluten free`, `senza glutine`, `lavoro`, `assunzione`, `ricetta`, `impasto ricetta`, `franchising`, `attrezzatura`, `forno`, `just eat`, `deliveroo`, `glovo`, `uber eats`.

### 3.4 Annunci (Responsive Search Ad — RSA)

**URL finale**: `https://artiinpizza.com/promo-asporto.html`
**Percorsi display**: `artiinpizza.com/asporto/omaggio`

**Titoli (max 30 char ciascuno, minimo 8):**
1. `Pizza in asporto a Como`
2. `Bibita + patatine in omaggio`
3. `Ordina dal sito, ritira qui`
4. `Arti in Pizza · dal 1997`
5. `Prezzo migliore garantito`
6. `Birra in vetro in omaggio`
7. `Via Carloni 12, Como`
8. `Pizza napoletana, vera`
9. `Ordina online in 2 minuti`
10. `Nessuna commissione`

**Descrizioni (max 90 char, minimo 4):**
1. `In omaggio bibita + patatine, o birra in vetro. Solo ordini in asporto dal sito.`
2. `Ordina dal sito di Arti in Pizza, ritira in Via Carloni. Prezzi reali del locale.`
3. `Pizza napoletana a Como dal 1997. Scegli l'omaggio al checkout.`
4. `Nessuna commissione, nessuna app. Ordina in 2 minuti, ritira caldo.`

### 3.5 Estensioni (Asset)

- **Sitelink**:
  - `Menù completo` → `/menu.html`
  - `Come funziona la promo` → `/promo-asporto.html#main`
  - `Dove siamo` → `/dove-siamo.html`
  - `Chiama 031 300809` → `tel:031300809` (come *Call Extension*)
- **Callout**: `Bibita + patatine gratis`, `Birra in vetro gratis`, `Prezzo migliore`, `Dal 1997`, `Ritiro rapido`.
- **Snippet strutturati** — categoria *Servizi*: `Asporto`, `Consegna`, `Tavoli`.
- **Estensione Immagine**: carica le 4 foto in [assets/img/promo/](assets/img/promo/) (Google richiede JPG/PNG ≥ 314×314 quadrato — se serve, riesporta i `.webp` in `.jpg` con qualità 85).
- **Estensione Posizione**: collega il **Google Business Profile** già esistente (fondamentale — fa apparire l'indirizzo e la mappa nell'annuncio).
- **Estensione Promozione**: tipo *"Offerta speciale"*, valore `In omaggio bibita + patatine`, requisito d'ordine *"Solo asporto dal sito"*.

### 3.6 Conversioni

Il sito ha già il tracciamento pronto in [assets/js/tracking.js](assets/js/tracking.js) e la conversione **purchase** in GA4. In Google Ads:

1. *Strumenti → Conversioni* → verifica che la conversione **"acquisto asporto/consegna"** sia *Attiva* e *Primaria*.
2. Importa la conversione da GA4 se non è già collegata (*Strumenti → Account collegati → Google Analytics*).
3. Segui i controlli in [TRACCIAMENTO-STATO.md](TRACCIAMENTO-STATO.md) e [GA4-SETUP-GUIDE.md](GA4-SETUP-GUIDE.md).

### 3.7 Timeline consigliata

- **Giorno 0**: pubblica sito (banda promo + `promo-asporto.html`), verifica in produzione.
- **Giorno 0**: carica video su Business Profile + Post *Offerta*.
- **Giorno 1**: lancia campagna Search con budget 5 €/g, *Massimizza clic*.
- **Giorno 7**: controlla parole chiave con **≥ 20 clic e 0 conversioni** → mettile in negative.
- **Giorno 14–30**: se hai ≥ 30 conversioni, passa a *Target CPA* (obiettivo 3–5 €).
- **Giorno 30**: valuta se estendere a campagna **Performance Max locale** con lo stesso URL di destinazione.

---

## 4) Checklist rapida

- [ ] `git add . && git commit && git push` → controlla che Pages faccia il deploy senza errori
- [ ] Apri https://artiinpizza.com/ da mobile: banda promo visibile e cliccabile
- [ ] Apri https://artiinpizza.com/promo-asporto.html: gallery e CTA funzionanti
- [ ] Registra `promo-video.html` con QuickTime, esporta .mp4 < 100 MB
- [ ] Carica video + Post Offerta su Google Business Profile
- [ ] Crea campagna Search in Google Ads con struttura sopra
- [ ] Attiva estensione **Posizione** (collega Business Profile) e **Promozione**
- [ ] Verifica che la conversione *purchase* GA4 arrivi in Ads come "Primaria"
