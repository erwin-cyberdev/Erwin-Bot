import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';

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
        }),
        new transports.Console({
            format: format.combine(format.colorize(), format.simple())
        })
    ]
});

/* ================= UTILS ================= */

export async function deleteMessage(messageId) {
    const msg = messageStore.get(messageId);
    if (!msg) return false;

    try {
        if (msg.media?.path && fs.existsSync(msg.media.path)) {
            fs.unlinkSync(msg.media.path);
        }
        return messageStore.delete(messageId);
    } catch (e) {
        logger.error('Erreur suppression cache média antidelete:', e);
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

/* ================= EXPORTS ================= */

export {
    messageStore,
    TEMP_MEDIA_DIR,
    logger
};
