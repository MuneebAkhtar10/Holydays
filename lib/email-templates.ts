export function esc(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAVY = "#102948";
const GOLD = "#c5a46a";
const GOLD_DARK = "#8a6c32";
const INK_SOFT = "#4a5a70";
const LINE = "#e8dfcc";
const CREAM = "#f6f0e4";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK_SOFT}">${esc(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

export function button(href: string, label: string, kind: "primary" | "outline" = "primary") {
  const style =
    kind === "primary"
      ? `background:${GOLD};color:${NAVY};border:1px solid ${GOLD}`
      : `background:#ffffff;color:${NAVY};border:1px solid ${LINE}`;
  return `<a href="${esc(href)}" style="display:inline-block;${style};text-decoration:none;padding:12px 22px;border-radius:10px;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:.01em">${esc(label)}</a>`;
}

export function badge(text: string, tone: "green" | "gold" | "red" | "navy" = "green") {
  const tones = {
    green: ["#e6f4ea", "#1e6b3a"],
    gold: ["#f8efd9", GOLD_DARK],
    red: ["#fdeaea", "#a12626"],
    navy: ["#e7ecf4", NAVY],
  } as const;
  const [bg, fg] = tones[tone];
  return `<span style="display:inline-block;background:${bg};color:${fg};font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:5px 10px;border-radius:999px">${esc(text)}</span>`;
}

export function sectionTitle(text: string) {
  return `<p style="margin:26px 0 10px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${GOLD_DARK}">${esc(text)}</p>`;
}

/** Two-column label / value rows inside a soft card. */
export function detailCard(rows: [string, string][]) {
  const body = rows
    .filter(([, v]) => v && v !== "—")
    .map(
      ([label, value], i, all) => `<tr>
        <td style="padding:10px 0;${i < all.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font-family:${SANS};font-size:13px;color:#7a8799;width:38%;vertical-align:top">${esc(label)}</td>
        <td style="padding:10px 0;${i < all.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}font-family:${SANS};font-size:14px;color:${NAVY};font-weight:600;vertical-align:top">${esc(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;padding:6px 18px;border-collapse:separate"><tbody>${body}</tbody></table>`;
}

export type MailLine = { label: string; amount?: string; note?: string; indent?: boolean; strong?: boolean };

/** Itemised invoice rows. Amounts must already be formatted. */
export function lineTable(lines: MailLine[]) {
  const body = lines
    .map(
      (l) => `<tr>
        <td style="padding:${l.indent ? "4px 0 4px 16px" : "9px 0"};font-family:${SANS};font-size:${l.indent ? "13px" : "14px"};color:${l.indent ? "#6b7a8f" : NAVY};font-weight:${l.strong ? 700 : l.indent ? 400 : 600};line-height:1.45;${l.indent ? "" : `border-top:1px solid ${LINE};`}">${esc(l.label)}${l.note ? `<br><span style="font-weight:400;font-size:12px;color:#8a97a8">${esc(l.note)}</span>` : ""}</td>
        <td align="right" style="padding:${l.indent ? "4px 0" : "9px 0"};font-family:${SANS};font-size:${l.indent ? "13px" : "14px"};color:${l.indent ? "#6b7a8f" : NAVY};font-weight:${l.strong ? 700 : l.indent ? 400 : 600};white-space:nowrap;vertical-align:top;${l.indent ? "" : `border-top:1px solid ${LINE};`}">${l.amount ? esc(l.amount) : ""}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tbody>${body}</tbody></table>`;
}

export function totalBar(label: string, amount: string, note?: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${NAVY};border-radius:12px"><tbody><tr>
    <td style="padding:16px 20px;font-family:${SANS}">
      <span style="display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${GOLD}">${esc(label)}</span>
      ${note ? `<span style="display:block;margin-top:4px;font-size:12px;color:#b9c4d6">${esc(note)}</span>` : ""}
    </td>
    <td align="right" style="padding:16px 20px;font-family:${SERIF};font-size:24px;color:#ffffff;white-space:nowrap">${esc(amount)}</td>
  </tr></tbody></table>`;
}

export function checklist(items: string[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody>${items
    .map(
      (item) => `<tr>
      <td width="26" valign="top" style="padding:6px 0;font-family:${SANS};font-size:14px;color:${GOLD_DARK};font-weight:700">&#10003;</td>
      <td style="padding:6px 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${INK_SOFT}">${esc(item)}</td>
    </tr>`,
    )
    .join("")}</tbody></table>`;
}

export function emailShell(input: {
  preheader?: string;
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  origin?: string;
}) {
  const origin = input.origin || process.env.NEXTAUTH_URL || "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)}</title></head>
<body style="margin:0;padding:0;background:#efe8d9">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(input.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe8d9"><tbody><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tbody>
    <tr><td style="background:${NAVY};border-radius:18px 18px 0 0;padding:22px 32px">
      <span style="font-family:${SERIF};font-size:22px;letter-spacing:.32em;color:${GOLD}">HOLYDAYS</span>
    </td></tr>
    <tr><td style="background:#ffffff;padding:34px 32px 30px;border-left:1px solid ${LINE};border-right:1px solid ${LINE}">
      ${input.eyebrow ? `<p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${GOLD_DARK}">${esc(input.eyebrow)}</p>` : ""}
      <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:28px;line-height:1.25;font-weight:normal;color:${NAVY}">${esc(input.title)}</h1>
      ${input.bodyHtml}
    </td></tr>
    <tr><td style="background:${CREAM};border:1px solid ${LINE};border-top:0;border-radius:0 0 18px 18px;padding:20px 32px">
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:#7a8799">
        You are receiving this email because of activity on your HolyDays account.
        Need help? Reply to this email or open your booking${origin ? ` at <a href="${esc(origin)}" style="color:${GOLD_DARK}">${esc(origin.replace(/^https?:\/\//, ""))}</a>` : ""}.
      </p>
      <p style="margin:8px 0 0;font-family:${SANS};font-size:11px;color:#9aa6b5">Hotels, Ziyarat, and taxis for Saudi Arabia, Iraq, and Iran.</p>
    </td></tr>
  </tbody></table>
</td></tr></tbody></table>
</body></html>`;
}
