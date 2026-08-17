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
//   TELEGRAM_CHAT     id della chat o del gruppo dove arrivano gli ordini

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
  righe.push(pagato ? "Già pagato online — non incassare." : "Da incassare alla consegna o al ritiro.");

  righe.push("");
  righe.push(`\u{1F464} ${pulito(o.cliente.nome)}`);
  righe.push(`\u{1F4DE} ${pulito(o.cliente.telefono)}`);
  if (o.cliente.orario) righe.push(`\u{1F551} ${pulito(o.cliente.orario)}`);
  if (o.cliente.note) righe.push(`\u{1F4DD} <i>${pulito(o.cliente.note)}</i>`);

  righe.push("");
  righe.push(`<code>${dati.riferimento}</code>`);

  return righe.join("\n");
}

// Non lancia mai: un avviso che fallisce non deve far perdere l'ordine,
// che a quel punto e' gia' verificato e archiviato. Ritorna solo l'esito.
export async function avvisaPizzeria(env, dati) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT) {
    return { inviato: false, motivo: "canale di avviso non configurato" };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT,
        text: componiMessaggio(dati),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { inviato: false, motivo: `Telegram ha risposto ${r.status}: ${t.slice(0, 120)}` };
    }
    return { inviato: true };
  } catch (e) {
    return { inviato: false, motivo: String(e).slice(0, 120) };
  }
}
