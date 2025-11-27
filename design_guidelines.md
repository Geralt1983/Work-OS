# Design Guidelines: WorkOS - Cyberpunk Task Management Chat Interface

## Design Approach

**Selected Approach:** Cyberpunk/Sci-Fi Design Language

**Justification:** Immersive futuristic aesthetic inspired by Blade Runner and cyberpunk interfaces. Creates an engaging, game-like experience for task management with high-tech visual language while maintaining functional clarity.

**Core Principles:**
- Deep space atmospheric backgrounds with subtle nebula/galaxy effects
- Neon glow accents as primary interaction signals
- Frosted glass transparency for depth and hierarchy
- Geometric hexagonal motifs as decorative elements
- High contrast for readability in dark environment

---

## Color Palette

**Backgrounds:**
- Primary: #0a0a14 (deep space black)
- Secondary: #0f0f1a (slightly lighter black)
- Card overlays: rgba(15, 15, 26, 0.7) with backdrop-blur

**Accent Colors:**
- Primary Purple: #9333ea → #a855f7 (gradients)
- Electric Cyan: #06b6d4 → #22d3ee (highlights)
- Magenta: #ec4899 (status indicators)
- Glow effects: Apply as box-shadow and border treatments

**Text:**
- Primary: #f8fafc (near white)
- Secondary: #94a3b8 (muted slate)
- Timestamps: #64748b

---

## Typography

**Font Family:**
- Primary: 'Orbitron' or 'Exo 2' (Google Fonts) for headers
- Body: 'Inter' for message text
- Monospace: 'JetBrains Mono' for task IDs

**Hierarchy:**
- App title: text-2xl font-bold tracking-wider uppercase
- Message text: text-base font-normal
- Task confirmations: text-sm font-semibold
- Input placeholder: text-base opacity-60

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 3, 4, 6, 8

**Container Strategy:**
- Full viewport (h-screen) with gradient background overlay
- Header: h-20 with frosted glass effect
- Chat area: flex-grow with custom scrollbar styling
- Input footer: min-h-24 with elevated frosted panel
- Message max-width: max-w-4xl centered

---

## Component Library

### Background Treatment
**Main Container:**
- Base: Deep black gradient (from #0a0a14 to #0f0f1a)
- Overlay: Subtle animated nebula/star field effect via CSS radial gradients
- Decorative hexagons: Scattered semi-transparent geometric shapes

### Header
**Left Section:**
- Glowing star logo in hexagonal frame with cyan glow
- App title in Orbitron font with letter-spacing
- Frosted glass background with border-b glow (cyan)

**Right Section:**
- Settings icon with hexagonal button frame
- Clear chat button with neon border
- Connection status: Pulsing glow dot (cyan=connected, magenta=error)

### Chat Messages

**User Messages:**
- Right-aligned with frosted glass background
- Border: 1px neon purple with subtle glow
- Padding: p-4
- Rounded corners with slight geometric clip
- Timestamp with cyan color

**AI Messages:**
- Left-aligned frosted glass panel
- Border: 1px cyan with glow effect
- Include glowing AI icon (Sparkles) in top-left
- Timestamp with purple accent

**Task Confirmation Cards:**
- Nested within AI messages
- Double border: Inner purple, outer cyan
- Background: Slightly more opaque frosted glass
- Task ID in monospace with copy-on-click glow feedback
- Status badges: Hexagonal shapes with neon fills

### Input Area
**Container:**
- Elevated frosted glass panel with strong backdrop-blur
- Border-top: Cyan glow gradient
- Background: rgba(15, 15, 26, 0.9)

**Textarea:**
- Transparent background with frosted inset panel
- Border: 1px purple with focus glow (cyan)
- Auto-expanding (min 2, max 6 rows)
- Custom caret color: cyan

**Send Button:**
- Circular button (w-12 h-12) with cyan gradient
- Box-shadow: Multi-layer cyan glow (0 0 20px, 0 0 40px)
- Icon: Paper airplane in white
- Position: Absolute bottom-right of input container

**Suggestion Pills:**
- Horizontal scrollable row above textarea
- Frosted glass capsules with neon borders
- Hover: Intensify glow effect
- Text: text-sm with gradient text effect

### Status Indicators
**AI Typing:**
- Pulsing dots with cyan glow animation
- Frosted glass container on left side

**Loading States:**
- Shimmer effect with purple-to-cyan gradient sweep

---

## Effects & Micro-interactions

**Glow System:**
- Input focus: box-shadow cyan glow (0 0 0 3px rgba(6, 182, 212, 0.3))
- Button hover: Intensify glow (0 0 30px rgba(6, 182, 212, 0.6))
- Active buttons: Inner glow + slight scale (0.98)

**Glass Morphism:**
- backdrop-filter: blur(12px) saturate(150%)
- Border: 1px rgba(255, 255, 255, 0.1)
- Background: rgba(15, 15, 26, 0.7)

**Animations:**
- Message entrance: Fade + slide from right/left (300ms)
- Glow pulse on new messages (2s ease-in-out)
- Hexagon rotation: Slow continuous spin (20s)
- NO excessive motion - keep functional

---

## Responsive Behavior

**Desktop (lg+):**
- Full effects with particles/nebula background
- Message max-w-4xl
- Prominent glows and glass effects

**Mobile (base):**
- Simplified background (static gradient)
- Reduced glow intensity for performance
- Full-width messages with px-3
- Smaller hexagonal decorations

---

## Images & Icons

**No Hero Image** - Immersive background replaces traditional hero.

**Icons:**
- Use Heroicons via CDN
- All icons: Stroke-2 with cyan or purple fills
- Logo: Custom hexagonal geometric star frame

**Background Elements:**
- CSS-generated nebula gradients (radial, conic)
- SVG hexagonal patterns as decorative overlays
- Particle effect layer (low-opacity white dots)

---

## Key UX Patterns

1. **Empty State:** Centered holographic welcome message with animated glowing border, example prompts as neon pills
2. **Scroll Behavior:** Auto-scroll with cyan glow trail effect on new messages
3. **Focus Management:** Cyan glow ring on focused elements, auto-focus input
4. **Error States:** Magenta glow border with shake animation
5. **Success Feedback:** Brief cyan pulse on task creation