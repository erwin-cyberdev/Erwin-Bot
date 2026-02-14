import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { createLogger, format, transports } from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ================= CONFIG ================= */

let antideleteEnabled = false;
const messageStore = new Map();

const TEMP_MEDIA_DIR = path.join(process.cwd(), 'temp_media');
const LOGS_DIR = path.join(process.cwd(), 'logs');

/* ================= DOSSIERS ================= */

[LOGS_DIR, TEMP_MEDIA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/* ================= LOGGER ================= */

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new transports.File({
            filename: path.join(LOGS_DIR, 'antidelete-error.log'),
            level: 'error'
        }),
        new transports.File({
            filename: path.join(LOGS_DIR, 'antidelete.log')
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(format.colorize(), format.simple())
    }));
}

/* ================= UTILS ================= */

// Fonction pour logger les messages
export function logMessage(message, type = 'info') {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type,
            messageId: message.key?.id,
            from: message.key?.remoteJid,
            sender: message.key?.participant || message.key?.remoteJid,
            content: message.message?.conversation || 
                    message.message?.extendedTextMessage?.text ||
                    (message.message?.imageMessage ? '[Image]' : '') ||
                    (message.message?.videoMessage ? '[Vidéo]' : '') ||
                    (message.message?.audioMessage ? '[Audio]' : '') ||
                    (message.message?.stickerMessage ? '[Autocollant]' : '') ||
                    (message.message?.documentMessage ? '[Document]' : '') ||
                    '[Type de message non supporté]',
            isGroup: message.key?.remoteJid?.endsWith('@g.us') || false
        };

        logger[type](JSON.stringify(logEntry));
    } catch (e) {
        console.error('Erreur lors de la journalisation du message:', e);
    }
}

export async function deleteMessage(messageId) {
    const msg = messageStore.get(messageId);
    if (!msg) return false;

    try {
        if (msg.media?.path && fs.existsSync(msg.media.path)) {
            await fsPromises.unlink(msg.media.path);
        }
        return messageStore.delete(messageId);
    } catch (e) {
        logger.error('Erreur lors de la suppression du message:', e);
        return false;
    }
}

export function isEnabled() {
    return antideleteEnabled;
}

export function setEnabled(state) {
    antideleteEnabled = state;
    logger.info(`Antidelete ${state ? 'activé' : 'désactivé'}`);
}

/* ================= STORE MESSAGE ================= */

export async function storeMessage(sock, msg) {
    try {
        if (!antideleteEnabled) return;
        if (!msg?.key?.id) return;

        const id = msg.key.id;
        const sender = msg.key.participant || msg.key.remoteJid;
        let content = '';
        let media = null;

        /* ===== TEXTE ===== */
        if (msg.message?.conversation) {
            content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        }

        /* ===== MEDIA ===== */
        const mediaTypes = [
            'imageMessage',
            'videoMessage',
            'audioMessage',
            'stickerMessage',
            'documentMessage'
        ];

        for (const type of mediaTypes) {
            if (msg.message?.[type]) {
                const stream = await downloadContentFromMessage(
                    msg.message[type],
                    type.replace('Message', '')
                );

                const buffer = Buffer.concat([]);
                const filePath = path.join(TEMP_MEDIA_DIR, `${id}-${type}`);

                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);

                await fsPromises.writeFile(filePath, Buffer.concat(chunks));

                media = { type, path: filePath };
                break;
            }
        }

        messageStore.set(id, {
            sender,
            content,
            media,
            chat: msg.key.remoteJid,
            timestamp: Date.now()
        });

    } catch (err) {
        logger.error('storeMessage error', err);
    }
}

/* ================= HANDLE DELETE ================= */

export async function handleMessageRevocation(sock, msg) {
    try {
        if (!antideleteEnabled) return;

        const key = msg.message?.protocolMessage?.key;
        if (!key?.id) return;

        const original = messageStore.get(key.id);
        if (!original) return;

        const owner = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Vérifier si le message supprimé provient d'un groupe ou d'une discussion privée
        const isGroup = original.chat.endsWith('@g.us');
        const targetChat = isGroup ? original.chat : owner;
        
        let text = `🛑 *MESSAGE SUPPRIMÉ*\n\n` +
            `👤 *Auteur:* ${original.sender}\n` +
            `💬 *Conversation:* ${isGroup ? 'Groupe' : 'Discussion privée'}\n` +
            `🕒 *Date:* ${new Date(original.timestamp).toLocaleString()}\n`;

        if (original.content) {
            text += `\n💬 *Message:* ${original.content}`;
        }

        // Envoyer la notification dans le chat d'origine
        await sock.sendMessage(targetChat, { text });

        // Renvoyer le média s'il y en a un
        if (original.media?.path && fs.existsSync(original.media.path)) {
            const type = original.media.type.replace('Message', '');
            const messageOptions = {
                [type]: { url: original.media.path },
                caption: `📎 *Média supprimé* - ${type}`
            };

            await sock.sendMessage(targetChat, messageOptions);
            await fsPromises.unlink(original.media.path);
        }

        // Si c'est un groupe, envoyer une copie au propriétaire du bot
        if (isGroup) {
            await sock.sendMessage(owner, { 
                text: `📨 *Message supprimé dans un groupe*\n` +
                      `👥 *Groupe:* ${original.chat}\n` +
                      `👤 *Auteur:* ${original.sender}\n` +
                      `💬 *Message:* ${original.content || '[Média]'}`
            });
        }

        messageStore.delete(key.id);

    } catch (err) {
        logger.error('handleMessageRevocation error', err);
    }
}

/* ================= CLEANUP ================= */

setInterval(async () => {
    try {
        const files = await fsPromises.readdir(TEMP_MEDIA_DIR);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(TEMP_MEDIA_DIR, file);
            const stat = await fsPromises.stat(filePath);

            if (now - stat.mtimeMs > 60 * 60 * 1000) {
                await fsPromises.unlink(filePath);
            }
        }
    } catch (err) {
        logger.error('cleanup error', err);
    }
}, 30 * 60 * 1000);

/* ================= EXPORTS ================= */

export {
    messageStore,
    TEMP_MEDIA_DIR,
    logger
};
