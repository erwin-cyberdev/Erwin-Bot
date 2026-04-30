#!/bin/bash
# start.sh — Script de lancement Erwin-Bot

set -e

echo "🤖 Erwin-Bot — Script de démarrage"
echo "════════════════════════════════════"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé. Installe-le avec:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ requis. Version actuelle: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trouvé."
    exit 1
fi

echo "✅ npm $(npm -v)"

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env non trouvé !"
    echo "   Copie .env.example vers .env et remplis les valeurs."
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

echo "✅ Fichier .env trouvé"

# Créer les dossiers nécessaires
mkdir -p auth_info data logs tmp temp_media temp

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install --production
fi

echo "✅ Dépendances installées"

# Vérifier les dépendances
echo "🔍 Vérification des dépendances..."
node check-deps.js 2>/dev/null || echo "⚠️  Certaines dépendances optionnelles manquent"

echo ""
echo "🚀 Démarrage du bot..."
echo "════════════════════════════════════"

exec node index.js
