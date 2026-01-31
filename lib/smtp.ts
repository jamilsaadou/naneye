import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSmtpPassword } from "@/lib/smtp-crypto";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string | null;
  pass?: string | null;
  from: string;
};

export async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.appSetting.findFirst({
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassword: true,
      smtpFrom: true,
    },
  });

  if (!settings?.smtpHost || !settings.smtpPort || !settings.smtpFrom) {
    return null;
  }

  const password = settings.smtpPassword ? decryptSmtpPassword(settings.smtpPassword) : null;

  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure ?? false,
    user: settings.smtpUser ?? null,
    pass: password,
    from: settings.smtpFrom,
  };
}

export function createSmtpTransport(config: SmtpConfig) {
  const auth = config.user ? { user: config.user, pass: config.pass ?? "" } : undefined;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function formatSmtpError(error: unknown) {
  if (!(error instanceof Error)) return "Erreur SMTP.";
  const message = error.message;
  if (message.includes("Greeting never received")) {
    return "Connexion SMTP impossible (salutation non reçue). Vérifiez hôte, port et TLS/SSL.";
  }
  if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    return "Serveur SMTP introuvable. Vérifiez l'hôte (ex: smtp.domaine.com).";
  }
  if (message.includes("EAUTH")) {
    return "Authentification SMTP échouée. Vérifiez utilisateur et mot de passe.";
  }
  return message;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const config = await loadSmtpConfig();
  if (!config) {
    throw new Error("SMTP non configuré. Configurez la connexion dans Paramètres > SMTP.");
  }
  if (config.user && !config.pass) {
    throw new Error("Mot de passe SMTP manquant. Mettez-le à jour dans Paramètres > SMTP.");
  }

  const transporter = createSmtpTransport(config);
  try {
    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    throw new Error(formatSmtpError(error));
  }
}

export async function sendCollectorCredentials(options: {
  to: string;
  name: string;
  code: string;
  password: string;
}) {
  const subject = "Accès collecteur - Gestion des Taxes";
  const text = `Bonjour ${options.name},\n\nVotre accès collecteur a été créé.\n\nCode collecteur : ${options.code}\nMot de passe : ${options.password}\n\nVeuillez conserver ces informations en lieu sûr.`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a;">
      <p>Bonjour ${options.name},</p>
      <p>Votre accès collecteur a été créé.</p>
      <p>
        <strong>Code collecteur :</strong> ${options.code}<br />
        <strong>Mot de passe :</strong> ${options.password}
      </p>
      <p>Veuillez conserver ces informations en lieu sûr.</p>
    </div>
  `;

  await sendEmail({
    to: options.to,
    subject,
    text,
    html,
  });
}

export async function sendCollectorResetCredentials(options: {
  to: string;
  name: string;
  code: string;
  password: string;
}) {
  const subject = "Réinitialisation accès collecteur - Gestion des Taxes";
  const text = `Bonjour ${options.name},\n\nVotre accès collecteur a été réinitialisé.\n\nCode collecteur : ${options.code}\nNouveau mot de passe : ${options.password}\n\nVeuillez conserver ces informations en lieu sûr.`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a;">
      <p>Bonjour ${options.name},</p>
      <p>Votre accès collecteur a été réinitialisé.</p>
      <p>
        <strong>Code collecteur :</strong> ${options.code}<br />
        <strong>Nouveau mot de passe :</strong> ${options.password}
      </p>
      <p>Veuillez conserver ces informations en lieu sûr.</p>
    </div>
  `;

  await sendEmail({
    to: options.to,
    subject,
    text,
    html,
  });
}
