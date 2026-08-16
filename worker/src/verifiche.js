// Condizioni di verifica dell'ordine.
// Regola non negoziabile: nulla di quello che arriva dal browser e' attendibile.
// I prezzi si ricalcolano SEMPRE dal catalogo del server.

import { CATALOGO, REGOLE } from "./catalogo.js";

export class ErroreVerifica extends Error {
  constructor(codice, messaggio) {
    super(messaggio);
    this.codice = codice;
  }
}

const errore = (c, m) => { throw new ErroreVerifica(c, m); };

// ------------------------------------------------------------------ testo
function pulisci(v, max, campo) {
  if (typeof v !== "string") errore("campo_non_valido", `${campo}: atteso testo`);
  // via i caratteri di controllo, che servono solo a rompere il messaggio WhatsApp
  const t = v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
  return t;
}

function telefonoValido(t) {
  const cifre = t.replace(/[^\d]/g, "");
  return cifre.length >= 8 && cifre.length <= 15;
}

// --------------------------------------------------------------- apertura
// Orari italiani indipendenti dal fuso del server (i Worker girano in UTC).
function oraItaliana(adesso = new Date()) {
  const f = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  const p = Object.fromEntries(f.formatToParts(adesso).map(x => [x.type, x.value]));
  const giorni = { dom: 0, lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6 };
  const sigla = String(p.weekday).toLowerCase().slice(0, 3);
  return {
    giorno: giorni[sigla],
    minuti: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10),
    data: `${p.year}-${p.month}-${p.day}`
  };
}

const inMinuti = (hhmm) => {
  const [h, m] = hhmm.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};

// chiusuraFino: data ISO (AAAA-MM-GG) fino a cui il locale resta chiuso.
// Arriva dalla variabile CHIUSURA_FINO del pannello Cloudflare: si cambia
// da li' senza ripubblicare il codice. Vuota o assente = nessuna chiusura.
export function verificaApertura(adesso, chiusuraFino) {
  const o = oraItaliana(adesso);
  const fino = chiusuraFino === undefined ? REGOLE.chiusuraFino : chiusuraFino;
  if (fino && o.data < fino) {
    errore("chiuso_ferie",
      "Siamo chiusi in questo periodo: l'ordine non può essere accettato adesso. " +
      "Chiamaci allo 031 300809 per sapere quando riapriamo.");
  }
  const fasce = [REGOLE.orari.pranzo, REGOLE.orari.cena];
  const aperto = fasce.some(f =>
    f.giorni.includes(o.giorno) && o.minuti >= inMinuti(f.apre) && o.minuti < inMinuti(f.chiude));
  if (!aperto) {
    errore("chiuso",
      "In questo momento la pizzeria è chiusa. Pranzo 11:30–15:00 (lun–sab), cena 18:30–22:00 (tutti i giorni).");
  }
  return true;
}

// ---------------------------------------------------------------- righe
// Ritorna righe ricalcolate dal catalogo, ignorando i prezzi del client.
export function verificaRighe(righe) {
  if (!Array.isArray(righe) || righe.length === 0) {
    errore("carrello_vuoto", "Il carrello è vuoto.");
  }
  if (righe.length > REGOLE.maxPezziTotali) {
    errore("troppe_righe", "Troppe voci nell'ordine: chiamaci al 031 300809, lo prendiamo a voce.");
  }

  let pezzi = 0;
  const verificate = righe.map((r, i) => {
    const piatto = CATALOGO[r && r.id];
    if (!piatto) errore("piatto_inesistente", `Voce ${i + 1}: piatto non presente nel menù.`);

    const formato = typeof r.formato === "string" ? r.formato : "";
    if (!(formato in piatto.prezzi)) {
      errore("formato_inesistente", `${piatto.nome}: formato non disponibile.`);
    }

    const qta = Number(r.qta);
    if (!Number.isInteger(qta) || qta < 1 || qta > REGOLE.maxQtaPerRiga) {
      errore("quantita_non_valida", `${piatto.nome}: quantità non valida (1–${REGOLE.maxQtaPerRiga}).`);
    }

    // L'integrale vale solo dove ha senso: pizze e calzoni.
    const integrale = r.integrale === true;
    if (integrale && !["classiche", "calzoni"].includes(piatto.categoria)) {
      errore("integrale_non_ammesso", `${piatto.nome}: la variante integrale non è prevista.`);
    }

    pezzi += qta;
    // il prezzo viene dal catalogo del server, mai dalla richiesta
    const unitario = piatto.prezzi[formato] + (integrale ? REGOLE.integraleSupplemento : 0);
    return {
      id: r.id, nome: piatto.nome, formato, integrale, qta,
      unitario: arrotonda(unitario),
      totale: arrotonda(unitario * qta)
    };
  });

  if (pezzi > REGOLE.maxPezziTotali) {
    errore("troppi_pezzi", `Massimo ${REGOLE.maxPezziTotali} pezzi per ordine online.`);
  }
  return verificate;
}

const arrotonda = (n) => Math.round(n * 100) / 100;


// Orario richiesto dal cliente: vuoto o "prima possibile" vanno bene,
// altrimenti deve essere un orario reale e dentro una fascia di servizio.
// Senza questo controllo si potrebbe chiedere la consegna alle 3 di notte.
function verificaOrarioRichiesto(testo, adesso) {
  const t = String(testo || "").trim();
  if (!t) return "";
  if (/^(prima possibile|appena pronto|subito|asap)$/i.test(t)) return t;

  const m = t.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!m) {
    errore("orario_non_valido",
      "L'orario richiesto non e' leggibile: scrivi un orario tipo 20:00, oppure «prima possibile».");
  }
  const richiesti = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const giorno = oraItaliana(adesso).giorno;
  const fasce = [REGOLE.orari.pranzo, REGOLE.orari.cena];
  const dentro = fasce.some(f =>
    f.giorni.includes(giorno) && richiesti >= inMinuti(f.apre) && richiesti <= inMinuti(f.chiude));
  if (!dentro) {
    errore("orario_fuori_servizio",
      `Alle ${t} siamo chiusi. Pranzo 11:30-15:00 (lun-sab), cena 18:30-22:00 (tutti i giorni).`);
  }
  return t;
}

// --------------------------------------------------------------- cliente
export function verificaCliente(c, adesso) {
  if (!c || typeof c !== "object") errore("cliente_mancante", "Dati del cliente mancanti.");

  const nome = pulisci(c.nome, 80, "nome");
  if (nome.length < 2) errore("nome_non_valido", "Serve un nome per confermare l'ordine.");

  const telefono = pulisci(c.telefono, 30, "telefono");
  if (!telefonoValido(telefono)) {
    errore("telefono_non_valido", "Il numero di telefono non sembra valido: serve per confermarti l'ordine.");
  }

  const modalita = c.modalita === "domicilio" ? "domicilio" : "asporto";
  let indirizzo = "";
  if (modalita === "domicilio") {
    indirizzo = pulisci(c.indirizzo || "", 160, "indirizzo");
    if (indirizzo.length < 5) errore("indirizzo_mancante", "Per la consegna a domicilio serve un indirizzo completo.");
  }

  return {
    nome, telefono, modalita, indirizzo,
    orario: verificaOrarioRichiesto(pulisci(c.orario || "", 40, "orario"), adesso),
    note: pulisci(c.note || "", 400, "note")
  };
}

// ---------------------------------------------------------------- totali
export function calcolaTotale(righe, modalita) {
  const piatti = arrotonda(righe.reduce((s, r) => s + r.totale, 0));
  const consegna = modalita === "domicilio" ? REGOLE.consegnaSupplemento : 0;
  const totale = arrotonda(piatti + consegna);

  if (totale <= 0) errore("totale_non_valido", "Totale dell'ordine non valido.");
  if (totale > REGOLE.maxTotaleEuro) {
    errore("totale_troppo_alto",
      `Per ordini oltre ${REGOLE.maxTotaleEuro} € chiamaci allo 031 300809: li gestiamo a voce.`);
  }
  if (modalita === "domicilio" && piatti < REGOLE.minTotaleDomicilio) {
    errore("sotto_minimo", `Ordine minimo per la consegna: ${REGOLE.minTotaleDomicilio} €.`);
  }
  return { piatti, consegna, totale };
}

// Verifica completa. Ritorna l'ordine ricalcolato e attendibile.
export function verificaOrdine(corpo, adesso, chiusuraFino) {
  verificaApertura(adesso, chiusuraFino);
  const cliente = verificaCliente(corpo && corpo.cliente, adesso);
  const righe = verificaRighe(corpo && corpo.righe);
  const totali = calcolaTotale(righe, cliente.modalita);
  return { cliente, righe, totali };
}
