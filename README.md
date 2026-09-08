# Slides Auto

A browser-based editor for composing vertical slideshow content from a script.

## Development

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

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
