# Scholar AI

An intelligent academic assistant built with React, TypeScript, and Google Gemini 2.5 Flash. Designed to help students, researchers, and professionals with writing, research, coding, and studying — entirely in the browser with no backend required.

## Features

- **Chat Interface** — Streaming responses with full Markdown and syntax-highlighted code block support
- **Document Upload** — Supports PDF, DOCX, PPTX, XLSX, TXT, ZIP, and source code files
- **In-Browser RAG** — Automatically extracts, chunks, and embeds uploaded documents using TF-IDF; retrieves relevant context before every response
- **Rubric System** — Define custom evaluation criteria that are applied to every AI response
- **Specialized Modes** — Essay, Project Management, Programming, Study, and General modes
- **Writing Tone Control** — Switch between Academic, Professional, Casual, and Technical tones
- **Session Privacy** — All uploaded files and messages live in browser memory only and are deleted when the tab closes

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Model:** Google Gemini 2.5 Flash (via Gemini API)
- **File Parsing:** pdf.js, mammoth, xlsx, jszip
- **State Management:** Zustand
- **Deployment:** Netlify

## Getting Started

### Prerequisites

- Node.js 18+
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)

### Installation

```bash
cd scholar-ai
npm install
npm run dev
```

Open `http://localhost:5173`, enter your Gemini API key, and start chatting.

### Build for Production

```bash
npm run build
```

Output is in `scholar-ai/dist/`.

## Deployment

This project is configured for one-click Netlify deployment.

1. Connect this repository to Netlify
2. Set **Base directory** to `scholar-ai`
3. Set **Build command** to `npm run build`
4. Set **Publish directory** to `scholar-ai/dist`
5. Deploy

## Privacy

- No backend, no database, no authentication
- Your Gemini API key is stored in `localStorage` on your device only
- Uploaded documents are stored in browser memory and deleted when the session ends
- No data is sent to any server other than the Gemini API

## License

MIT
