import { randomInt } from './random.js'

const makeName = (fr, en) => ({ fr, en })
const makeDescription = (fr, en) => ({ fr, en })

const ROLE_DEFINITIONS = {
  villager: {
    key: 'villager',
    name: makeName('Villageois', 'Villager'),
    faction: 'village',
    unique: false,
    description: makeDescription('Villageois sans pouvoir particulier.', 'Vanilla villager without any special ability.'),
    abilities: []
  },
  seer: {
    key: 'seer',
    name: makeName('Voyante', 'Seer'),
    faction: 'village',
    unique: true,
    description: makeDescription('Découvre l’identité d’un joueur chaque nuit (peut être trompée).', 'May reveal one player per night (can be misled).'),
    abilities: ['vision'],
    tags: ['may_be_false']
  },
  witch: {
    key: 'witch',
    name: makeName('Sorcière', 'Witch'),
    faction: 'village',
    unique: true,
    description: makeDescription('Dispose d’une potion de vie et d’une potion de mort.', 'Has one healing and one damaging potion.'),
    abilities: ['heal', 'poison']
  },
  hunter: {
    key: 'hunter',
    name: makeName('Chasseur', 'Hunter'),
    faction: 'village',
    unique: true,
    description: makeDescription('Avant de mourir, peut éliminer un joueur.', 'May shoot one player upon death.'),
    abilities: ['death_shot']
  },
  littleGirl: {
    key: 'littleGirl',
    name: makeName('Petite Fille', 'Little Girl'),
    faction: 'village',
    unique: true,
    description: makeDescription('Peut épier les loups la nuit (au risque de se faire repérer).', 'Spies on the wolves at night (risky).'),
    abilities: ['spy']
  },
  cupid: {
    key: 'cupid',
    name: makeName('Cupidon', 'Cupid'),
    faction: 'village',
    unique: true,
    description: makeDescription('Relie deux amoureux lors de la première nuit.', 'Links two lovers during the first night.'),
    abilities: ['link_lovers']
  },
  thief: {
    key: 'thief',
    name: makeName('Voleur', 'Thief'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Peut échanger son rôle avec une carte non distribuée.', 'May swap role with an unused card.'),
    abilities: ['swap_role']
  },
  elder: {
    key: 'elder',
    name: makeName('Ancien', 'Elder'),
    faction: 'village',
    unique: true,
    description: makeDescription('Résiste à la première attaque nocturne.', 'Resists the first night attack.'),
    abilities: ['extra_life']
  },
  angel: {
    key: 'angel',
    name: makeName('Ange', 'Angel'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Gagne s’il meurt le premier jour.', 'Wins if eliminated during the first day.'),
    abilities: ['selfish_goal']
  },
  guardianAngel: {
    key: 'guardianAngel',
    name: makeName('Ange Gardien', 'Guardian Angel'),
    faction: 'village',
    unique: true,
    description: makeDescription('Protège un joueur chaque nuit.', 'Protects one player every night.'),
    abilities: ['protect']
  },
  savior: {
    key: 'savior',
    name: makeName('Salvateur', 'Savior'),
    faction: 'village',
    unique: true,
    description: makeDescription('Protège un joueur chaque nuit (variante).', 'Protects one player every night (variant).'),
    abilities: ['protect']
  },
  madProtector: {
    key: 'madProtector',
    name: makeName('Protecteur Fou', 'Mad Protector'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Protège aléatoirement, parfois inefficace.', 'Randomly protects, often fails.'),
    abilities: ['chaotic_protect']
  },
  clown: {
    key: 'clown',
    name: makeName('Bouffon', 'Jester'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Gagne s’il est éliminé pendant le jour.', 'Wins if lynched during the day.'),
    abilities: ['wants_lynch']
  },
  hogman: {
    key: 'hogman',
    name: makeName('Homme-Porc', 'Hogman'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Vote double le jour mais attire la suspicion.', 'Votes twice during the day but is suspicious.'),
    abilities: ['double_vote']
  },
  villageFool: {
    key: 'villageFool',
    name: makeName('Fou du village', 'Village Fool'),
    faction: 'village',
    unique: true,
    description: makeDescription('Rôle comique sans pouvoir.', 'Comic role without active power.'),
    abilities: []
  },
  piper: {
    key: 'piper',
    name: makeName('Joueur de flûte', 'Piper'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Enchante les joueurs la nuit pour un objectif secret.', 'Charms players at night with a secret objective.'),
    abilities: ['charm']
  },
  madSeer: {
    key: 'madSeer',
    name: makeName('Voyante folle', 'Mad Seer'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Reçoit des visions erronées.', 'Receives wrong visions.'),
    abilities: ['false_vision']
  },
  idiot: {
    key: 'idiot',
    name: makeName('Idiot du village', 'Village Idiot'),
    faction: 'village',
    unique: true,
    description: makeDescription('Survit à son premier lynchage mais perd son vote.', 'Survives first lynch but loses voting power.'),
    abilities: ['lynch_survive']
  },
  secretPlayer: {
    key: 'secretPlayer',
    name: makeName('Joueur secret', 'Secret Player'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Objectif caché, rôle imprévisible.', 'Hidden goal, unpredictable role.'),
    abilities: ['secret_goal']
  },
  twinLovers: {
    key: 'twinLovers',
    name: makeName('Jumeaux amoureux', 'Twin Lovers'),
    faction: 'village',
    unique: false,
    description: makeDescription('Deux joueurs gagnent ensemble selon la variante.', 'Two players win together depending on variant.'),
    abilities: ['shared_fate']
  },
  mayor: {
    key: 'mayor',
    name: makeName('Maire', 'Mayor'),
    faction: 'village',
    unique: true,
    description: makeDescription('Tranche en cas d’égalité pendant le vote.', 'Breaks ties during daytime votes.'),
    abilities: ['tie_break']
  },
  whiteWitch: {
    key: 'whiteWitch',
    name: makeName('Sorcière blanche', 'White Witch'),
    faction: 'village',
    unique: true,
    description: makeDescription('Ne possède qu’une potion de soin.', 'Has only a healing potion.'),
    abilities: ['heal']
  },
  fox: {
    key: 'fox',
    name: makeName('Renard', 'Fox'),
    faction: 'village',
    unique: true,
    description: makeDescription('Détecte si un loup est proche.', 'Detects nearby wolves.'),
    abilities: ['sense']
  },
  raven: {
    key: 'raven',
    name: makeName('Corbeau', 'Raven'),
    faction: 'village',
    unique: true,
    description: makeDescription('Influence le vote par malédiction.', 'Influences daytime vote with curses.'),
    abilities: ['curse']
  },
  destroyerAngel: {
    key: 'destroyerAngel',
    name: makeName('Ange destructeur', 'Destroyer Angel'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Variante chaotique au but surprenant.', 'Chaotic variant with surprising goal.'),
    abilities: ['chaos']
  },
  silentSeer: {
    key: 'silentSeer',
    name: makeName('Voyante silencieuse', 'Silent Seer'),
    faction: 'village',
    unique: true,
    description: makeDescription('Voit les loups mais ne peut pas parler.', 'Sees the wolves but cannot reveal them.'),
    abilities: ['vision_silent']
  },
  wolfDog: {
    key: 'wolfDog',
    name: makeName('Chien-loup', 'Wolf-Dog'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Entre deux camps, mord mais ne tue pas.', 'Between both camps, can bite but not kill.'),
    abilities: ['bite']
  },
  loneWolf: {
    key: 'loneWolf',
    name: makeName('Loup-Garou solitaire', 'Lone Werewolf'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Gagne seul sans aide.', 'Wins alone without help.'),
    abilities: ['kill'],
    tags: ['wolf_like']
  },
  classicWolf: {
    key: 'classicWolf',
    name: makeName('Loup-Garou', 'Werewolf'),
    faction: 'wolves',
    unique: false,
    description: makeDescription('Élimine un joueur chaque nuit.', 'Eliminates one player every night.'),
    abilities: ['kill'],
    tags: ['wolf']
  },
  whiteWolf: {
    key: 'whiteWolf',
    name: makeName('Loup-Garou blanc', 'White Werewolf'),
    faction: 'neutral',
    unique: true,
    description: makeDescription('Elimine tous les autres joueurs, y compris les loups.', 'Eliminates every other player, including wolves.'),
    abilities: ['kill'],
    tags: ['wolf_like']
  },
  redWolf: {
    key: 'redWolf',
    name: makeName('Loup-Garou roux', 'Red Werewolf'),
    faction: 'wolves',
    unique: true,
    description: makeDescription('Se venge des votes contre lui.', 'Punishes those who vote against him.'),
    abilities: ['kill', 'retaliate'],
    tags: ['wolf']
  },
  alphaWolf: {
    key: 'alphaWolf',
    name: makeName('Loup-Garou alpha', 'Alpha Werewolf'),
    faction: 'wolves',
    unique: true,
    description: makeDescription('Guide les loups durant le vote.', 'Leads the wolves during voting.'),
    abilities: ['kill', 'influence'],
    tags: ['wolf', 'leader']
  }
}

const WOLF_KEYS = ['classicWolf', 'redWolf', 'alphaWolf']
const WOLF_LIKE_KEYS = ['whiteWolf', 'loneWolf']
const VILLAGE_KEYS = [
  'villager',
  'seer',
  'witch',
  'hunter',
  'littleGirl',
  'cupid',
  'thief',
  'elder',
  'guardianAngel',
  'savior',
  'madProtector',
  'villageFool',
  'idiot',
  'mayor',
  'whiteWitch',
  'fox',
  'raven',
  'silentSeer',
  'wolfDog',
  'twinLovers'
]

const NEUTRAL_KEYS = [
  'angel',
  'clown',
  'hogman',
  'piper',
  'madSeer',
  'secretPlayer',
  'destroyerAngel',
  'loneWolf',
  'whiteWolf'
]

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickUnique(pool, count, used) {
  const result = []
  for (const key of pool) {
    if (result.length >= count) break
    const def = ROLE_DEFINITIONS[key]
    if (!def) continue
    if (def.unique && used.has(key)) continue
    result.push(key)
    if (def.unique) used.add(key)
  }
  return result
}

export function getRoleDefinition(key) {
  return ROLE_DEFINITIONS[key] || ROLE_DEFINITIONS.villager
}

export function isWolfRole(roleKey) {
  return WOLF_KEYS.includes(roleKey)
}

export function isWolfLike(roleKey) {
  return isWolfRole(roleKey) || WOLF_LIKE_KEYS.includes(roleKey)
}

export function getRoleLabel(roleKey, lang = 'fr') {
  const def = getRoleDefinition(roleKey)
  return def.name?.[lang] || def.name?.fr || roleKey
}

export function getRoleDescription(roleKey, lang = 'fr') {
  const def = getRoleDefinition(roleKey)
  return def.description?.[lang] || def.description?.fr || ''
}

export function listRolesByFaction() {
  return {
    wolves: WOLF_KEYS.map(key => ROLE_DEFINITIONS[key]),
    wolfLike: WOLF_LIKE_KEYS.map(key => ROLE_DEFINITIONS[key]),
    village: VILLAGE_KEYS.map(key => ROLE_DEFINITIONS[key]),
    neutral: NEUTRAL_KEYS.map(key => ROLE_DEFINITIONS[key])
  }
}

export function generateRoleDistribution(playerCount) {
  const used = new Set()
  const roles = []
  const wolvesNeeded = Math.max(1, Math.floor(playerCount / 4))
  const wolfPool = shuffle(WOLF_KEYS)
  const wolfLikePool = shuffle(WOLF_LIKE_KEYS)
  const villagePool = shuffle(VILLAGE_KEYS)
  const neutralPool = shuffle(NEUTRAL_KEYS)

  const wolves = pickUnique(wolfPool, wolvesNeeded, used)
  roles.push(...wolves)

  if (wolves.length < wolvesNeeded && wolfLikePool.length) {
    roles.push(...pickUnique(wolfLikePool, wolvesNeeded - wolves.length, used))
  }

  while (roles.length < playerCount) {
    const candidates = shuffle([...villagePool, ...neutralPool, ...wolfPool, ...wolfLikePool, 'villager'])
    let added = false
    for (const key of candidates) {
      const def = ROLE_DEFINITIONS[key]
      if (!def) continue
      if (def.unique && used.has(key)) continue
      roles.push(key)
      if (def.unique) used.add(key)
      added = true
      break
    }
    if (!added) {
      roles.push('villager')
    }
  }

  return shuffle(roles.slice(0, playerCount))
}

export function hasTag(roleKey, tag) {
  const def = getRoleDefinition(roleKey)
  return def.tags?.includes(tag)
}
