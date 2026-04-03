import { Chess } from 'chess.js'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { renderBoard } from '../utils/chessRender.js'

const GAMES_PATH = path.resolve('./data/chess_games.json')
let games = {}

// Chargement des parties
if (fs.existsSync(GAMES_PATH)) {
  try {
    games = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8'))
  } catch (e) {
    console.error('Chess: erreur chargement games', e)
  }
}

function saveGames() {
  const dir = path.dirname(GAMES_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(GAMES_PATH, JSON.stringify(games, null, 2))
}

/**
 * Interaction avec GNU Chess
 */
async function getGnuChessMove(fen) {
  return new Promise((resolve) => {
    const proc = spawn('gnuchess', ['--uci'])
    let bestMove = null
    
    proc.stdout.on('data', (data) => {
      const output = data.toString()
      const match = output.match(/bestmove\s+(\w+)/)
      if (match) {
        bestMove = match[1]
        proc.stdin.write('quit\n')
      }
    })

    proc.stdin.write(`position fen ${fen}\n`)
    proc.stdin.write('go depth 5\n') // Profondeur limitée pour la rapidité
    
    setTimeout(() => {
      if (!bestMove) proc.stdin.write('quit\n')
      resolve(bestMove)
    }, 5000)
  })
}

export default async function chessCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || from
  const sub = (args[0] || '').toLowerCase()

  // 1. Démarrer une partie
  if (sub === 'start' || !games[from]) {
    games[from] = new Chess().fen()
    saveGames()
    const buffer = await renderBoard(games[from])
    await sock.sendMessage(from, { 
      image: buffer, 
      caption: '🎮 *Nouvelle partie d\'échecs lancée !*\nTu joues les *Blancs*.\nTape `-chess <coup>` (ex: `e2e4`) pour jouer.' 
    }, { quoted: msg })
    return
  }

  // 2. Quitter
  if (sub === 'stop' || sub === 'quit') {
    delete games[from]
    saveGames()
    return await sock.sendMessage(from, { text: '🏳️ Partie abandonnée.' }, { quoted: msg })
  }

  // 3. Jouer un coup
  const chess = new Chess(games[from])
  const moveStr = args[0]

  try {
    const move = chess.move(moveStr)
    if (!move) throw new Error('Coup invalide')

    // Vérifier fin de partie après coup joueur
    if (chess.isGameOver()) {
       const status = chess.isCheckmate() ? 'Échec et mat ! Tu as gagné 🏆' : 'Égalité 🤝'
       delete games[from]
       saveGames()
       const buffer = await renderBoard(chess.fen())
       return await sock.sendMessage(from, { image: buffer, caption: `🏁 *FIN DE PARTIE*\n${status}` }, { quoted: msg })
    }

    // Tour du bot (IA)
    await sock.sendMessage(from, { text: '🤔 Erwin réfléchit...' }, { quoted: msg })
    const botMove = await getGnuChessMove(chess.fen())
    
    if (botMove) {
      chess.move(botMove)
    } else {
      // Fallback si GNU Chess échoue
      const moves = chess.moves()
      chess.move(moves[Math.floor(Math.random() * moves.length)])
    }

    // Enregistrer l'état
    games[from] = chess.fen()
    saveGames()

    // Rendu et envoi
    const buffer = await renderBoard(chess.fen())
    let caption = `♟️ *Erwin a joué : ${botMove || 'Aléatoire'}*\n\n`
    if (chess.isCheck()) caption += '⚠️ *ÉCHEC !*\n'
    
    if (chess.isGameOver()) {
      const status = chess.isCheckmate() ? 'Échec et mat ! L\'ordinateur a gagné 🤖' : 'Égalité 🤝'
      delete games[from]
      saveGames()
      caption += `🏁 *FIN DE PARTIE*\n${status}`
    } else {
      caption += 'À toi de jouer ! Tape `-chess <coup>`'
    }

    await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg })

  } catch (err) {
    await sock.sendMessage(from, { text: '❌ Coup invalide ! Utilise la notation algébrique (ex: `e2e4`, `Nf3`).' }, { quoted: msg })
  }
}
