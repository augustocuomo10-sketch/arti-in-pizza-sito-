# 📊 Guida Setup GA4 + Google Ads Tracking

## STEP 1: Ottieni il tuo Measurement ID

1. Vai su **https://analytics.google.com**
2. Clicca **"Inizia"** (o accedi al tuo account Google)
3. Crea una nuova proprietà:
   - Nome: "Arti in Pizza"
   - Timezone: "Europe/Rome"
   - Valuta: "EUR"
4. Seleziona **"Web"** come piattaforma
5. Immetti:
   - Nome stream: "arti-in-pizza.com"
   - URL sito: `https://www.arti-in-pizza.com` (sostituisci con il tuo dominio reale)
6. **Copia il Measurement ID** — sarà qualcosa come `G-XXXXXXXXXX`

---

## STEP 2: Sostituisci il Measurement ID nel sito

Nei file HTML, cerca `G-XXXXXXXXXX` e sostituisci con il tuo ID reale:

### Elenco file da aggiornare:
- ✅ `index.html` (riga ~11)
- ✅ `menu.html` (riga ~11)
- ✅ `storia.html` (riga ~11)
- ✅ `ordina.html` (riga ~11)
- ✅ `dove-siamo.html` (riga ~11)

**Esempio:** Se il tuo ID è `G-ABC123XYZ`, sostituisci:
```javascript
// DA:
gtag('config', 'G-XXXXXXXXXX'

// A:
gtag('config', 'G-ABC123XYZ'
```

---

## STEP 3: Configura Conversioni per "Chiama"

Quando qualcuno clicca sul numero di telefono (tel:0313000809), deve tracciarlo come conversione.

### Opzione A: Click-to-Call Tracking (consigliato)
Aggiungi questo JavaScript nel file `assets/js/site.js`:

```javascript
// Traccia click su link telefonici
document.querySelectorAll('a[href^="tel:"]').forEach(link => {
  link.addEventListener('click', function() {
    gtag('event', 'phone_call_click', {
      'phone_number': this.getAttribute('href'),
      'page_title': document.title
    });
  });
});
```

### Opzione B: Numero di tracciamento (ancora migliore)
Se usi un servizio come Callrail, Fonmix o Invoca:
1. Crea un numero virtuale (es. +39 031 300 800)
2. Configura il forwarding al tuo numero reale (031 300809)
3. Aggiorna il sito per mostrare il numero virtuale
4. Traccia tutte le chiamate automaticamente

Consigliato per budget > €500/mese.

---

## STEP 4: Verifica che GA4 funzioni

1. Vai su `https://www.arti-in-pizza.com` (il tuo sito live)
2. Apri Google Analytics
3. Sezione **Real-time** → dovresti vedere una sessione attiva
4. Clicca su "Chiama: 031 300809" → vedrai l'evento `phone_call_click`

Se non vedi nulla dopo 24 ore, controlla:
- Il Measurement ID è corretto?
- Il tag <script> GA4 è nel <head>?
- Il sito è live (non localhost)?

---

## STEP 5: Collega GA4 a Google Ads

1. Vai su **Google Ads** → Impostazioni → Proprietà collegata
2. Seleziona la proprietà GA4 che hai creato
3. Abilita **Conversioni automatiche** per:
   - Visite di 10+ secondi
   - Pagine visitate ≥ 2
   - Click esterno (es. Just Eat, Deliveroo)

---

## 🎯 Metriche da monitorare

**In GA4, guarda questi rapporti:**

- **Utenti**: Quanti visitano il sito
- **Coinvolgimento**: Tempo medio sul sito (target: > 30 sec)
- **Conversioni**: Quanti cliccano su "Chiama"
- **Fonti di traffico**: Dove vengono i visitatori (ricerca organica, Google Ads, Maps, social, etc.)

**In Google Ads, traccia:**
- **Call-through rate**: % di chi clicca e poi chiama
- **Cost per conversion**: Quanto spendi per ogni chiamata tracciata
- **Quality score**: Deve essere ≥ 5/10

---

## 📞 Alternativa: Call Tracking Professionale

Se il budget lo consente (€100-300/mese), usa:

### Fonmix (italiano, consigliato)
- Numero virtuale dedicato
- Registra tutte le chiamate
- Integrazione Google Ads nativa
- Dashboard dettagliato

### Callrail (internazionale)
- Più robusto per aziende grandi
- Tracciamento multi-canale
- Costo: €40-100/mese

---

## ✅ Checklist Finale

- [ ] Measurement ID GA4 creato
- [ ] Sostituito `G-XXXXXXXXXX` in tutti i file
- [ ] Sito aggiornato (push live)
- [ ] GA4 Real-time attivo dopo 24h
- [ ] Click-to-call tracking configurato
- [ ] Google Ads collegato a GA4
- [ ] (Opzionale) Numero di tracciamento attivato

---

Una volta completato, potrai lanciare Google Ads con tracking accurato! 🚀
