import { ownerOnly } from '../utils/permissions.js';
import { setAdminOnly, isAdminOnly as getAdminOnlyStatus } from '../config/adminOnly.js';

export default ownerOnly(async function adminOnlyCommand(sock, msg, args) {
    const from = msg.key.remoteJid;

    const action = args[0]?.toLowerCase();
    
    if (action === 'on') {
        setAdminOnly(true);
        await sock.sendMessage(from, { 
            text: '🔒 Mode admin-only activé. Seuls les admins et propriétaires peuvent utiliser le bot.' 
        }, { quoted: msg });
    } 
    else if (action === 'off') {
        setAdminOnly(false);
        await sock.sendMessage(from, { 
            text: '🔓 Mode admin-only désactivé. Tous les utilisateurs peuvent utiliser le bot.' 
        }, { quoted: msg });
    }
    else {
        const status = getAdminOnlyStatus() ? 'activé' : 'désactivé';
        await sock.sendMessage(from, { 
            text: `ℹ️ Mode admin-only est actuellement *${status}*\n\nUtilisation :\n- *.adminonly on* : Active le mode admin-only\n- *.adminonly off* : Désactive le mode admin-only` 
        }, { quoted: msg });
    }
})
