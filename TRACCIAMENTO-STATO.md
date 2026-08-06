# Stato del tracciamento — aggiornato 6 agosto 2026

Questo file sostituisce di fatto le parti operative di `GA4-SETUP-GUIDE.md`, che
descriveva una configurazione mai implementata nel codice.

## Cosa era rotto (verificato sul codice, non ipotizzato)

| Problema | Evidenza |
|---|---|
| GA4 non tracciava nulla | `G-XXXXXXXXXX` (segnaposto) in tutte e 5 le pagine IT |
| Pagine EN senza analytics | 0 occorrenze di `gtag` e `googletagmanager` in `en/*.html` |
| Click-to-call non implementato | 0 occorrenze di `gtag('event'` in tutto il progetto |
| Numero di telefono incoerente | 20 occorrenze di `031 300809` (testo + schema) vs 24 di `tel:0313000809` |

L'ultimo era il piu' grave: i pulsanti "Chiama" componevano un numero diverso da
quello pubblicato.

## Cosa e' stato fatto

**1. Numero unificato** — tutti i 24 link ora usano `tel:+39031300809`
(formato internazionale, il piu' affidabile su iOS e Android). Testo visibile e
schema JSON-LD invariati: `031 300809`.

**2. Tracciamento centralizzato** — nuovo file `assets/js/tracking.js`, caricato
in `<head>` su tutte e 10 le pagine (IT + EN). Il blocco GA4 inline che era
duplicato in 5 pagine e' stato rimosso: gli ID ora vivono in un solo posto.

Eventi tracciati:

| Evento | Quando | Conversione Google Ads |
|---|---|---|
| `phone_call_click` | click su qualsiasi pulsante Chiama | Si' — Click-to-call (1) |
| `get_directions` | click sul link Google Maps | No (vedi sotto) |
| `view_menu` | click verso il menu | No, solo segnale GA4 |

**3. Google Ads** — nell'account 111-558-0274:

- Tag Google creato: `AW-17357543372`
- Azione di conversione **"Chiamate dagli annunci"** (primaria) — funziona senza
  sito, misura le chiamate fatte direttamente dall'annuncio
- Azione di conversione **"Click-to-call (1)"** (primaria) — label
  `laiLCOHk-9wcEMyv3NRA`, gia' cablata in `tracking.js`

Non e' stata creata un'azione per le indicazioni stradali: in account ne
esistono gia' 3 e una quarta avrebbe prodotto doppio conteggio.

## Cosa resta da fare

**1. Mettere il sito online.** Al momento `https://www.arti-in-pizza.com` non
risponde. Finche' non e' raggiungibile:
- il tag Google non puo' essere verificato da Google Ads
- una campagna Search verrebbe rifiutata (URL finale non valido)

**2. Creare la proprieta' GA4** e incollare il Measurement ID in
`assets/js/tracking.js` (variabile `GA4_ID`). Senza, Google Ads misura comunque
le conversioni: si perde solo l'analisi del comportamento sul sito.

**3. Consent Mode.** Il traffico e' italiano, quindi SEE. Google Ads segnala che
serve la modalita' di consenso per non perdere dati di misurazione. Da valutare
insieme a un banner cookie.

**4. Campagna Search.** Pronta da creare appena il sito e' live. Budget
concordato: 5 €/giorno, ottimizzata su chiamate e visite.

## Sicurezza — da sistemare subito

Il file `.git/config` contiene il **token GitHub in chiaro** dentro l'URL del
remote. Chiunque abbia accesso alla cartella puo' usarlo per scrivere sul repo.

Da fare:
1. Revocare il token su GitHub (Settings > Developer settings > Personal access tokens)
2. Sostituire il remote con la forma pulita:
   `git remote set-url origin https://github.com/augustocuomo10-sketch/arti-in-pizza-sito-.git`
3. Autenticarsi con il credential helper di sistema (`git config --global credential.helper osxkeychain`)

## Come verificare che funzioni, una volta online

1. Apri il sito con `?gtm_debug=1` oppure attiva `DEBUG: true` in `tracking.js`
2. Clicca un pulsante "Chiama" — in console deve comparire `[tracking] phone_call_click`
3. In Google Ads: Obiettivi > Conversioni > "Click-to-call (1)" deve passare da
   "Non verificata" ad attiva entro 24-48 ore dal primo click reale
