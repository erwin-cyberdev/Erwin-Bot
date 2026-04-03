# 🤖 Erwin-Bot

Erwin-Bot is a modular and powerful WhatsApp bot built with Node.js, Baileys, and Groq AI. It supports text conversation, image analysis, audio transcription, and many utility commands.

## ✨ Features

- **AI Powered**: Integrated with Groq (Llama 3, Whisper, Vision).
- **Stateful Chat**: Responds with memory (up to 10 messages context).
- **Multimedia**: Download YouTube, TikTok, Instagram content.
- **Utilities**: Weather, News, Movies, Crypto, and more.
- **Group Management**: Anti-link, Anti-delete, Welcome/Goodbye messages.

## 🚀 Getting Started

### Prerequisites

- Node.js (>= 18)
- A Groq API Key ([Get it here](https://console.groq.com/keys))

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/Erwin-Bot.git
   cd Erwin-Bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your info and keys
   ```

4. Verify dependencies:
   ```bash
   npm run check
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## ⚙️ Configuration

Edit the `.env` file to set your:
- `PREFIX`: Command prefix (default is `-`).
- `OWNER_NUMBER`: Your WhatsApp number (required for admin commands).
- `GROQ_API_KEY`: Required for all AI features.

## 🛠️ Main Commands

- `-ai <prompt>`: Simple AI query.
- `-chat <message>`: Stateful AI conversation.
- `-transcribe`: Reply to a voice note to transcribe it.
- `-meteo <city>`: Get weather info.
- `-movie <title>`: Get movie details.

## 📄 License

This project is licensed under the ISC License.
