// say.js - Commande TTS modifiée pour utiliser une voix masculine/normale
// Ce fichier est un exemple de comment modifier la voix de gtts

import gTTS from 'gtts';
import fs from 'fs';
import path from 'path';

/**
 * Convertit du texte en parole avec voix masculine/normale
 * @param {string} text - Le texte à convertir
 * @param {string} lang - Langue (défaut: 'en' pour anglais)
 * @param {string} gender - Genre de voix (défaut: 'male' pour voix masculine)
 * @param {boolean} slow - Ralentir la vitesse (défaut: false)
 */
export async function convertTextToSpeech(text, lang = 'en', gender = 'male', slow = false) {
  try {
    // Options pour voix masculine/normale
    const options = {
      lang: lang,
      slow: slow,
      // Note: gtts natif n'a pas de paramètre gender direct
      // Pour obtenir une voix masculine, on peut:
      // 1. Utiliser des variantes linguistiques
      // 2. Changer de langage
      // 3. Utiliser Google Cloud TTS API (voir alternative ci-dessous)
    };

    // Créer le fichier audio
    const outputDir = './audio_output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${outputDir}/speech_${Date.now()}.mp3`;
    
    // Créer une instance gTTS
    const gtts = new gTTS({
      text: text,
      lang: options.lang,
      slow: options.slow,
    });

    // Sauvegarder le fichier MP3
    await gtts.save(filename);
    console.log(`Audio sauvegardé: ${filename}`);
    
    return filename;
  } catch (error) {
    console.error('Erreur dans convertTextToSpeech:', error);
    throw error;
  }
}

/**
 * ALTERNATIVE: Utiliser Google Cloud TTS pour voix masculine complète
 * Installation requise: npm install @google-cloud/text-to-speech
 */
export async function convertTextToSpeechGoogleCloud(text, gender = 'MALE') {
  try {
    const textToSpeech = require('@google-cloud/text-to-speech');
    const client = new textToSpeech.TextToSpeechClient();

    const request = {
      input: { text: text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C', // Voix masculine neurale (C = homme)
        // Options de voix disponibles:
        // en-US-Neural2-A (féminin)
        // en-US-Neural2-C (masculin) <-- Recommandé
        // en-US-Neural2-E (masculin)
        // en-US-Neural2-F (féminin)
        ssmlGender: gender, // 'MALE', 'FEMALE', ou 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: -2.0, // Réduire la hauteur (plus grave)
        speakingRate: 1.0, // Vitesse normale
      },
    };

    const [response] = await client.synthesizeSpeech(request);
    
    const outputDir = './audio_output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${outputDir}/speech_${Date.now()}.mp3`;
    fs.writeFileSync(filename, response.audioContent, 'binary');
    console.log(`Audio Google Cloud sauvegardé: ${filename}`);
    
    return filename;
  } catch (error) {
    console.error('Erreur dans convertTextToSpeechGoogleCloud:', error);
    throw error;
  }
}

/**
 * ALTERNATIVE: Utiliser ElevenLabs pour voix professionnelle masculine
 * Installation requise: npm install elevenlabs
 * API Key requis: https://elevenlabs.io
 */
export async function convertTextToSpeechElevenLabs(text, voiceId = 'Adam') {
  // 'Adam', 'Arnold', 'Bella' sont des voix disponibles
  // Consultez: https://elevenlabs.io/docs/voices
  try {
    const { ElevenLabsClient } = require('elevenlabs');
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    const audio = await client.generate({
      voice: voiceId,
      text: text,
    });

    const outputDir = './audio_output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${outputDir}/speech_${Date.now()}.mp3`;
    fs.writeFileSync(filename, audio);
    console.log(`Audio ElevenLabs sauvegardé: ${filename}`);
    
    return filename;
  } catch (error) {
    console.error('Erreur dans convertTextToSpeechElevenLabs:', error);
    throw error;
  }
}

/**
 * AMÉLIORATIONS: Paramètres de configuration pour say.js
 * À ajouter dans .env:
 */
const TTS_CONFIG = {
  // gtts (défaut actuel)
  provider: 'gtts', // 'gtts', 'google-cloud', 'elevenlabs'
  language: 'en-US',
  
  // Google Cloud
  googleCloud: {
    voiceName: 'en-US-Neural2-C', // Voix masculine
    ssmlGender: 'MALE',
    pitch: -2.0, // Grave
    speakingRate: 1.0,
  },

  // ElevenLabs
  elevenlabs: {
    voiceId: 'Adam', // Voix masculine
    apiKey: process.env.ELEVENLABS_API_KEY,
  },

  // gTTS options
  gtts: {
    language: 'en', // peut être 'en-gb' pour accent britannique
    slow: false,
  },
};

// Export des configurations
export { TTS_CONFIG };

/**
 * COMMANDES D'UTILISATION:
 * 
 * Dans votre commande WhatsApp say.js, utilisez:
 * 
 * // Option 1: gTTS avec langue pour voix plus grave
 * const audioFile = await convertTextToSpeech(text, 'en-gb', 'male', false);
 * 
 * // Option 2: Google Cloud TTS (recommandé)
 * const audioFile = await convertTextToSpeechGoogleCloud(text, 'MALE');
 * 
 * // Option 3: ElevenLabs (meilleure qualité)
 * const audioFile = await convertTextToSpeechElevenLabs(text, 'Adam');
 */
