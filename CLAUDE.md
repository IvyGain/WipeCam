# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WipeCam is an AI-powered background removal camera application built with Electron and TypeScript. It provides real-time transparent background segmentation using MediaPipe Selfie Segmentation, with a floating transparent window that stays on top of other applications.

## Architecture

### Core Architecture Pattern
The application follows a modular TypeScript architecture with clear separation of concerns:

- **Main Process** (`src/main.ts`): Electron main process handling window management, global shortcuts, and IPC
- **Renderer Process** (`src/renderer.ts`): Main application orchestrator integrating all modules
- **Modular Components**: Specialized managers for different concerns

### Key Modules
- `CameraManager`: Handles camera device enumeration, streaming, and macOS-specific background processing
- `SegmentationManager`: Integrates MediaPipe for AI-powered background removal with fallback to native macOS processing
- `UIManager`: Manages window activation states, modal display, and user interface feedback
- `WindowManager`: Utility for Electron window operations (minimal implementation)

### Dual-Build System
The project supports two build targets:
- **Standard Version**: Full-featured with global shortcuts and unrestricted window operations
- **App Store Version**: Sandboxed with restricted permissions for Mac App Store distribution

Files ending with `-appstore.ts/js/html/css` are App Store variants with modified functionality.

## Essential Commands

### Development
```bash
# Start development with TypeScript compilation and Electron
pnpm dev

# TypeScript compilation only  
pnpm build:ts

# Run type checking without compilation
pnpm typecheck

# Run tests and type checking (recommended before commits)
pnpm check

# Watch mode for tests
pnpm test:watch
```

### Testing
```bash
# Run all tests once
pnpm test

# Test specific file
npx vitest src/camera.test.ts

# Run tests with coverage
npx vitest --coverage
```

### Building for Distribution
```bash
# Build for all platforms
pnpm build

# Platform-specific builds
pnpm build:mac    # macOS DMG
pnpm build:win    # Windows NSIS installer  
pnpm build:linux  # Linux AppImage
```

## TypeScript Configuration

### Module System
- Uses ES modules with `.js` extensions in imports for compatibility
- Target: ESNext with bundler module resolution
- Strict mode enabled with comprehensive type checking
- Source maps and declaration files generated

### Import Patterns
```typescript
// Always use .js extension for local imports
import { CameraManager } from './camera.js';

// Use node: namespace for Node.js standard library
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

## Key Technical Patterns

### Background Processing
The application uses a dual-strategy approach for background removal:
1. **MediaPipe Integration**: Cross-platform AI-based segmentation
2. **macOS Native**: Hardware-accelerated background processing when available

### State Management
- LocalStorage for persistent settings (camera selection, background removal state, colors)
- Reactive UI updates based on state changes
- Window activation with auto-hide timeout (5 seconds)

### IPC Communication
- Main process handles window operations and global shortcuts
- Renderer process manages UI and camera processing
- Type-safe IPC with defined interfaces in `types.ts`

### Error Handling Strategy
- Graceful degradation when camera access is denied
- Automatic fallback between processing modes
- User-friendly error messages with system setting guidance

## MediaPipe Integration

### Loading Pattern
MediaPipe is loaded via CDN script tag in HTML, then initialized asynchronously:
```typescript
// Lightweight model for performance
selfieSegmentation.setOptions({
  modelSelection: 0, // Use lightweight model
  selfieMode: true,
});
```

### Canvas Processing
- Real-time video processing using requestAnimationFrame
- Efficient canvas operations with composite operations for transparency
- Support for custom background colors and transparency

## Window Management Specifics

### Transparent Floating Window
- Frameless design with custom window controls
- Always-on-top behavior across all workspaces
- Four-corner resize handles with aspect ratio maintenance
- Drag-to-move functionality with click detection

### macOS Specific Features
- Proper entitlements for camera access
- Native background processing API integration
- Screen-saver level window priority

## Testing Architecture

### Test Environment
- Vitest with jsdom environment for DOM testing
- Comprehensive mocking for Electron APIs and browser APIs
- Integration tests for module interactions

### Mock Patterns
```typescript
// Electron API mocking
vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  // ...
}));

// DOM element mocking for UI tests
Object.defineProperty(global, 'document', {
  value: { getElementById: mockGetElement }
});
```

## App Store Compliance

### Sandboxing Considerations
- App Store version removes global shortcuts (system limitation)
- In-app keyboard shortcuts replace global hotkeys
- File system access through system dialogs only
- Camera permissions handled through entitlements

### Entitlements Required
- Camera access
- Outgoing network connections (for MediaPipe CDN)
- Appropriate sandbox entitlements for App Store distribution

## Build Optimization

The build process is streamlined with combined commands:
- `pnpm build:all`: Compiles both main and renderer TypeScript
- Separate main.ts compilation for proper Electron integration
- Source maps enabled for debugging
- Declaration files for better IDE support