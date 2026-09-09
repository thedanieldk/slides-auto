# Slides Auto

A browser-based editor for composing vertical slideshow content from a script.

## Development

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

## AI generation

Create `.env.local`, add your Anthropic API key, and restart the development
server:

```bash
ANTHROPIC_API_KEY=your_key_here
```

The key is read only by the server route and is never sent to the browser.
`ANTHROPIC_MODEL` is optional; the default is Claude Haiku 4.5.

The AI composer uses Claude Web Fetch to create a lightweight product profile
from a public product page. Profiles are reviewed by the user and stored only
in that browser for reuse in later slideshow generations.

## Project structure

- `app` — Next.js routes, layout, metadata, and global styles
- `components` — product components and reusable UI primitives
- `hooks` — reusable React hooks
- `lib` — slideshow models and composition logic
- `public` — static assets

## Adding components

Add shadcn components from the repository root:

```bash
npx shadcn@latest add button
```

Components are generated in `components/ui`.

## Using components

Import reusable UI components through the root alias:

```tsx
import { Button } from "@/components/ui/button"
```
