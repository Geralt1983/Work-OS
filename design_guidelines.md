# Design Guidelines: ClickUp AI Task Management Chat Interface

## Design Approach

**Selected Approach:** Apple-inspired minimalist design

**Justification:** Clean, sophisticated aesthetic that prioritizes clarity and elegance. Inspired by Apple's design language with generous white space, subtle shadows, and refined typography.

**Core Principles:**
- Simplicity and clarity above all
- Generous white space and breathing room
- Subtle, elegant interactions
- System-native feeling
- Distraction-free focus

---

## Typography

**Font Family:**
- Primary: SF Pro Display / system-ui fallback
- Monospace: SF Mono / ui-monospace for task IDs

**Hierarchy:**
- App title/header: text-xl font-semibold tracking-tight
- Message text: text-base font-normal
- Task confirmations: text-sm font-medium
- Timestamps: text-xs
- Input placeholder: text-base

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 3, 4, 6, and 8
- Component padding: p-4, p-6
- Message spacing: space-y-4
- Input margins: m-3, m-4
- Header/footer: p-4

**Container Strategy:**
- Full viewport height layout (h-screen)
- Fixed header (h-16)
- Flex-grow chat area
- Fixed input footer (min-h-20)
- Max-width for messages: max-w-3xl centered

---

## Component Library

### Layout Structure
**Main Container:**
- Three-section vertical layout: Header → Messages → Input
- Header: Logo/title left, settings/clear right
- Messages: Scrollable area with auto-scroll to bottom
- Input: Fixed bottom with textarea and send button

### Chat Messages
**User Messages:**
- Right-aligned (ml-auto)
- Rounded containers with subtle border
- Max-width constraint for readability
- Timestamp below message (text-right)

**AI Messages:**
- Left-aligned (mr-auto)
- Distinct visual treatment from user messages
- Include AI indicator icon
- Timestamp below message (text-left)

**Task Confirmation Cards:**
- Embedded within AI messages
- Border accent for visibility
- Contains: Task title, task ID, status badge, due date
- Compact layout (p-3)
- Clickable/copyable task ID

### Input Area
**Textarea:**
- Auto-expanding height (min 2 rows, max 8 rows)
- Rounded corners
- Clear focus states
- Placeholder: "Tell me about your tasks or what you'd like to do..."

**Send Button:**
- Icon-based (paper plane or arrow)
- Position: Bottom-right of textarea container
- Size: w-10 h-10
- Always visible

### Header
**Left Section:**
- App title: "ClickUp Assistant"
- Subtitle: "Manage tasks naturally" (text-sm)

**Right Section:**
- Clear chat button (icon + text)
- Settings icon (future functionality)

### Status Indicators
**Loading State:**
- Pulsing dots animation when AI is thinking
- "AI is typing..." indicator

**Connection Status:**
- Small badge in header showing ClickUp connection status
- Green dot: Connected, Red dot: Disconnected

---

## Micro-interactions

**Keep Minimal:**
- Smooth scroll to new messages (scrollBehavior: 'smooth')
- Fade-in for new messages (200ms)
- Subtle hover on interactive elements
- NO complex animations or transitions

**Focus Management:**
- Auto-focus input after sending message
- Clear visual focus indicators on all interactive elements

---

## Responsive Behavior

**Desktop (lg+):**
- Center-aligned chat with max-w-3xl
- Comfortable padding (px-6)

**Tablet (md):**
- Full-width messages with px-4

**Mobile (base):**
- Full-width layout
- Reduced padding (px-3)
- Smaller text sizes where appropriate
- Fixed header and input for consistent UX

---

## Images

**No hero images needed** - this is a focused chat application.

**Icons:**
- Use Heroicons via CDN
- Send icon: PaperAirplaneIcon
- Settings: CogIcon
- Clear: TrashIcon
- AI indicator: SparklesIcon
- Task status badges: CheckCircleIcon, ClockIcon, etc.

---

## Key UX Patterns

1. **Empty State:** When no messages, show centered welcome message with example prompts
2. **Message Grouping:** Group consecutive messages from same sender with reduced spacing
3. **Scroll Behavior:** Always auto-scroll to latest message, with manual scroll override
4. **Input Focus:** Keep input focused for rapid conversation flow
5. **Error States:** Clear inline error messages for API failures