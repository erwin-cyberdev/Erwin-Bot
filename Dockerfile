FROM docker.io/library/node:20-bullseye-slim@sha256:65ef49f7d24aefd012a7fc6f9a2b734bcc19e424976a81f60c86b47266ef5b28

# Définir le répertoire de travail
WORKDIR /usr/src/app

# Copier les fichiers package
COPY package*.json ./

# Installer les dépendances système
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ffmpeg \
    chromium \
    python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ✅ CORRIGÉ: npm install SANS --production pour avoir TOUTES les dépendances
RUN npm install

# Installer puppeteer et chromium
RUN npx puppeteer browsers install chrome || true

# Rebuild sharp (optionnel)
RUN npm rebuild sharp || true

# Copier le reste du code
COPY . .

# Exposer le port (optionnel, pour la health API si tu la rajoutes)
EXPOSE 3000

# Commande de démarrage
CMD ["node", "index.js"]
