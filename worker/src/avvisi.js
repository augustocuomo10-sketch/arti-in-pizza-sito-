// Avviso alla pizzeria: un ordine entra, il telefono suona.
//
// Perche' Telegram e non WhatsApp: per mandare un messaggio WhatsApp da un
// server serve l'API ufficiale, con verifica Meta, modelli approvati e una
// SIM che non puo' essere la stessa usata nell'app. Telegram fa la stessa
// cosa in dieci minuti, gratis. Il giorno in cui WhatsApp sara' pronto,
// cambia solo questa funzione: il resto del sistema non se ne accorge.
//
// Segreti attesi (pannello Cloudflare):
//   TELEGRAM_TOKEN    token del bot, da @BotFather
//   TELEGRAM_CHAT     una o piu' destinazioni separate da virgola: puo' essere
//                     un gruppo (id negativo), una persona, o un misto.
//                     Es. "-1001234567890,987654321"

const euro = (n) => n.toFixed(2).replace(".", ",") + " €";

// Telegram interpreta alcuni caratteri come formattazione: qui li neutralizziamo
// perche' un cliente che si chiama "D'Angelo *Marco*" non deve rompere il messaggio.
function pulito(s) {
  return String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

export function componiMessaggio(dati) {
  const o = dati.ordine;
  const pagato = dati.stato === "pagato";
  const righe = [];

  righe.push(pagato ? "✅ <b>ORDINE PAGATO</b>" : "\u{1F4B5} <b>NUOVO ORDINE — da incassare</b>");
  righe.push("");

  o.righe.forEach((r) => {
    righe.push(`• ${r.qta}× <b>${pulito(r.nome)}</b>` +
      (r.formato !== "unico" ? ` (${pulito(r.formato)})` : "") +
      (r.integrale ? " [integrale]" : "") +
      ` — ${euro(r.totale)}`);
  });

  righe.push("");
  righe.push(o.cliente.modalita === "domicilio" ? "\u{1F6F5} <b>CONSEGNA A DOMICILIO</b>" : "\u{1F95F} <b>RITIRO IN PIZZERIA</b>");
  if (o.cliente.modalita === "domicilio") {
    righe.push(`\u{1F4CD} ${pulito(o.cliente.indirizzo)}`);
    if (o.zona && o.zona.minuti !== null && o.zona.minuti !== undefined) {
      righe.push(`   circa ${o.zona.minuti} min di guida`);
    }
  }

  righe.push("");
  righe.push(`<b>Totale: ${euro(o.totali.totale)}</b>` +
    (o.totali.consegna ? `  (${euro(o.totali.piatti)} + ${euro(o.totali.consegna)} consegna)` : ""));
  righe.push(pagato ? "Già pagato online — non incassare." : "Da incassare IN CONTANTI alla consegna o al ritiro.");

  righe.push("");
  righe.push(`\u{1F464} ${pulito(o.cliente.nome)}`);
  righe.push(`\u{1F4DE} ${pulito(o.cliente.telefono)}`);
  if (o.cliente.orario) {
    righe.push(o.cliente.preordine
      ? `\u{1F551} <b>PREORDINE per le ${pulito(o.cliente.orario)}</b>`
      : `\u{1F551} ${pulito(o.cliente.orario)}`);
  }
  if (o.cliente.note) righe.push(`\u{1F4DD} <i>${pulito(o.cliente.note)}</i>`);

  righe.push("");
  righe.push(`<code>${dati.riferimento}</code>`);

  return righe.join("\n");
}

async function invia(token, destinazione, testo) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: destinazione,
        text: testo,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    if (r.ok) return { destinazione, ok: true };
    const t = await r.text().catch(() => "");
    return { destinazione, ok: false, motivo: `${r.status} ${t.slice(0, 100)}` };
  } catch (e) {
    return { destinazione, ok: false, motivo: String(e).slice(0, 100) };
  }
}

// Non lancia mai: un avviso che fallisce non deve far perdere l'ordine,
// che a quel punto e' gia' verificato e archiviato.
//
// Le destinazioni sono indipendenti: se il telefono di uno e' spento o ha
// bloccato il bot, gli altri ricevono lo stesso. Basta che ne arrivi uno
// perche' l'ordine si consideri annunciato.
export async function avvisaPizzeria(env, dati) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT) {
    return { inviato: false, motivo: "canale di avviso non configurato" };
  }

  const destinazioni = String(env.TELEGRAM_CHAT)
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!destinazioni.length) {
    return { inviato: false, motivo: "nessuna destinazione indicata" };
  }

  const testo = componiMessaggio(dati);
  const esiti = await Promise.all(destinazioni.map((d) => invia(env.TELEGRAM_TOKEN, d, testo)));
  const riusciti = esiti.filter((e) => e.ok);
  const falliti = esiti.filter((e) => !e.ok);

  return {
    inviato: riusciti.length > 0,
    consegnatiA: riusciti.length,
    totale: destinazioni.length,
    // i fallimenti si registrano: se un destinatario smette di ricevere,
    // deve essere possibile accorgersene senza indovinare.
    falliti: falliti.length ? falliti : undefined,
    motivo: riusciti.length ? undefined : (falliti[0] && falliti[0].motivo)
  };
}
