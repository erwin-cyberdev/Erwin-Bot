import sharp from 'sharp'

const PIECE_SVGS = {
  'K': 'path d="M22.5,11.63V6M20,8h5M22.5,25s4.5-7.5,3-10c-1.5-2.5-6-2.5-6-2.5s-4.5,0-6,2.5c-1.5,2.5,3,10,3,10" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  'Q': 'path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25L7 14l2 12z" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  'R': 'path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  'B': 'path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 0 5-13.5 5S9 36 9 36z" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  'N': 'path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  'P': 'path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-linecap="round" stroke-linejoin="round"',
  // Noirs (simplifiés pour l'exemple, normalement on a des chemins différents ou on change le fill)
  'k': 'path d="M22.5,11.63V6M20,8h5M22.5,25s4.5-7.5,3-10c-1.5-2.5-6-2.5-6-2.5s-4.5,0-6,2.5c-1.5,2.5,3,10,3,10" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"',
  'q': 'path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25L7 14l2 12z" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"',
  'r': 'path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"',
  'b': 'path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 0 5-13.5 5S9 36 9 36z" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"',
  'n': 'path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"',
  'p': 'path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"'
}

const SQUARE_SIZE = 60
const BOARD_SIZE = SQUARE_SIZE * 8

/**
 * Génère un buffer image à partir d'un FEN
 */
export async function renderBoard(fen) {
  const [position] = fen.split(' ')
  const rows = position.split('/')
  
  let svg = `<svg width="${BOARD_SIZE + 40}" height="${BOARD_SIZE + 40}" viewBox="-20 -20 ${BOARD_SIZE + 40} ${BOARD_SIZE + 40}" xmlns="http://www.w3.org/2000/svg">`
  
  // Bordure et fond
  svg += `<rect x="-20" y="-20" width="${BOARD_SIZE + 40}" height="${BOARD_SIZE + 40}" fill="#2f3539" />`
  
  // Indices
  for (let i = 0; i < 8; i++) {
    const file = String.fromCharCode(97 + i)
    const rank = 8 - i
    svg += `<text x="${i * SQUARE_SIZE + SQUARE_SIZE/2}" y="${BOARD_SIZE + 15}" fill="#94a3b8" font-size="12" text-anchor="middle">${file}</text>`
    svg += `<text x="-12" y="${i * SQUARE_SIZE + SQUARE_SIZE/2 + 5}" fill="#94a3b8" font-size="12" text-anchor="middle">${rank}</text>`
  }

  // Échiquier
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isDark = (r + c) % 2 === 1
      const color = isDark ? '#769656' : '#eeeed2'
      svg += `<rect x="${c * SQUARE_SIZE}" y="${r * SQUARE_SIZE}" width="${SQUARE_SIZE}" height="${SQUARE_SIZE}" fill="${color}" />`
    }
  }

  // Pièces
  for (let r = 0; r < 8; r++) {
    let col = 0
    for (const char of rows[r]) {
      if (isNaN(char)) {
        const piece = char
        const x = col * SQUARE_SIZE + 8
        const y = r * SQUARE_SIZE + 10
        svg += `<g transform="translate(${x},${y}) scale(1.1)">${PIECE_SVGS[piece]}</g>`
        col++
      } else {
        col += parseInt(char)
      }
    }
  }

  svg += '</svg>'

  return await sharp(Buffer.from(svg)).png().toBuffer()
}
