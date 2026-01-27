# AI Companion App Development Guidelines

This document provides essential context for AI assistants working with this Next.js-based AI companion application.

## Project Architecture

### Core Technologies
- **Framework**: Next.js 15.5 with App Router
- **Authentication**: Clerk (`@clerk/nextjs`)
- **Styling**: Tailwind CSS with custom theme configuration
- **UI Components**: Shadcn UI components (based on Radix UI)

### Key Project Structure
```
app/
├── (auth)/          # Authentication routes and layouts
├── (root)/          # Main application routes
├── components/      # Shared components
├── lib/            # Utilities and shared functions
└── globals.css     # Global styles and theme variables
```

### Authentication Flow
- Authentication is handled by Clerk
- Public routes: `/sign-in/*` and `/sign-up/*`
- Protected routes: Everything else (configured in `middleware.ts`)
- User sessions managed through `ClerkProvider` in root layout

## Development Workflows

### Local Development
```bash
npm run dev     # Runs with Turbopack for faster development
```

### Key Patterns

#### Component Architecture
- UI components use Shadcn's composition pattern with Radix UI primitives
- Custom variants defined through `class-variance-authority` (see `button.tsx`)
- Utility functions in `lib/utils.ts` for class name merging

#### Styling Conventions
- Custom theme defined in `globals.css` using CSS variables
- Dark mode support with `.dark` class variants
- Responsive design breakpoints: `md:` prefix for desktop styles
- Premium UI elements use gradient backgrounds (see `premium` button variant)

#### Layout Structure
- Nested layouts using Next.js 13+ conventions
- Authentication layout in `(auth)/layout.tsx`
- Main app layout in `(root)/layout.tsx`
- Navbar fixed positioning with responsive behaviors

### Important Files
- `middleware.ts`: Route protection and authentication rules
- `components.json`: UI component configurations and aliases
- `components/ui/button.tsx`: Example of complex component with variants
- `app/components/navbar.tsx`: Main navigation with responsive design

## Common Tasks

### Adding New Routes
1. Create folder under `app/(root)/routes/`
2. Add `page.tsx` for route content
3. Update navigation if needed in `navbar.tsx`

### Creating UI Components
1. Follow Shadcn patterns in `components/ui/`
2. Use `cva` for variant definitions
3. Implement proper TypeScript types
4. Utilize `cn()` utility for class merging

### Authentication Features
1. Use Clerk components (`UserButton`, `SignIn`, etc.)
2. Protected routes handled by middleware
3. Access user context via Clerk hooks

## Additional Notes
- The project uses `@` alias for root imports
- Premium features marked with gradient styles
- Mobile-first design with `md:` breakpoint as desktop