FROM node:20-bullseye-slim

# Installer les dépendances système (FFmpeg + Chromium pour Puppeteer)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget gnupg ffmpeg chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer : utiliser le Chromium système (pas de téléchargement)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Variables environnement
ENV NODE_ENV=production

# Création du dossier app
WORKDIR /usr/src/app

# Copier le package.json et installer les dépendances
COPY package*.json ./
RUN npm install --production --ignore-scripts \
    && npx puppeteer browsers install chrome || true

# Rebuild les modules natifs (sharp)
RUN npm rebuild sharp || true

# Copier le code source
COPY . .

# Démarrer l'application
CMD [ "npm", "start" ]
