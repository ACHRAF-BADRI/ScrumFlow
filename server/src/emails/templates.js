import { appUrl } from '../utils/mailer.js';

/*
 * Transactional email templates (EN / FR). Each builder returns
 * { to, subject, html, text }. Table-based layout and inline styles so it
 * renders in every mail client. User content is always escaped.
 */

const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const T = {
  en: {
    footer: 'You receive this email because of your ScrumFlow account.',
    manage: 'Manage email notifications',
    ignore: 'If you did not expect this email, you can ignore it.',
    role: { admin: 'an admin', member: 'a member' },
    invite: {
      subject: (inviter, project) => `${inviter} invited you to ${project} on ScrumFlow`,
      title: (project) => `Join ${project}`,
      body: (inviter, project, role) => `${inviter} invited you to join the project ${project} as ${role}. Create your account to start planning sprints with the team.`,
      cta: 'Accept the invitation',
      expires: 'This invitation expires in 7 days.',
    },
    added: {
      subject: (inviter, project) => `${inviter} added you to ${project}`,
      title: (project) => `You joined ${project}`,
      body: (inviter, project, role) => `${inviter} added you to the project ${project} as ${role}.`,
      cta: 'Open the project',
    },
    reset: {
      subject: 'Reset your ScrumFlow password',
      title: 'Reset your password',
      body: (name) => `Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.`,
      cta: 'Choose a new password',
      expires: 'This link expires in 1 hour and can be used once.',
    },
    assigned: {
      subject: (actor, key) => `${actor} assigned you ${key}`,
      title: 'A task was assigned to you',
      body: (actor, project) => `${actor} assigned you a task in ${project}:`,
      cta: 'Open the task',
    },
    mention: {
      subject: (actor, key) => `${actor} mentioned you on ${key}`,
      title: 'You were mentioned',
      body: (actor, project) => `${actor} mentioned you in a comment in ${project}:`,
      cta: 'Reply',
    },
  },
  fr: {
    footer: 'Vous recevez cet e-mail grâce à votre compte ScrumFlow.',
    manage: 'Gérer les notifications par e-mail',
    ignore: 'Si vous n’attendiez pas cet e-mail, vous pouvez l’ignorer.',
    role: { admin: 'admin', member: 'membre' },
    invite: {
      subject: (inviter, project) => `${inviter} vous invite sur ${project} dans ScrumFlow`,
      title: (project) => `Rejoignez ${project}`,
      body: (inviter, project, role) => `${inviter} vous invite à rejoindre le projet ${project} en tant que ${role}. Créez votre compte pour planifier les sprints avec l’équipe.`,
      cta: 'Accepter l’invitation',
      expires: 'Cette invitation expire dans 7 jours.',
    },
    added: {
      subject: (inviter, project) => `${inviter} vous a ajouté à ${project}`,
      title: (project) => `Vous avez rejoint ${project}`,
      body: (inviter, project, role) => `${inviter} vous a ajouté au projet ${project} en tant que ${role}.`,
      cta: 'Ouvrir le projet',
    },
    reset: {
      subject: 'Réinitialisez votre mot de passe ScrumFlow',
      title: 'Réinitialiser votre mot de passe',
      body: (name) => `Bonjour ${name}, nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.`,
      cta: 'Choisir un nouveau mot de passe',
      expires: 'Ce lien expire dans 1 heure et ne fonctionne qu’une fois.',
    },
    assigned: {
      subject: (actor, key) => `${actor} vous a assigné ${key}`,
      title: 'Une tâche vous a été assignée',
      body: (actor, project) => `${actor} vous a assigné une tâche dans ${project} :`,
      cta: 'Ouvrir la tâche',
    },
    mention: {
      subject: (actor, key) => `${actor} vous a mentionné sur ${key}`,
      title: 'Vous avez été mentionné',
      body: (actor, project) => `${actor} vous a mentionné dans un commentaire sur ${project} :`,
      cta: 'Répondre',
    },
  },
};

const tr = (lang) => T[lang === 'fr' ? 'fr' : 'en'];

function layout({ lang, title, paragraphs, quote, cta, url, note, notification }) {
  const t = tr(lang);
  const html = `<!doctype html>
<html lang="${lang === 'fr' ? 'fr' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#323338;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 4px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${appUrl('/email-logo.png')}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-size:19px;font-weight:800;letter-spacing:-0.4px;color:#323338;">Scrum<span style="color:#6161ff;">Flow</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e1e4ed;border-radius:16px;padding:32px 28px;">
          <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#323338;">${esc(title)}</h1>
          ${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4b4d5c;">${p}</p>`).join('')}
          ${quote ? `<div style="margin:6px 0 18px;padding:14px 16px;background:#f6f7fb;border-left:3px solid #6161ff;border-radius:8px;font-size:15px;line-height:1.5;color:#323338;">${quote}</div>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;"><tr>
            <td style="background:#6161ff;border-radius:10px;">
              <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(cta)}</a>
            </td>
          </tr></table>
          ${note ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#676879;">${esc(note)}</p>` : ''}
          <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#9a9cad;word-break:break-all;">${esc(url)}</p>
        </td></tr>
        <tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#9a9cad;text-align:center;">
          ${esc(t.footer)}${notification ? `<br><a href="${appUrl('/account')}" style="color:#6161ff;text-decoration:none;">${esc(t.manage)}</a>` : `<br>${esc(t.ignore)}`}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return html;
}

/** Plain-text version (better deliverability, and logged in development). */
const plain = (title, lines, url) => [title, '', ...lines, '', url].join('\n');

export function invitationEmail({ to, lang, inviterName, projectName, role, url }) {
  const t = tr(lang);
  const roleLabel = t.role[role] ?? role;
  const body = t.invite.body(`<b>${esc(inviterName)}</b>`, `<b>${esc(projectName)}</b>`, esc(roleLabel));
  return {
    to,
    subject: t.invite.subject(inviterName, projectName),
    html: layout({ lang, title: t.invite.title(projectName), paragraphs: [body], cta: t.invite.cta, url, note: t.invite.expires }),
    text: plain(t.invite.title(projectName), [t.invite.body(inviterName, projectName, roleLabel), t.invite.expires], url),
  };
}

export function addedToProjectEmail({ to, lang, inviterName, projectName, role, url }) {
  const t = tr(lang);
  const roleLabel = t.role[role] ?? role;
  return {
    to,
    subject: t.added.subject(inviterName, projectName),
    html: layout({ lang, title: t.added.title(projectName), paragraphs: [t.added.body(`<b>${esc(inviterName)}</b>`, `<b>${esc(projectName)}</b>`, esc(roleLabel))], cta: t.added.cta, url, notification: true }),
    text: plain(t.added.title(projectName), [t.added.body(inviterName, projectName, roleLabel)], url),
  };
}

export function resetPasswordEmail({ to, lang, name, url }) {
  const t = tr(lang);
  return {
    to,
    subject: t.reset.subject,
    html: layout({ lang, title: t.reset.title, paragraphs: [t.reset.body(esc(name))], cta: t.reset.cta, url, note: t.reset.expires }),
    text: plain(t.reset.title, [t.reset.body(name), t.reset.expires], url),
  };
}

export function taskAssignedEmail({ to, lang, actorName, projectName, taskKey, taskTitle, url }) {
  const t = tr(lang);
  return {
    to,
    subject: t.assigned.subject(actorName, taskKey),
    html: layout({
      lang,
      title: t.assigned.title,
      paragraphs: [t.assigned.body(`<b>${esc(actorName)}</b>`, `<b>${esc(projectName)}</b>`)],
      quote: `<span style="font-family:Menlo,Consolas,monospace;font-size:12px;color:#676879;">${esc(taskKey)}</span><br><b>${esc(taskTitle)}</b>`,
      cta: t.assigned.cta,
      url,
      notification: true,
    }),
    text: plain(t.assigned.title, [t.assigned.body(actorName, projectName), `${taskKey}: ${taskTitle}`], url),
  };
}

export function mentionEmail({ to, lang, actorName, projectName, taskKey, taskTitle, excerpt, url }) {
  const t = tr(lang);
  return {
    to,
    subject: t.mention.subject(actorName, taskKey),
    html: layout({
      lang,
      title: t.mention.title,
      paragraphs: [t.mention.body(`<b>${esc(actorName)}</b>`, `<b>${esc(projectName)}</b>`)],
      quote: `<span style="font-family:Menlo,Consolas,monospace;font-size:12px;color:#676879;">${esc(taskKey)} · ${esc(taskTitle)}</span><br>${esc(excerpt).replace(/\n/g, '<br>')}`,
      cta: t.mention.cta,
      url,
      notification: true,
    }),
    text: plain(t.mention.title, [t.mention.body(actorName, projectName), `${taskKey} · ${taskTitle}`, excerpt], url),
  };
}
