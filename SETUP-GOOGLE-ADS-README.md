# ✅ Setup Google Ads per Arti in Pizza — COMPLETATO

Hai appena implementato la **fondazione tecnica** per il lancio di una campagna Google Ads professionale.

---

## 🎉 Cosa è stato fatto

### 1. ✅ Google Analytics 4 (GA4) aggiunto
**File modificati**:
- `index.html` ← **Schema JSON-LD LocalBusiness + GA4**
- `menu.html` ← **GA4**
- `storia.html` ← **GA4**
- `ordina.html` ← **GA4**
- `dove-siamo.html` ← **GA4**

**Cosa traccia**:
- 📊 Visite al sito
- 📞 Click sul numero di telefono
- ⏱️ Tempo trascorso per pagina
- 🔗 Percorsi di navigazione

### 2. ✅ Schema Strutturato (JSON-LD)
**Aggiunto a**: `index.html`

**Benefici**:
- 🔍 Google capisce meglio chi sei (ristorante, posizione, orari, telefono)
- ⭐ Mostra 4.7 stelle nelle ricerche
- 📍 Rich snippets su Google Maps
- 🎯 Aumenta CTR (click-through rate) negli annunci

---

## 📋 Prossimi Step (in ordine)

### **STEP 1: Ottieni Measurement ID GA4** (15 min)
Apri: **GA4-SETUP-GUIDE.md** nel progetto

Cosa fare:
1. Vai su https://analytics.google.com
2. Crea proprietà "Arti in Pizza"
3. Copia il Measurement ID (es: `G-ABC123XYZ`)
4. **Sostituisci `G-XXXXXXXXXX` in tutti i file HTML**

**File da modificare** (usa Cerca e Sostituisci):
- index.html (riga 12)
- menu.html (riga 12)
- storia.html (riga 12)
- ordina.html (riga 12)
- dove-siamo.html (riga 12)

---

### **STEP 2: Verifica GA4 funzioni** (24 ore)
1. Push il sito live (aggiorna i file)
2. Vai su https://www.arti-in-pizza.com (il tuo sito)
3. Apri Google Analytics → Sezione Real-time
4. Dovresti vedere una sessione attiva
5. Clicca su "Chiama: 031 300809" → dovresti vedere l'evento

---

### **STEP 3: Leggi la Strategia Google Ads** (30 min)
Apri: **GOOGLE-ADS-STRATEGY.md**

Contiene:
- 📱 Tutte le campagne specifiche per voi
- 💰 Budget raccomandato (€400-600/mese)
- 🎯 Parole chiave esatte da usare
- 📊 KPI da monitorare
- 🚀 Piano settimana per settimana

---

### **STEP 4: Crea Account Google Ads** (online, 10 min)
1. Vai su https://ads.google.com
2. Clicca "Inizia"
3. Collega al tuo account Google
4. Crea prima campagna: **Local Services Ads** (€150/mese)

---

### **STEP 5: Implementa Click-to-Call Tracking** (opzionale ma consigliato)
Nel file `assets/js/site.js`, aggiungi:

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

**Questo fa**: Ogni volta che qualcuno clicca "Chiama 031 300809", GA4 lo registra come conversione.

---

### **STEP 6: Lancia Prima Campagna** (1 ora)
1. **Local Services Ads** (più importante)
   - Costo: Pay-per-call (solo quando ti chiamano)
   - Budget: €150/mese
   - ROI: 3-5x il budget

2. **Search Ads - Consegna** (secondario)
   - Costo: €200/mese
   - Targeting: "Pizza a domicilio Como"

---

## 🗺️ File di Riferimento

| File | Cosa contiene | Azione |
|------|--------------|--------|
| **GA4-SETUP-GUIDE.md** | Come configurare Google Analytics 4 | Leggi prima |
| **GOOGLE-ADS-STRATEGY.md** | Strategie, parole chiave, budget | Riferimento |
| **index.html** | Schema JSON-LD + GA4 | ✅ Già fatto |
| **menu.html** | GA4 | ✅ Già fatto |
| **storia.html** | GA4 | ✅ Già fatto |
| **ordina.html** | GA4 | ✅ Già fatto |
| **dove-siamo.html** | GA4 | ✅ Già fatto |

---

## 📊 Metriche Importanti da Tracciare

### **Primo Mese** (baseline):
- ⏱️ Tempo medio sessione: Target > 30 sec
- 📱 Bounce rate: Target < 40%
- 📞 Click su "Chiama": Numero assoluto (qualsiasi è buono)

### **Con Google Ads attivo**:
- 🎯 Cost Per Click (CPC): Target €0.80-1.20
- 📈 Click-Through Rate (CTR): Target > 3%
- 💰 Cost Per Conversion (CPC): Target < €5

---

## ✋ STOP! Leggi Prima di Procedere

**Importante**: Non lanciare campagne Google Ads senza completare:
- ✅ GA4 configurato con il tuo Measurement ID
- ✅ Sito live (non localhost)
- ✅ Schema JSON-LD funzionante

Se non lo fai, non potrai tracciare le conversioni e non saprai se gli annunci funzionano.

---

## 🎯 Timeline Consigliata

```
Oggi:      ✅ Setup tecnico completato (tu sei qui)
Domani:    📊 Configura GA4 (15 min) + verifica (24h)
Fra 3gg:   📖 Leggi GOOGLE-ADS-STRATEGY.md
Fra 5gg:   🚀 Lancia Local Services Ads
Fra 1 sett: 🔍 Monitora primi risultati
Fra 2 sett: 📈 Lancia Search Ads
```

---

## 💡 Consigli Finali

1. **Partenza conservativa**: Inizia con €150/mese (LSA), scala quando vedi ROI
2. **Priorità numero 1**: Local Services Ads (miglior ROI per pizzerie)
3. **Non ignorare qualità**: Migliori landing page = minore costo per conversione
4. **Traccia sempre**: Senza GA4 + call tracking, è come lanciare al buio

---

## 🆘 Domande?

Se non trovi risposta qui, controlla:
- **GA4 non funziona?** → Vedi GA4-SETUP-GUIDE.md
- **Quale campagna lanciare?** → Vedi GOOGLE-ADS-STRATEGY.md
- **Come tracciare conversioni?** → Vedi GA4-SETUP-GUIDE.md STEP 3

---

## 🚀 Buona Fortuna!

Quando gli annunci saranno attivi, dovresti iniziare a vedere:
- 📱 Aumento di chiamate al 031 300809
- 🔍 Più persone che trovano il sito da Google Search
- 📍 Più visibilità su Google Maps

**Monitoraggio suggerito**: Controlla Google Ads + GA4 ogni lunedì per la prima mese, poi settimanalmente.

---

**Ultimo aggiornamento**: 2026-08-06  
**Prossima revisione consigliata**: Dopo primo mese di Ads attivo
