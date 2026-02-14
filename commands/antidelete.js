// commands/antidelete.js
import { isAdmin, isOwner } from '../utils/permissions.js';
import { isAntideleteEnabled, setAntideleteEnabled } from '../handlers/antideleteHandler.js';

export default async function antideleteCommand(sock, msg, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Vérifier si on est dans un groupe
    if (!from?.endsWith('@g.us')) {
        return await sock.sendMessage(from, { 
            text: '❌ Cette commande fonctionne uniquement dans un groupe.' 
        }, { quoted: msg });
    }
    
    // Vérifier si l'expéditeur est admin ou propriétaire
    if (!isAdmin(sender) && !isOwner(sender)) {
        return await sock.sendMessage(from, { 
            text: '❌ Cette commande est réservée aux administrateurs du bot.' 
        }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();
    
    if (action === 'on') {
        setAntideleteEnabled(true);
        return await sock.sendMessage(from, { 
            text: '✅ *Antidelete activé*\n\nLe bot va maintenant enregistrer les messages supprimés et les envoyer au propriétaire.' 
        }, { quoted: msg });
    } 
    else if (action === 'off') {
        setAntideleteEnabled(false);
        return await sock.sendMessage(from, { 
            text: '❌ *Antidelete désactivé*\n\nLe bot ne surveillera plus les messages supprimés.' 
        }, { quoted: msg });
    }
    else {
        const status = isAntideleteEnabled() ? 'activé ✅' : 'désactivé ❌';
        return await sock.sendMessage(from, { 
            text: `🔍 *État de l'antidelete*: ${status}\n\n` +
                  `Utilisation :\n` +
                  `• *.antidelete on* - Active la détection des messages supprimés\n` +
                  `• *.antidelete off* - Désactive la détection des messages supprimés`
        }, { quoted: msg });
    }
}
