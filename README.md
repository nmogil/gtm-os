# GTM OS

Go-to-Market Operating System - MVP Implementation

## Setup Instructions

### Prerequisites
- Node.js installed
- Convex account (sign up at https://convex.dev)

### Installation

1. **Dependencies are already installed**
   - All core dependencies have been installed via npm

2. **Initialize Convex Deployment**
   ```bash
   npx convex dev
   ```

   This will:
   - Prompt you to log in to Convex (if not already logged in)
   - Create a new project or select an existing one
   - Generate your CONVEX_DEPLOYMENT URL
   - Watch for changes in the `convex/` directory

3. **Configure Environment Variables**
   - Copy `.env.local` and add your API keys:
     - `OPENAI_API_KEY` - Your OpenAI API key
     - `RESEND_API_KEY` - Your Resend email API key
     - `SVIX_WEBHOOK_SECRET` - Your Svix webhook secret
   - The `CONVEX_DEPLOYMENT` will be auto-generated after running `npx convex dev`

### Project Structure

```
/convex
  /schema.ts          # Database schemas
  /http.ts            # HTTP endpoints
  /lib/               # Shared utilities
  /_generated/        # Convex generated files (auto-generated)
```

### Installed Dependencies

- `convex` (^1.27.3) - Convex backend platform
- `ai` (^5.0.59) - AI SDK
- `@ai-sdk/openai` (^2.0.42) - OpenAI integration
- `zod` (^4.1.11) - Schema validation
- `resend` (^6.1.2) - Email service
- `handlebars` (^4.7.8) - Email templating
- `svix` (^1.76.1) - Webhook management

## Development

Run the Convex development server:
```bash
npm run dev
```

This will start the Convex backend in watch mode.

## References
- Issue #1: Setup Convex project and install core dependencies
- PRD Sections: 5 (Database Schema), 9 (API Endpoints), 17.1 (Dependencies), 17.2 (Environment Variables)
