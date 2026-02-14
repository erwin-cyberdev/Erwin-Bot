// ─────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────

// Extraire le contenu d’un message cité
function extractQuotedContent(quoted) {
  if (!quoted) return { type: 'text', content: null };

  if (quoted.conversation)
    return { type: 'text', content: quoted.conversation };

  if (quoted.extendedTextMessage?.text)
    return { type: 'text', content: quoted.extendedTextMessage.text };

  if (quoted.imageMessage)
    return {
      type: 'image',
      content: quoted.imageMessage,
      caption: quoted.imageMessage.caption || ''
    };

  if (quoted.videoMessage)
    return {
      type: 'video',
      content: quoted.videoMessage,
      caption: quoted.videoMessage.caption || ''
    };

  if (quoted.voiceMessage)
    return {
      type: 'voice',
      content: quoted.voiceMessage
    };

  return { type: 'text', content: null };
}

// Extraire le média du message courant (.tag avec média)
function extractOwnMedia(msg) {
  const m = msg.message;
  if (!m) return null;

  if (m.imageMessage)
    return {
      type: 'image',
      content: m.imageMessage,
      caption: m.imageMessage.caption || ''
    };

  if (m.videoMessage)
    return {
      type: 'video',
      content: m.videoMessage,
      caption: m.videoMessage.caption || ''
    };

  if (m.audioMessage)
    return {
      type: 'audio',
      content: m.audioMessage
    };

  return null;
}

// Envoyer un message avec mentions fantômes
async function replyWithGhostMentions(sock, remoteJid, msg, content, mentions = []) {
  const mentionList = msg.key.participant
    ? [...new Set([...mentions, msg.key.participant])]
    : mentions;

  return await sock.sendMessage(
    remoteJid,
    {
      ...content,
      mentions: mentionList,
      contextInfo: {
        mentionedJid: mentionList,
        forwardingScore: 999,
        isForwarded: true
      }
    },
    { quoted: msg }
  );
}

// ─────────────────────────────────────────────────────
// COMMANDE .tag
// ─────────────────────────────────────────────────────

export default async function (sock, msg, args = []) {
  try {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const userText = args.join(' ').trim() || '📢';

    if (!isGroup) {
      return await sock.sendMessage(
        from,
        { text: '⚠️ Cette commande fonctionne uniquement en groupe.' },
        { quoted: msg }
      );
    }

    const metadata = await sock.groupMetadata(from);
    const mentionIds = metadata.participants.map(p => p.id).filter(Boolean);

    // ─── 1️⃣ MEDIA DU MESSAGE LUI-MÊME ───────────────
    const ownMedia = extractOwnMedia(msg);
    if (ownMedia) {
      if (ownMedia.type === 'image') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { image: ownMedia.content, caption: ownMedia.caption || userText },
          mentionIds
        );
      }

      if (ownMedia.type === 'video') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { video: ownMedia.content, caption: ownMedia.caption || userText },
          mentionIds
        );
      }

      if (ownMedia.type === 'audio') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { audio: ownMedia.content, ptt: true },
          mentionIds
        );
      }
    }

    // ─── 2️⃣ MEDIA DU MESSAGE CITÉ ───────────────────
    if (quotedInfo) {
      const quoted = extractQuotedContent(quotedInfo);

      if (quoted.type === 'image') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { image: quoted.content, caption: quoted.caption || userText },
          mentionIds
        );
      }

      if (quoted.type === 'video') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { video: quoted.content, caption: quoted.caption || userText },
          mentionIds
        );
      }

      if (quoted.type === 'voice') {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { audio: quoted.content, ptt: true },
          mentionIds
        );
      }

      if (quoted.type === 'text' && quoted.content) {
        return await replyWithGhostMentions(
          sock,
          from,
          msg,
          { text: quoted.content },
          mentionIds
        );
      }
    }

    // ─── 3️⃣ TEXTE SIMPLE ───────────────────────────
    return await replyWithGhostMentions(
      sock,
      from,
      msg,
      { text: userText },
      mentionIds
    );

  } catch (err) {
    console.error('Erreur commande .tag :', err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: '❌ Une erreur est survenue.' },
      { quoted: msg }
    );
  }
}
