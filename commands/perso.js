// commands/perso.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { sendWithTyping } from '../utils/sendWithTyping.js';

// Découpe un texte long en segments
function splitText(text, maxLength = 3500) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}

// Nettoyage HTML simple
function cleanText(text) {
  if (!text) return "Aucune description disponible.";
  return text.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
}

// Fonction sécurisée pour télécharger une image
async function downloadImage(url, filename) {
  if (!url) return null;
  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const imgPath = path.join(tmpdir(), filename);
    fs.writeFileSync(imgPath, resp.data);
    return imgPath;
  } catch (err) {
    console.warn("Impossible de télécharger l'image :", err.message);
    return null;
  }
}

// Commande principale
export default async function persoCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const query = args.join(" ").trim();

  if (!query) {
    return sendWithTyping(sock, from, {
      text: "⚠️ Utilise la commande comme ceci : *.perso NomDuPersonnage*"
    }, { quoted: msg });
  }

  try {
    // Recherche personnage via Jikan API
    const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=1&sfw=true`;
    const res = await axios.get(url, { timeout: 15000 });

    const char = res.data?.data?.[0];
    if (!char) {
      return sendWithTyping(sock, from, { text: "❌ Personnage introuvable." }, { quoted: msg });
    }

    const imageUrl = char.images?.jpg?.image_url || null;
    const header = `✨ *${char.name || "Inconnu"}* ${char.name_kanji ? `(${char.name_kanji})` : ""}`;
    
    const animeList = Array.isArray(char.anime) && char.anime.length
      ? char.anime.map(a => `🎬 ${a.role || 'N/A'} — ${a.anime?.name || 'N/A'}`).join("\n")
      : "Aucune apparition anime.";
    
    const mangaList = Array.isArray(char.manga) && char.manga.length
      ? char.manga.map(m => `📖 ${m.role || 'N/A'} — ${m.manga?.name || 'N/A'}`).join("\n")
      : "Aucune apparition manga.";
    
    const description = cleanText(char.about);

    const caption = [
      `${header}`,
      "",
      `🌀 *Apparitions Anime* :\n${animeList}`,
      "",
      `📚 *Apparitions Manga* :\n${mangaList}`,
      "",
      `🗒️ *Description* :\n${description}`
    ].join("\n");

    const parts = splitText(caption);

    // Télécharger l'image temporairement si disponible
    const safeFilename = `${(char.name || "character").replace(/\s+/g, "_")}.jpg`;
    const imgPath = await downloadImage(imageUrl, safeFilename);

    // Envoyer la première partie avec image si possible
    const primaryContent = imgPath
      ? { image: { url: imgPath }, caption: parts[0] }
      : (imageUrl ? { image: { url: imageUrl }, caption: parts[0] } : { text: parts[0] });

    await sendWithTyping(sock, from, primaryContent, { quoted: msg });

    if (imgPath) {
      try {
        fs.unlinkSync(imgPath);
      } catch (cleanupErr) {
        console.warn("Impossible de supprimer l'image temporaire :", cleanupErr.message);
      }
    }

    // Envoyer les autres parties
    for (let i = 1; i < parts.length; i++) {
      await sendWithTyping(sock, from, { text: parts[i] }, { quoted: msg });
    }

  } catch (err) {
    console.error("Erreur .perso :", err);
    await sendWithTyping(sock, from, {
      text: "❌ Erreur lors de la récupération du personnage. Vérifie le nom et réessaie."
    }, { quoted: msg });
  }
}
