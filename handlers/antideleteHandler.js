import { downloadContentFromMessage, proto } from '@whiskeysockets/baileys';
import { promises as fs } from 'fs';
import path from 'path';
import { isOwner, isAdmin } from '../utils/permissions.js';
import { 
    isEnabled, 
    setEnabled, 
    messageStore, 
    deleteMessage, 
    TEMP_MEDIA_DIR, 
    logMessage, 
    logger 
} from '../config/antidelete.js';

// Dictionnaire pour mapper les types de messages aux extensions de fichiers
const MESSAGE_TYPE_TO_EXTENSION = {
    'imageMessage': 'jpg',
    'videoMessage': 'mp4',
    'audioMessage': 'mp3',
    'stickerMessage': 'webp',
    'documentMessage': 'bin'
};

// Dictionnaire pour mapper les types de messages aux libellés
const MESSAGE_TYPE_TO_LABEL = {
    'conversation': 'Message texte',
    'extendedTextMessage': 'Message étendu',
    'imageMessage': 'Image',
    'videoMessage': 'Vidéo',
    'audioMessage': 'Audio',
    'stickerMessage': 'Autocollant',
    'documentMessage': 'Document'
};

// Fonction pour télécharger le contenu média
async function downloadMedia(message, type) {
    try {
        const extension = MESSAGE_TYPE_TO_EXTENSION[type] || 'bin';
        const messageContent = message.message[type];
        const buffer = await downloadContentFromMessage(messageContent, type.replace('Message', ''));
        const filename = `${message.key.id}.${extension}`;
        const filepath = path.join(TEMP_MEDIA_DIR, filename);
        
        // Convertir le buffer en Uint8Array si nécessaire
        const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(await buffer.arrayBuffer());
        await fs.writeFile(filepath, data);
        
        return {
            path: filepath,
            mime: messageContent.mimetype || 'application/octet-stream',
            caption: messageContent.caption || '',
            fileName: messageContent.fileName || filename,
            fileLength: messageContent.fileLength,
            seconds: messageContent.seconds,
            fileSha256: messageContent.fileSha256?.toString('base64')
        };
    } catch (error) {
        logger.error('Erreur lors du téléchargement du média:', error);
        return null;
    }
}

// Fonction pour obtenir le type de message
function getMessageType(message) {
    return Object.keys(MESSAGE_TYPE_TO_LABEL).find(type => message.message?.[type]);
}

// Fonction pour obtenir le texte d'un message
function getMessageText(message, messageType) {
    if (!messageType) return '';
    
    switch (messageType) {
        case 'conversation':
            return message.message[messageType] || '';
        case 'extendedTextMessage':
            return message.message[messageType]?.text || '';
        default:
            return message.message[messageType]?.caption || '';
    }
}

// Fonction pour stocker un message
async function storeMessage(message) {
    if (!message.key?.id) return null;

    const messageId = message.key.id;
    const sender = message.key.participant || message.key.remoteJid;
    const messageType = getMessageType(message);
    
    if (!messageType) {
        logger.warn(`Type de message non géré: ${JSON.stringify(message)}`);
        return null;
    }

    let content = getMessageText(message, messageType);
    let mediaInfo = null;

    // Télécharger le média si nécessaire
    if (messageType.endsWith('Message') && messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
        mediaInfo = await downloadMedia(message, messageType);
    }

    // Créer l'objet de données du message
    const messageData = {
        id: messageId,
        content,
        sender,
        timestamp: new Date().toISOString(),
        type: messageType,
        group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
        media: mediaInfo,
        raw: message // Conserver une copie brute du message pour référence
    };

    // Journaliser le message
    try {
        logMessage(message, 'info');
        logger.debug(`Message stocké: ${messageId}`, {
            type: messageType,
            sender,
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            hasMedia: !!mediaInfo
        });
    } catch (e) {
        logger.error('Erreur lors de la journalisation du message:', e);
    }

    // Stocker le message
    messageStore.set(messageId, messageData);
    return messageData;
}

// Formater un message pour l'affichage
function formatMessageForLog(messageData) {
    const sender = messageData.sender?.split('@')[0] || 'Inconnu';
    const group = messageData.group ? ` (Groupe: ${messageData.group.split('@')[0]})` : '';
    const type = MESSAGE_TYPE_TO_LABEL[messageData.type] || messageData.type || 'Inconnu';
    
    let content = messageData.content || '';
    if (content.length > 100) {
        content = content.substring(0, 100) + '...';
    }
    
    if (messageData.media) {
        content += ` [${type}]`;
        if (messageData.media.caption) {
            content += ` - ${messageData.media.caption}`;
        }
    }
    
    return `[${new Date(messageData.timestamp).toLocaleString()}] ${sender}${group}: ${content}`;
}

// Gérer la suppression d'un message
async function handleMessageRevocation(sock, key, participant) {
    if (!isEnabled()) return;

    try {
        const messageId = key.id;
        const message = messageStore.get(messageId);
        if (!message) {
            logger.debug(`Message supprimé non trouvé dans le store: ${messageId}`);
            return;
        }

        const deletedBy = participant || key.participant || key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Ne pas traiter les suppressions effectuées par le bot
        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) {
            await deleteMessage(messageId);
            return;
        }

        const sender = message.sender;
        const senderName = sender.split('@')[0];
        const groupName = message.group ? (await sock.groupMetadata(message.group)).subject : '';
        const time = new Date(message.timestamp).toLocaleString('fr-FR');

        // Préparer le message d'alerte
        let alertText = `🚨 *MESSAGE SUPPRIMÉ* 🚨\n\n` +
            `• *Expéditeur:* @${senderName}\n` +
            `• *Supprimé par:* @${deletedBy.split('@')[0]}\n` +
            `• *Heure d'envoi:* ${time}\n`;

        if (groupName) {
            alertText += `• *Groupe:* ${groupName}\n`;
        }

        // Ajouter le contenu du message ou une indication de média
        if (message.content) {
            alertText += `\n💬 *Message supprimé:*\n${message.content}`;
        } else if (message.media) {
            alertText += `\n📎 *Type de média:* ${message.media.type.replace('Message', '')}`;
            if (message.media.caption) {
                alertText += `\n📝 *Légende:* ${message.media.caption}`;
            }
        }

        // Envoyer l'alerte au propriétaire
        await sock.sendMessage(ownerNumber, {
            text: alertText,
            mentions: [deletedBy, sender].filter(Boolean)
        });

        // Envoyer le média s'il y en a un
        if (message.media && fs.existsSync(message.media.path)) {
            try {
                const mediaOptions = {
                    mimetype: message.media.mime,
                    caption: `📎 Média supprimé par @${deletedBy.split('@')[0]}`,
                    mentions: [deletedBy]
                };

                const mediaType = message.media.type.replace('Message', '').toLowerCase();
                const mediaContent = await fs.readFile(message.media.path);
                
                switch (mediaType) {
                    case 'image':
                        await sock.sendMessage(ownerNumber, { image: mediaContent, ...mediaOptions });
                        break;
                    case 'video':
                        await sock.sendMessage(ownerNumber, { video: mediaContent, ...mediaOptions });
                        break;
                    case 'audio':
                        await sock.sendMessage(ownerNumber, { audio: mediaContent, ...mediaOptions });
                        break;
                    case 'sticker':
                        await sock.sendMessage(ownerNumber, { sticker: mediaContent });
                        break;
                    case 'document':
                        await sock.sendMessage(ownerNumber, { 
                            document: mediaContent, 
                            fileName: `deleted_${path.basename(message.media.path)}`,
                            ...mediaOptions 
                        });
                        break;
                }
            } catch (error) {
                console.error('Erreur envoi média supprimé:', error);
                await sock.sendMessage(ownerNumber, { 
                    text: `⚠️ Impossible d'envoyer le média supprimé: ${error.message}` 
                });
            }
        }

        // Nettoyer
        deleteMessage(messageId);

    } catch (error) {
        console.error('Erreur gestion suppression message:', error);
    }
}

// Initialiser l'antidelete
function initAntiDelete(sock) {
    // Journaliser le démarrage
    logger.info('Initialisation du module antidelete');

    // Écouter les nouveaux messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (!isEnabled()) return;
            
            for (const message of messages) {
                try {
                    // Ignorer les messages du bot
                    if (message.key?.fromMe) continue;
                    
                    // Stocker le message
                    await storeMessage(message);
                    
                    // Journaliser les messages entrants
                    if (type === 'notify') {
                        const messageType = getMessageType(message) || 'inconnu';
                        logger.debug(`Nouveau message reçu (${messageType}): ${message.key.id}`);
                    }
                } catch (e) {
                    logger.error('Erreur lors du traitement du message:', e);
                }
            }
        } catch (e) {
            logger.error('Erreur dans le gestionnaire messages.upsert:', e);
        }
    });

    // Écouter les suppressions de messages
    sock.ev.on('messages.update', async (updates) => {
        try {
            if (!isEnabled()) return;
            
            for (const update of updates) {
                try {
                    // Vérifier si c'est une suppression de message (stubType 0)
                    if (update.update.messageStubType === 0 && update.key) {
                        const messageId = update.key.id;
                        logger.info(`Suppression de message détectée: ${messageId}`);
                        await handleMessageRevocation(sock, update.key, update.participant);
                    }
                } catch (e) {
                    logger.error('Erreur lors du traitement de la mise à jour du message:', e);
                }
            }
        } catch (e) {
            logger.error('Erreur dans le gestionnaire messages.update:', e);
        }
    });

    // Nettoyer les messages stockés au démarrage
    messageStore.clear();
    logger.info('Module antidelete initialisé avec succès');
}

// Exporter les fonctions pour la commande
export { 
    isEnabled as isAntideleteEnabled, 
    setEnabled as setAntideleteEnabled,
    initAntiDelete,
    handleMessageRevocation as handleRevoke
};
