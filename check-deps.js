// check-deps.js - Vérifier toutes les dépendances requises (Version Refactorisée)
import chalk from 'chalk'

const requiredPackages = [
  // Core
  { name: '@whiskeysockets/baileys', critical: true },
  { name: 'qrcode-terminal', critical: true },
  { name: 'dotenv', critical: true },
  { name: 'axios', critical: true },
  
  // IA & Services (Groq)
  { name: 'node-fetch', critical: true },
  { name: 'form-data', critical: true },
  
  // Multimédia
  { name: '@distube/ytdl-core', critical: false },
  { name: 'yt-search', critical: false },
  { name: 'fluent-ffmpeg', critical: false },
  { name: 'wa-sticker-formatter', critical: false },
  
  // Utilitaires
  { name: 'chalk', critical: true },
  { name: 'figlet', critical: true },
  { name: 'pino', critical: true },
  { name: 'moment-timezone', critical: false }
]

console.log(chalk.cyan('\n╔═══════════════════════════════════════╗'))
console.log(chalk.cyan('║  🔍 VÉRIFICATION DES DÉPENDANCES    ║'))
console.log(chalk.cyan('╚═══════════════════════════════════════╝\n'))

let allOk = true
let criticalMissing = []
let optionalMissing = []

for (const pkg of requiredPackages) {
  try {
    await import(pkg.name)
    const status = chalk.green('✅ OK')
    const type = pkg.critical ? chalk.red('[CRITIQUE]') : chalk.yellow('[OPTIONNEL]')
    console.log(`${status} ${pkg.name.padEnd(35)} ${type}`)
  } catch (err) {
    const status = chalk.red('❌ MANQUANT')
    const type = pkg.critical ? chalk.red('[CRITIQUE]') : chalk.yellow('[OPTIONNEL]')
    console.log(`${status} ${pkg.name.padEnd(35)} ${type}`)
    
    if (pkg.critical) {
      criticalMissing.push(pkg.name)
      allOk = false
    } else {
      optionalMissing.push(pkg.name)
    }
  }
}

console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'))

if (criticalMissing.length > 0) {
  console.log(chalk.red.bold('❌ DÉPENDANCES CRITIQUES MANQUANTES:\n'))
  criticalMissing.forEach(pkg => {
    console.log(chalk.red(`   • ${pkg}`))
  })
  console.log(chalk.yellow('\n💡 Installe-les avec:'))
  console.log(chalk.cyan(`   npm install ${criticalMissing.join(' ')}\n`))
}

if (optionalMissing.length > 0) {
  console.log(chalk.yellow.bold('⚠️  DÉPENDANCES OPTIONNELLES MANQUANTES:\n'))
  optionalMissing.forEach(pkg => {
    console.log(chalk.yellow(`   • ${pkg}`))
  })
  console.log(chalk.gray('\n💡 Ces packages sont optionnels mais recommandés.'))
  console.log(chalk.cyan(`   npm install ${optionalMissing.join(' ')}\n`))
}

if (allOk && optionalMissing.length === 0) {
  console.log(chalk.green.bold('✅ TOUTES LES DÉPENDANCES SONT INSTALLÉES!\n'))
  console.log(chalk.cyan('🚀 Tu peux lancer le bot avec: npm start\n'))
} else if (allOk) {
  console.log(chalk.yellow.bold('⚠️  DÉPENDANCES CRITIQUES OK\n'))
  console.log(chalk.gray('Certaines fonctionnalités optionnelles ne seront pas disponibles.\n'))
  console.log(chalk.cyan('🚀 Tu peux quand même lancer le bot avec: npm start\n'))
} else {
  console.log(chalk.red.bold('❌ LE BOT NE PEUT PAS DÉMARRER\n'))
  console.log(chalk.yellow('Installe d\'abord les dépendances critiques manquantes.\n'))
  process.exit(1)
}
