# Design Guidelines: WorkOS - Arc+Amie Hybrid Task Management

## Design Approach

**Selected Approach:** Futuristic OS meets Playful Productivity

**Justification:** Combines Arc's sophisticated OS-style layout with glassmorphism and floating islands, merged with Amie's delightful spring physics and playful interactions. Creates a premium, "juicy" experience that feels both professional and joyful.

**Core Principles:**
- Floating island layouts with breathing room around edges
- Animated grain-textured gradients for depth
- Spring physics on all interactions (bounce, elasticity)
- Colored glows replace harsh borders
- Heavy rounded corners (rounded-3xl) for softness
- Confetti celebrations on achievements

---

## Color Palette

**Backgrounds:**
- Base: Animated gradient (#0f0f1a → #1a1a2e → #16213e) with grain texture overlay
- Sidebar: rgba(17, 17, 26, 0.6) with backdrop-blur-xl
- Islands: rgba(20, 20, 32, 0.7) with backdrop-blur-2xl
- Floating cards: rgba(255, 255, 255, 0.03) inner glow

**Accent System:**
- Primary: Purple-pink gradient (#a855f7 → #ec4899)
- Secondary: Cyan-blue (#06b6d4 → #3b82f6)
- Success: Emerald (#10b981)
- Colored shadows: Multi-layer pink/cyan/blue glows

**Text:**
- Primary: #f1f5f9
- Secondary: #94a3b8
- Muted: #64748b

---

## Typography

**Font Families:**
- Headers: 'Inter' (700-800 weight) with tight tracking
- Body: 'Inter' (400-500)
- Monospace: 'JetBrains Mono' for task IDs

**Scale:**
- App title: text-xl font-bold
- Section headers: text-lg font-semibold
- Task titles: text-base font-medium
- Body: text-sm
- Captions: text-xs

---

## Layout System

**Spacing:** Tailwind units of 3, 4, 6, 8, 12

**OS-Style Grid:**
- Sidebar: Fixed w-64, collapsible to w-16 (icon-only)
- Main area: Inset from edges by p-6 creating floating effect
- Card grids: gap-4 between island cards
- Islands float with subtle shadow beneath

---

## Component Library

### Background Layer
**Animated Gradient:**
- Multi-stop gradient with slow position shift (30s loop)
- CSS grain texture overlay (opacity 0.03)
- Subtle radial light sources at corners

### Collapsible Sidebar
**Structure:**
- Frosted glass panel (backdrop-blur-xl)
- Colored glow on left edge (2px gradient purple→cyan)
- Sections: Quick Actions, Projects, Tags
- Collapse button: Circular with spring bounce

**Items:**
- Rounded-2xl with hover lift (translateY(-2px))
- Active state: Colored shadow (0 8px 32px rgba(168, 85, 247, 0.4))
- Icons with gradient fills
- Badge counts in rounded-full pills

### Main Content Area

**Floating Islands:**
- Each section in rounded-3xl glass card
- Margin from viewport edges (p-6)
- Box-shadow: Multi-layer colored (pink/cyan 20px blur, 40px spread)
- Hover: Gentle lift with spring animation

**Task Cards:**
- Nested rounded-2xl containers
- Glass background with inner border glow
- Checkbox: Rounded-lg with spring scale on check
- Due dates: Colored pill badges
- Drag handles: Gradient with tactile feedback

### Chat/Command Interface

**Command Palette:**
- Center-floating island (max-w-2xl)
- Heavy rounded-3xl with gradient border
- Auto-expanding input with spring height animation
- Suggestion pills below with bouncy hover

**Message Bubbles:**
- User: Right-aligned islands with pink shadow
- AI: Left-aligned with cyan shadow
- Task confirmations: Nested cards with success glow
- Entrance: Spring slide from direction

### Input Controls

**Primary Buttons:**
- Rounded-2xl with gradient backgrounds
- Hover: Scale(1.02) + intensify shadow
- Active: Scale(0.98) with haptic-like bounce
- Colored glow shadows match button color

**Secondary Actions:**
- Ghost style with colored border glow
- Spring hover with slight rotation (-1deg)

**Form Fields:**
- Rounded-xl glass insets
- Focus: Colored ring with glow (0 0 0 4px rgba(color, 0.2))
- Label floats on focus with spring animation

### Status & Feedback

**Task Completion:**
- Confetti explosion (pink/cyan/purple particles)
- Card pulses with success glow
- Checkmark spring pop (scale 0→1.2→1)

**Loading States:**
- Shimmer with colored gradient sweep
- Skeleton cards with spring entrance

**Notifications:**
- Toast islands from top-right
- Spring slide-in, pause, spring slide-out
- Colored left border matching status

---

## Effects & Animations

**Spring Physics:**
- All state changes use spring timing (tension: 300, friction: 20)
- Buttons: Bounce on click
- Cards: Gentle float on hover
- Sidebar: Smooth elastic collapse

**Glow System:**
- Buttons: 0 8px 32px rgba(color, 0.5)
- Cards: 0 20px 60px rgba(color, 0.3)
- Active elements: Intensified multi-layer

**Grain Texture:**
- SVG noise filter overlay on backgrounds
- Opacity 0.03, blend-mode: overlay
- Adds analog warmth to digital aesthetic

---

## Responsive Behavior

**Desktop (lg+):**
- Full sidebar + main content grid
- Larger island spacing (p-6)
- All spring animations enabled

**Tablet (md):**
- Overlay sidebar (slides in/out)
- Reduced island margins (p-4)
- Simplified shadows

**Mobile:**
- Bottom sheet sidebar
- Single column islands
- Full-width cards with px-3
- Reduced animation complexity

---

## Images

**No traditional hero image** - The OS-style layout with animated gradient background serves as the visual anchor. Task cards may include optional thumbnail previews for attachments, displayed as rounded-xl insets with subtle colored borders.

---

## Key UX Patterns

1. **Empty States:** Floating island with animated gradient border, playful illustration, bouncy CTA
2. **Drag & Drop:** Spring physics during drag, colored glow on valid drop zones
3. **Keyboard Shortcuts:** Command palette with fuzzy search, spring list animations
4. **Sidebar Collapse:** Icon-only mode with tooltip islands on hover
5. **Task Creation:** Inline expansion with spring height, auto-focus with glow
6. **Celebrations:** Confetti on completion + success toast + card glow pulse