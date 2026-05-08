import puppeteer from 'puppeteer'

let browserInstance = null
let isLaunching = false

export async function getBrowser() {
  if (browserInstance) return browserInstance
  if (isLaunching) {
    await new Promise(resolve => {
      const check = () => {
        if (browserInstance) resolve(browserInstance)
        else setTimeout(check, 200)
      }
      check()
    })
    return browserInstance
  }

  isLaunching = true
  try {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-zygote',
        '--disable-gpu'
      ]
    })
    return browserInstance
  } catch (err) {
    console.error('Erreur lancement Puppeteer:', err)
    throw err
  } finally {
    isLaunching = false
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close()
    } catch (err) {
      console.error('Erreur fermeture navigateur:', err)
    }
    browserInstance = null
  }
}
