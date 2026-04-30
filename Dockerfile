FROM node:18-bullseye-slim

# Mettre à jour les paquets et installer les dépendances nécessaires pour FFmpeg et Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg ffmpeg libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurer Puppeteer pour qu'il n'ait pas à télécharger Chromium (il utilisera les lib C installées)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Variables environnement Render
ENV NODE_ENV=production
ENV PORT=10000

# Création du dossier app
WORKDIR /usr/src/app

# Copier le package.json
COPY package*.json ./

# Installation des modules NPM
RUN npm install --production

# Copier le code source de l'application
COPY . .

# Exposer le web server (pour les health checks Render)
EXPOSE 10000

# Démarrer l'application
CMD [ "npm", "start" ]
