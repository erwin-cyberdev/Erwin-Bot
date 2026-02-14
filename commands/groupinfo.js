import { downloadMediaMessage, getContentType } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import { isAdmin, isOwner } from '../utils/permissions.js'
import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'

export default async function groupInfo(sock, msg) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid
  
  // Vérifier si le message vient d'un groupe
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, {
      text: '❌ Cette commande ne peut être utilisée que dans un groupe.'
    }, { quoted: msg })
  }

  try {
    // Récupérer les métadonnées du groupe
    const metadata = await sock.groupMetadata(from)
    
    // Récupérer la liste des administrateurs
    const admins = metadata.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => `• @${p.id.split('@')[0]}`)
      .join('\n') || 'Aucun administrateur';

    // Récupérer la photo de profil du groupe (version simplifiée et plus robuste)
    let hasPhoto = false;
    let photoPath = '';
    let ppUrl = null;
    
    try {
      // Essayer d'abord de récupérer en haute qualité (HD)
      try {
        ppUrl = await Promise.race([
          sock.profilePictureUrl(from, 'image', 'hd'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout HD')), 5000))
        ]);
        console.log('Photo HD trouvée');
      } catch (e) {
        console.log('Photo HD non disponible, tentative en qualité standard...');
        // Si échec, essayer en qualité standard
        ppUrl = await Promise.race([
          sock.profilePictureUrl(from, 'image'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout standard')), 5000))
        ]);
      }
    } catch (e) {
      console.log('Impossible de récupérer la photo (délai dépassé ou erreur):', e.message);
    }
    
    // Si on a une URL valide, essayer de télécharger l'image
    if (ppUrl) {
      try {
        const timestamp = Date.now();
        photoPath = path.join(process.cwd(), `temp_group_photo_${timestamp}.jpg`);
        
        // Configuration pour obtenir la meilleure qualité possible
        const response = await fetch(ppUrl, { 
          timeout: 15000, // 15 secondes de timeout pour la HD
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive'
          }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            await writeFile(photoPath, Buffer.from(arrayBuffer));
            const stats = await fs.promises.stat(photoPath);
            hasPhoto = stats.size > 1024; // Vérifier que le fichier fait plus de 1KB
          }
        }
      } catch (e) {
        console.error('Erreur lors du téléchargement de la photo:', e.message);
        // Nettoyer en cas d'erreur
        if (photoPath && fs.existsSync(photoPath)) {
          await fs.promises.unlink(photoPath).catch(console.error);
          photoPath = '';
        }
      }
    }

    // Formater la date de création
    const creationDate = new Date(metadata.creation * 1000).toLocaleString()
    
    // Trouver le propriétaire
    const owner = metadata.participants.find(p => p.admin === 'superadmin');
    const ownerInfo = owner ? `@${owner.id.split('@')[0]}` : 'Inconnu';

    // Créer le message avec les informations du groupe
    let infoText = `*📊 Informations du Groupe*\n\
` +
      `*Nom :* ${metadata.subject || 'Aucun'}\n` +
      `*ID :* ${metadata.id}\n` +
      `*Créé le :* ${creationDate}\n` +
      `*Description :* ${metadata.desc?.toString() || 'Aucune description'}\n\
` +
      `*Propriétaire :* ${ownerInfo}\n` +
      `*Participants :* ${metadata.participants.length}\n` +
      `*Administrateurs (${metadata.participants.filter(p => p.admin).length}) :*\n${admins}\n\
` +
      `*Paramètres :*\n` +
      `• Annonces : ${metadata.announce ? '🔔 Activées' : '🔕 Désactivées'}\n`;
    
    // Ajouter les informations sur les messages éphémères si disponibles
    if (metadata.ephemeralDuration !== undefined) {
      infoText += `• Messages éphémères : ${metadata.ephemeralDuration ? `Activés (${metadata.ephemeralDuration}s)` : 'Désactivés'}\n`;
    }

    // Envoyer le message avec ou sans photo
    if (hasPhoto && photoPath) {
      await sock.sendMessage(from, {
        image: { url: photoPath },
        caption: infoText,
        mentions: metadata.participants.map(p => p.id)
      });
      
      // Supprimer le fichier temporaire après l'envoi
      fs.unlink(photoPath, (err) => {
        if (err) console.error('Erreur lors de la suppression du fichier temporaire:', err);
      });
    } else {
      await sock.sendMessage(from, { 
        text: infoText 
      }, { 
        quoted: msg,
        mentions: metadata.participants.map(p => p.id)
      });
    }
    
  } catch (error) {
    console.error('Erreur dans la commande groupinfo:', error)
    await sock.sendMessage(from, {
      text: '❌ Une erreur est survenue lors de la récupération des informations du groupe.'
    }, { quoted: msg })
  }
}
