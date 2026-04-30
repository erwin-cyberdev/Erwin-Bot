# 🚀 Déploiement Erwin-Bot sur Azure VM

Guide complet pour déployer Erwin-Bot sur une machine virtuelle Azure Ubuntu.

---

## Prérequis

- Un compte Azure avec un abonnement actif
- Un numéro WhatsApp pour le bot

---

## Étape 1 : Créer la VM Azure

1. Connecte-toi au [Portail Azure](https://portal.azure.com)
2. Crée une **Machine Virtuelle** avec :
   - **Image** : Ubuntu Server 22.04 LTS
   - **Taille** : Standard B1s (1 vCPU, 1 Go RAM) — suffisant pour le bot
   - **Authentification** : Clé SSH (recommandé) ou mot de passe
   - **Ports entrants** : Autoriser SSH (22)

3. Note l'adresse IP publique après la création

---

## Étape 2 : Se connecter à la VM

```bash
ssh erwin@<IP_PUBLIQUE>
```

---

## Étape 3 : Installer Node.js 18+

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installer Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier
node -v   # Doit afficher v18.x.x ou plus
npm -v
```

---

## Étape 4 : Installer les outils nécessaires

```bash
# Git pour cloner le projet
sudo apt install -y git

# FFmpeg pour les stickers et la vidéo
sudo apt install -y ffmpeg

# Chromium pour les captures d'écran (optionnel)
sudo apt install -y chromium-browser
```

---

## Étape 5 : Cloner et configurer le projet

```bash
# Cloner le dépôt
cd /home/erwin
git clone https://github.com/erwin-cyberdev/Erwin-Bot.git
cd Erwin-Bot

# Copier et éditer la configuration
cp .env.example .env
nano .env
# → Remplis toutes les clés API nécessaires

# Installer les dépendances
npm install --production
```

---

## Étape 6 : Premier lancement (scan QR code)

```bash
# Lancer le bot manuellement pour scanner le QR code
node index.js
```

Un QR code apparaîtra dans le terminal. Scanne-le avec WhatsApp :
1. Ouvre WhatsApp → **Paramètres** → **Appareils liés**
2. Appuie sur **Lier un appareil**
3. Scanne le QR code dans le terminal

Après la connexion, arrête le bot avec `Ctrl+C`.

---

## Étape 7 : Configurer le service systemd

```bash
# Copier le fichier service
sudo cp erwin-bot.service /etc/systemd/system/

# Recharger systemd
sudo systemctl daemon-reload

# Activer le démarrage automatique
sudo systemctl enable erwin-bot

# Démarrer le bot
sudo systemctl start erwin-bot

# Vérifier le statut
sudo systemctl status erwin-bot
```

---

## Étape 8 : Configurer le firewall

```bash
# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser le port du bot (pour le dashboard web)
sudo ufw allow 3000/tcp

# Activer le firewall
sudo ufw enable

# Vérifier
sudo ufw status
```

---

## Commandes utiles

| Action | Commande |
|--------|----------|
| Démarrer le bot | `sudo systemctl start erwin-bot` |
| Arrêter le bot | `sudo systemctl stop erwin-bot` |
| Redémarrer le bot | `sudo systemctl restart erwin-bot` |
| Voir le statut | `sudo systemctl status erwin-bot` |
| Voir les logs en direct | `sudo journalctl -u erwin-bot -f` |
| Voir les 100 dernières lignes | `sudo journalctl -u erwin-bot -n 100` |
| Mettre à jour le bot | `cd /home/erwin/Erwin-Bot && git pull && npm install && sudo systemctl restart erwin-bot` |

---

## Dépannage

### Le bot ne démarre pas
```bash
# Vérifier les logs
sudo journalctl -u erwin-bot -n 50 --no-pager

# Tester manuellement
cd /home/erwin/Erwin-Bot && node index.js
```

### QR code expiré
```bash
# Supprimer la session et relancer
sudo systemctl stop erwin-bot
rm -rf auth_info/
node index.js
# → Scanner le nouveau QR code, puis Ctrl+C
sudo systemctl start erwin-bot
```

### Mémoire insuffisante
```bash
# Ajouter du swap (2 Go)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Le bot se déconnecte souvent
- Vérifie la connexion internet de la VM
- Augmente le `keepAliveIntervalMs` dans `index.js` si nécessaire
- Vérifie que WhatsApp est actif sur le téléphone principal
