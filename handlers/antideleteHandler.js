import { downloadContentFromMessage } from 'baileys';
import { promises as fs } from 'fs';
import path from 'path';
import { isOwner } from '../utils/permissions.js';
import { 
    isEnabled, 
    messageStore, 
    deleteMessage, 
    TEMP_MEDIA_DIR, 
    logger 
} from '../config/antidelete.js';

const MESSAGE_TYPE_TO_EXTENSION = {
    'imageMessage': 'jpg',
    'videoMessage': 'mp4',
    'audioMessage': 'mp3',
    'stickerMessage': 'webp',
    'documentMessage': 'bin'
};

const MESSAGE_TYPE_TO_LABEL = {
    'conversation': 'Message texte',
    'extendedTextMessage': 'Message étendu',
    'imageMessage': 'Image',
    'videoMessage': 'Vidéo',
    'audioMessage': 'Audio',
    'stickerMessage': 'Autocollant',
    'documentMessage': 'Document'
};

async function downloadMedia(message, type) {
    try {
        const extension = MESSAGE_TYPE_TO_EXTENSION[type] || 'bin';
        const messageContent = message.message[type];
        const buffer = await downloadContentFromMessage(messageContent, type.replace('Message', ''));
        const filename = `${message.key.id}.${extension}`;
        const filepath = path.join(TEMP_MEDIA_DIR, filename);
        
        const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(await buffer.arrayBuffer());
        await fs.writeFile(filepath, data);
        
        return {
            path: filepath,
            mime: messageContent.mimetype || 'application/octet-stream',
            caption: messageContent.caption || '',
            type: type
        };
    } catch (error) {
        logger.error('Erreur téléchargement média antidelete:', error);
        return null;
    }
}

function getMessageType(message) {
    return Object.keys(MESSAGE_TYPE_TO_LABEL).find(type => message.message?.[type]);
}

function getMessageText(message, messageType) {
    if (!messageType) return '';
    switch (messageType) {
        case 'conversation': return message.message[messageType] || '';
        case 'extendedTextMessage': return message.message[messageType]?.text || '';
        default: return message.message[messageType]?.caption || '';
    }
}

async function storeMessage(message) {
    if (!message.key?.id) return null;

    const messageId = message.key.id;
    const sender = message.key.participant || message.key.remoteJid;
    const messageType = getMessageType(message);
    
    if (!messageType) return null;

    let content = getMessageText(message, messageType);
    let mediaInfo = null;

    if (messageType.endsWith('Message') && !['conversation', 'extendedTextMessage'].includes(messageType)) {
        mediaInfo = await downloadMedia(message, messageType);
    }

    const messageData = {
        id: messageId,
        content,
        sender,
        chat: message.key.remoteJid,
        timestamp: Date.now(),
        type: messageType,
        media: mediaInfo
    };

    messageStore.set(messageId, messageData);
    return messageData;
}

async function handleRevoke(sock, key, participant) {
    if (!isEnabled()) return;

    try {
        const messageId = key.id;
        const original = messageStore.get(messageId);
        if (!original) return;

        const deletedBy = participant || key.participant || key.remoteJid;
        const owner = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER + '@s.whatsapp.net' : (sock.user.id.split(':')[0] + '@s.whatsapp.net');
        
        // Skip if deleted by bot or owner
        if (deletedBy.includes(sock.user.id.split(':')[0]) || deletedBy === owner) {
            deleteMessage(messageId);
            return;
        }

        const isGroup = original.chat.endsWith('@g.us');
        const targetChat = original.chat; // Always send back to original chat

        let alertText = `🛑 *MESSAGE SUPPRIMÉ* 🛑\n\n` +
            `👤 *Auteur:* @${original.sender.split('@')[0]}\n` +
            `🗑️ *Supprimé par:* @${deletedBy.split('@')[0]}\n` +
            `🕒 *Heure:* ${new Date(original.timestamp).toLocaleString()}\n`;

        if (original.content) {
            alertText += `\n💬 *Message:* ${original.content}`;
        } else if (original.media) {
            alertText += `\n📎 *Type:* ${original.media.type.replace('Message', '')}`;
            if (original.media.caption) alertText += `\n📝 *Légende:* ${original.media.caption}`;
        }

        const mentions = [original.sender, deletedBy];

        // Send to original chat (group or private)
        await sock.sendMessage(targetChat, { text: alertText, mentions });

        // Resend media if exists
        if (original.media && await fs.stat(original.media.path).catch(() => false)) {
            const type = original.media.type.replace('Message', '').toLowerCase();
            const mediaContent = await fs.readFile(original.media.path);
            const mediaOptions = {
                caption: `📎 *Média restauré* (Supprimé par @${deletedBy.split('@')[0]})`,
                mentions: [deletedBy]
            };

            await sock.sendMessage(targetChat, { [type]: mediaContent, ...mediaOptions });
        }

        // Also notify owner if it was in a group
        if (isGroup) {
            await sock.sendMessage(owner, { 
                text: `📨 *Anti-Delete Alerte (Groupe)*\n👥 *Groupe:* ${original.chat}\n${alertText}`,
                mentions 
            });
        }

        deleteMessage(messageId);
    } catch (error) {
        logger.error('Erreur handleMessageRevocation:', error);
    }
}

export function initAntiDelete(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        if (!isEnabled()) return;
        for (const msg of messages) {
            if (msg.key?.fromMe) continue;
            await storeMessage(msg);
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        if (!isEnabled()) return;
        for (const update of updates) {
            if (update.update.messageStubType === 0 && update.key) {
                await handleRevoke(sock, update.key, update.participant);
            }
        }
    });
}

export { handleRevoke };
