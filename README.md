# neuralizard

**neuralizard** is an open-source AI chat and code assistant supporting multiple providers (OpenAI, Google, Perplexity, xAI, Mistral) with a modern frontend.

## Features

- Multi-provider LLM chat (OpenAI, Google Gemini, Perplexity, xAI, Mistral)
- Streaming responses
- Model selection
- Code highlighting
- Conversation history

## Getting Started

1. **Clone the repo:**
   ```sh
   git clone https://github.com/yourusername/neuralizard.git
   cd neuralizard
   ```

2. **Set up API keys:**
   - Copy `.env.example` to `.env` and add your provider keys.

3. **Run with Docker:**
   ```sh
   docker compose up --build
   ```

## Tech Stack

**Frontend:**  
- React (TypeScript)
- Vite
- Tailwind CSS
- shadcn/ui
- Redux Toolkit

**Backend:**  
- Python (FastAPI)
- WebSocket streaming

## License

MIT License © 2025 Clemens Buettner