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

// ------------------------------------------------------------- telefono
// Il controllo e' invisibile e istantaneo: nessun codice da digitare, nessuna
// attesa. Non puo' dimostrare che il numero appartenga davvero a qualcuno,
// ma butta fuori tutto cio' che un numero italiano non puo' essere: refusi,
// lunghezze impossibili, prefissi inesistenti e i finti classici.
//
// Regola di fondo: meglio accettare un numero strano che rifiutare un
// cliente vero. Per questo i prefissi mobili non sono un elenco chiuso —
// AGCOM ne assegna di nuovi, e una lista congelata oggi rifiuterebbe domani
// una persona in carne e ossa.
function normalizzaTelefono(grezzo) {
  let t = String(grezzo).replace(/[^\d+]/g, "");
  t = t.replace(/^\+?0039/, "").replace(/^\+39/, "");
  return t.replace(/\D/g, "");
}

function sequenzaFinta(c) {
  if (/^(\d)\1+$/.test(c)) return true;              // 3333333333
  const su = "0123456789012345678901234567890";
  const giu = "9876543210987654321098765432109";
  const coda = c.slice(-7);
  return su.includes(coda) || giu.includes(coda);     // 3491234567, 3987654321
}

// Ritorna null se va bene, altrimenti il motivo del rifiuto.
export function problemaTelefono(grezzo) {
  const c = normalizzaTelefono(grezzo);
  if (!c) return "Serve un numero di telefono per confermarti l'ordine.";
  if (c.length < 6) return "Il numero e' troppo corto: controllalo.";
  if (c.length > 11) return "Il numero e' troppo lungo: scrivilo senza prefisso internazionale.";
  if (sequenzaFinta(c)) return "Questo numero non sembra reale: serve per confermarti l'ordine.";

  // cellulari: 3 seguito da 1-9, nove o dieci cifre in tutto
  if (c[0] === "3") {
    if (c[1] === "0") return "Non esiste un prefisso cellulare che inizia con 30.";
    if (c.length < 9 || c.length > 10) return "Un cellulare italiano ha 9 o 10 cifre.";
    return null;
  }

  // fissi: 0 piu' prefisso di zona, da sei a undici cifre
  if (c[0] === "0") {
    if (c.length < 6) return "Il numero fisso e' troppo corto: manca il prefisso di zona?";
    return null;
  }

  // 89x, 199x, 4xx: numeri a pagamento o di servizio, non si richiama nessuno
  return "Serve un numero di casa o di cellulare: su questo non possiamo richiamarti.";
}

function telefonoValido(t) {
  return problemaTelefono(t) === null;
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

const FASCE = () => [REGOLE.orari.pranzo, REGOLE.orari.cena];
const ORARI_A_VOCE = "Pranzo 11:30–15:00 (lun–sab), cena 18:30–22:00 (tutti i giorni).";

// chiusuraFino: data ISO (AAAA-MM-GG) fino a cui il locale resta chiuso.
// Arriva dalla variabile CHIUSURA_FINO del pannello Cloudflare: si cambia
// da li' senza ripubblicare il codice. Vuota o assente = nessuna chiusura.
// Questa e' l'unica chiusura che blocca anche i preordini: se siamo in ferie
// non ha senso accettare ordini nemmeno per domani.
export function verificaChiusuraFerie(adesso, chiusuraFino) {
  const fino = chiusuraFino === undefined ? REGOLE.chiusuraFino : chiusuraFino;
  if (fino && oraItaliana(adesso).data < fino) {
    errore("chiuso_ferie",
      "Siamo chiusi in questo periodo: l'ordine non può essere accettato adesso. " +
      "Chiamaci allo 031 300809 per sapere quando riapriamo.");
  }
  return true;
}

export function apertoAdesso(adesso) {
  const o = oraItaliana(adesso);
  return FASCE().some(f =>
    f.giorni.includes(o.giorno) && o.minuti >= inMinuti(f.apre) && o.minuti < inMinuti(f.chiude));
}

// Serve solo per gli ordini "prima possibile", che partono subito in cucina.
export function verificaApertura(adesso, chiusuraFino) {
  verificaChiusuraFerie(adesso, chiusuraFino);
  if (!apertoAdesso(adesso)) {
    errore("chiuso",
      "In questo momento la pizzeria è chiusa: puoi comunque preordinare, " +
      "basta che indichi l'orario di ritiro o consegna. " + ORARI_A_VOCE);
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


// Orario richiesto dal cliente. Vuoto o "prima possibile" = ordine immediato,
// che parte subito in cucina e quindi richiede il locale aperto.
//
// Un orario preciso e' invece un PREORDINE, sempre per la stessa giornata:
// il cliente ordina mentre siamo chiusi (di mattina, o nel pomeriggio fra
// pranzo e cena) per ritirare o farsi consegnare piu' tardi, quando siamo
// aperti. L'ora indicata deve percio' essere ancora davanti e cadere dentro
// una fascia di servizio di oggi. Senza questo controllo si potrebbe chiedere
// la consegna alle 3 di notte, o per un'ora gia' passata.
function verificaOrarioRichiesto(testo, adesso) {
  const t = String(testo || "").trim();
  if (!t) return { orario: "", fisso: false };
  if (/^(prima possibile|appena pronto|subito|asap)$/i.test(t)) return { orario: t, fisso: false };

  const m = t.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!m) {
    errore("orario_non_valido",
      "L'orario richiesto non e' leggibile: scrivi un orario tipo 20:00, oppure «prima possibile».");
  }
  const hhmm = `${m[1].padStart(2, "0")}:${m[2]}`;
  const richiesti = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const o = oraItaliana(adesso);

  if (richiesti < o.minuti) {
    errore("orario_passato",
      `Le ${hhmm} di oggi sono già passate: scegli un orario più avanti nella giornata. ${ORARI_A_VOCE}`);
  }
  const inServizio = FASCE().some(f =>
    f.giorni.includes(o.giorno) &&
    richiesti >= inMinuti(f.apre) && richiesti <= inMinuti(f.chiude));
  if (!inServizio) {
    errore("orario_fuori_servizio", `Alle ${hhmm} siamo chiusi. ${ORARI_A_VOCE}`);
  }
  return { orario: hhmm, fisso: true };
}

// --------------------------------------------------------------- cliente
export function verificaCliente(c, adesso) {
  if (!c || typeof c !== "object") errore("cliente_mancante", "Dati del cliente mancanti.");

  const nome = pulisci(c.nome, 80, "nome");
  if (nome.length < 2) errore("nome_non_valido", "Serve un nome per confermare l'ordine.");

  const telefono = pulisci(c.telefono, 30, "telefono");
  const guaioTel = problemaTelefono(telefono);
  if (guaioTel) errore("telefono_non_valido", guaioTel);

  const modalita = c.modalita === "domicilio" ? "domicilio" : "asporto";
  let indirizzo = "";
  if (modalita === "domicilio") {
    indirizzo = pulisci(c.indirizzo || "", 160, "indirizzo");
    if (indirizzo.length < 5) errore("indirizzo_mancante", "Per la consegna a domicilio serve un indirizzo completo.");
  }

  const quando = verificaOrarioRichiesto(pulisci(c.orario || "", 40, "orario"), adesso);

  return {
    nome, telefono, modalita, indirizzo,
    orario: quando.orario,
    // vero quando il cliente ha fissato un'ora precisa di oggi
    orarioFisso: quando.fisso,
    // vero quando quell'ordine e' arrivato a pizzeria chiusa: e' un preordine
    // per piu' tardi, non qualcosa da mandare in forno adesso
    preordine: quando.fisso && !apertoAdesso(adesso),
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
  verificaChiusuraFerie(adesso, chiusuraFino);
  const cliente = verificaCliente(corpo && corpo.cliente, adesso);
  // Un ordine senza orario parte subito in cucina: quello richiede il locale
  // aperto. Con un'ora precisa e' un preordine per piu' tardi nella stessa
  // giornata, gia' verificata dentro le fasce: si accetta anche da chiusi.
  if (!cliente.orarioFisso) verificaApertura(adesso, chiusuraFino);
  const righe = verificaRighe(corpo && corpo.righe);
  const totali = calcolaTotale(righe, cliente.modalita);
  return { cliente, righe, totali };
}
