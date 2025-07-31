# WipeCam Project Instructions

## Coding Rules
- File naming convention: `src/<lowerCamelCase>.ts`
- Add tests in `src/*.test.ts` for `src/*.ts`
- Use functions and function scope instead of classes
- Add `.ts` extension to imports for deno compatibility
- Do not disable any lint rules without explicit user approval
- Export a function that matches the filename, keep everything else private
- All lint errors must be fixed before committing code
- .oxlintrc.json must not be modified without user permission
- When importing Node.js standard library modules, use the `node:` namespace prefix (e.g., `import path from "node:path"`, `import fs from "node:fs"`)
- **IMPORTANT**: Always run `pnpm check` before committing to ensure all tests pass and code meets quality standards

## Error Handling Policy
- Do not throw exceptions in application code
- Use Result types for error handling instead of throwing
- Choose between neverthrow library or custom Result type from `src/utils/result.ts`
- All functions that can fail should return Result<T, E> instead of throwing

## Apple Developer Requirements
- Follow Apple's App Store guidelines for camera and privacy permissions
- Ensure proper entitlements for camera access
- Implement appropriate privacy descriptions in Info.plist
- Follow macOS app distribution requirements

## Project Structure
- Main application files: main.js, renderer.js, preload.js
- TypeScript source files in src/ directory
- Assets in assets/ directory
- Tests in src/*.test.ts files

## Build and Development
- Use `pnpm dev` to start development server
- Use `pnpm build` to build for distribution
- Use `pnpm test` to run tests
- TypeScript compilation output goes to dist/ directory 