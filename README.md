# vibe-code-trigger-e2b

A Next.js-based coding platform that uses Trigger.dev workflows and E2B sandboxes for code execution.

## Features

- **Trigger.dev Integration**: Uses Trigger.dev v4 for workflow orchestration
- **E2B Sandboxes**: Executes code in isolated, ephemeral Linux containers
- **AI-Powered**: Integrated with AI SDK for intelligent code generation and execution
- **Real-time Logging**: Streams command output in real-time using Server-Sent Events (SSE)

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Set up your environment variables in `.env.local`:

```env
E2B_API_KEY=your_e2b_api_key
TRIGGER_API_KEY=your_trigger_api_key
AI_GATEWAY_BASE_URL=your_ai_gateway_url
```

Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- **Next.js 15.5.4** - React framework
- **Trigger.dev 4.1.2** - Workflow orchestration
- **E2B 2.8.2** - Sandbox execution environment
- **AI SDK 5.0.59** - AI integration
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Project Structure

- `trigger/` - Trigger.dev workflow definitions
- `ai/tools/` - AI tools for sandbox management
- `app/api/` - Next.js API routes
- `components/` - React components

## License

MIT
