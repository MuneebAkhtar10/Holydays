import * as net from "node:net";
import * as tls from "node:tls";

type Mail = { to: string; subject: string; text: string; html?: string };

const fromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || "HolyDays <noreply@holydays.app>";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

function isEmail(to: string) {
  return to.includes("@") && !to.startsWith("whatsapp:");
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(inner: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4eee4;padding:28px;font-family:Georgia,Times,serif;color:#102948">
  <div style="max-width:560px;margin:0 auto;background:#fffdf8;border-radius:20px;padding:28px 28px 32px;border:1px solid #e6dcc8">
    <p style="margin:0 0 8px;letter-spacing:.22em;font-size:11px;color:#b08d52">HOLYDAYS</p>
    ${inner}
  </div>
</body></html>`;
}

export function mailHtml(title: string, body: string, href?: string, cta?: string) {
  const button = href
    ? `<p style="margin:24px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#c5a46a;color:#102948;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">${esc(cta || "Open booking")}</a></p>`
    : "";
  return wrapHtml(
    `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2">${esc(title)}</h1>
     <p style="margin:0;font-size:16px;line-height:1.55;color:#3d4d63;white-space:pre-wrap">${esc(body)}</p>${button}`,
  );
}

async function sendResend(mail: Mail, from: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html || wrapHtml(`<p style="white-space:pre-wrap">${esc(mail.text)}</p>`),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Resend ${res.status}`);
  }
}

async function smtpWrite(socket: net.Socket, line: string) {
  await new Promise<void>((resolve, reject) => {
    socket.write(line.endsWith("\r\n") ? line : `${line}\r\n`, (err) => (err ? reject(err) : resolve()));
  });
}

async function smtpRead(socket: net.Socket) {
  return new Promise<string>((resolve, reject) => {
    const onData = (buf: Buffer) => {
      socket.off("error", onErr);
      resolve(buf.toString("utf8"));
    };
    const onErr = (err: Error) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.once("data", onData);
    socket.once("error", onErr);
  });
}

async function sendSmtp(mail: Mail, from: string) {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const implicitTls = process.env.SMTP_SECURE === "true" || port === 465;

  const connect = (useTls: boolean, sock?: net.Socket) =>
    new Promise<tls.TLSSocket | net.Socket>((resolve, reject) => {
      const s = useTls
        ? tls.connect({ host, port, servername: host, socket: sock }, () => resolve(s))
        : net.connect({ host, port }, () => resolve(s));
      s.once("error", reject);
    });

  let socket: net.Socket | tls.TLSSocket = await connect(implicitTls);
  const greet = await smtpRead(socket);
  if (!/^220/.test(greet)) throw new Error(greet);

  const ehlo = async (s: net.Socket) => {
    await smtpWrite(s, `EHLO holydays`);
    return smtpRead(s);
  };

  let hello = await ehlo(socket);
  if (!implicitTls && /STARTTLS/i.test(hello)) {
    await smtpWrite(socket, "STARTTLS");
    const ready = await smtpRead(socket);
    if (!/^220/.test(ready)) throw new Error(ready);
    socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const upgraded = tls.connect({ socket, servername: host }, () => resolve(upgraded));
      upgraded.once("error", reject);
    });
    hello = await ehlo(socket);
  }

  if (user) {
    await smtpWrite(socket, "AUTH LOGIN");
    await smtpRead(socket);
    await smtpWrite(socket, Buffer.from(user).toString("base64"));
    await smtpRead(socket);
    await smtpWrite(socket, Buffer.from(pass).toString("base64"));
    const auth = await smtpRead(socket);
    if (!/^235/.test(auth)) throw new Error(auth);
  }

  const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;
  const html = mail.html || wrapHtml(`<p style="white-space:pre-wrap">${esc(mail.text)}</p>`);
  const payload = [
    `From: ${from}`,
    `To: ${mail.to}`,
    `Subject: ${mail.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="utf-8"',
    "",
    html.replace(/\n/g, "\r\n").replace(/^\./gm, ".."),
    ".",
  ].join("\r\n");

  await smtpWrite(socket, `MAIL FROM:<${fromEmail}>`);
  await smtpRead(socket);
  await smtpWrite(socket, `RCPT TO:<${mail.to}>`);
  await smtpRead(socket);
  await smtpWrite(socket, "DATA");
  await smtpRead(socket);
  await smtpWrite(socket, payload);
  const done = await smtpRead(socket);
  await smtpWrite(socket, "QUIT");
  socket.end();
  if (!/^250/.test(done)) throw new Error(done);
}

export async function sendEmail(mail: Mail) {
  if (!isEmail(mail.to)) {
    return { delivered: false, preview: null as string | null };
  }
  const from = fromAddress();
  try {
    if (process.env.RESEND_API_KEY) {
      await sendResend(mail, from);
      return { delivered: true, preview: null };
    }
    if (process.env.SMTP_HOST) {
      await sendSmtp(mail, from);
      return { delivered: true, preview: null };
    }
  } catch (err) {
    console.error("[holydays-mail]", err);
    return { delivered: false, preview: mail.text };
  }
  console.info(`[holydays-mail] ${mail.subject} -> ${mail.to}\n${mail.text}`);
  return { delivered: false, preview: mail.text };
}
