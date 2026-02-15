# Plant Care PWA - Claude Memory

## Project Overview
Progressive Web App (PWA) for plant care management.
Stack: React 18 + TypeScript + Vite + IndexedDB (Dexie.js)

**Target:** Single-page installable web app that works on iPhone without App Store

## Tech Stack Decisions

### Framework & Build
- **React 18** with TypeScript
- **Vite** as bundler (fast, modern, simple)
- **vite-plugin-pwa** for PWA functionality
- **React Router v6** for navigation

### Data Persistence
- **IndexedDB** with Dexie.js (NOT AsyncStorage - that's React Native)
- Local-first: all data stored in browser
- No backend needed for MVP

### UI & Styling
- **Lucide React** for icons (tree-shakeable, lightweight)
- **CSS Modules** or Tailwind (TBD)
- Mobile-first responsive design

### Date Management
- **date-fns** (lighter than moment.js, tree-shakeable)

## Project Structure

```
/src
  /components      # Reusable UI components
    /common        # Buttons, inputs, cards
    /plants        # Plant-specific components
  /pages           # Main screens/routes
  /hooks           # Custom React hooks
  /db              # Dexie configuration
  /services        # API calls (Claude AI for tips)
  /types           # TypeScript interfaces
  /utils           # Helper functions
  /assets          # Images, icons
```

## Data Models

### Plant
```typescript
interface Plant {
  id: string;              // UUID
  photoURL: string;        // base64 or blob URL
  type: string;            // "Suculenta", "Cactus", etc.
  species: string;         // "Brighamia insignis"
  nickname?: string;       // Optional user-given name
  createdAt: Date;
  lastWatered: Date | null;
}
```

### WateringLog
```typescript
interface WateringLog {
  id: string;
  plantId: string;
  wateredAt: Date;
}
```

### UserSettings
```typescript
interface UserSettings {
  id: 'user-settings';
  location: {
    country: string;
    city?: string;
    coords?: { lat: number; lon: number };
  };
  notificationsEnabled: boolean;
  notificationTime: string; // "09:00"
}
```

## MVP Features (Phase 1)

### ✅ Must Have
1. Add plant (photo via camera API, type dropdown, species text, nickname)
2. "Mi Jardín" list (visual cards with photo, name, next watering)
3. Location setup (geolocation API or manual country selection)
4. AI watering tips (Claude API based on: plant type + species + location + season)
5. Weekly watering calendar per plant (last 7 days with checkmarks)
6. "Mark as Watered" button (logs date/time)
7. Push notifications (configurable daily reminders)

### ❌ NOT in MVP (Phase 2)
- AI plant identification from photo
- Statistics/analytics
- Export/import data
- Multiple gardens
- Social features

## Code Conventions

### Naming
- Components: PascalCase (PlantCard.tsx)
- Hooks: camelCase with 'use' prefix (usePlantData.ts)
- Utils: camelCase (formatDate.ts)
- Types: PascalCase (Plant.ts)
- CSS Modules: [ComponentName].module.css

### TypeScript
- Always explicit types for props
- Define interfaces in separate types/ folder for reuse
- Use TypeScript utility types: Partial, Pick, Omit when helpful

### React Patterns
- Functional components only
- Custom hooks for data fetching and business logic
- Keep components under 150 lines
- Use React.memo() for expensive list items

### Dexie.js Patterns
```typescript
// ✅ DO: Use hooks from dexie-react-hooks
const plants = useLiveQuery(() => db.plants.toArray());

// ✅ DO: Handle loading states
if (!plants) return <Loading />;

// ❌ DON'T: Query Dexie in useEffect manually (use hooks)
```

### PWA Specific
- Test camera API with error handling (not all browsers support)
- Check notification permissions before showing UI
- Handle offline state gracefully
- Optimize images before storing (max 800px width)

## Common Patterns

### Adding a Plant
```typescript
const addPlant = async (data: Omit<Plant, 'id' | 'createdAt'>) => {
  await db.plants.add({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  });
};
```

### Camera Access
```typescript
// Always check permission first
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// Handle errors gracefully
```

### Notifications
```typescript
// Check permission
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  // Schedule notification
}
```

## Dependencies

### Core
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.22.0",
  "dexie": "^4.0.1",
  "dexie-react-hooks": "^1.1.7",
  "lucide-react": "^0.344.0",
  "date-fns": "^3.3.1"
}
```

### Dev
```json
{
  "vite": "^5.1.0",
  "@vitejs/plugin-react": "^4.2.1",
  "vite-plugin-pwa": "^0.19.0",
  "typescript": "^5.3.3"
}
```

## Error Prevention

### Camera Issues
```typescript
// ❌ BAD: Assume camera exists
const stream = await navigator.mediaDevices.getUserMedia({ video: true });

// ✅ GOOD: Check first
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  alert('Tu navegador no soporta acceso a cámara');
  return;
}
```

### IndexedDB
```typescript
// ✅ GOOD: Always handle errors
try {
  await db.plants.add(plant);
} catch (error) {
  console.error('Error saving plant:', error);
  // Show user-friendly message
}
```

### Date Handling
```typescript
// ✅ DO: Use date-fns for all date operations
import { formatDistanceToNow, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

// Show "hace 3 días" in Spanish
formatDistanceToNow(plant.lastWatered, { locale: es, addSuffix: true });
```

## Testing Strategy (TBD)
- Start with manual testing in browser
- Add Vitest for critical utils later
- Test PWA installation on real iPhone
- Test camera/notifications on different browsers

## Deployment
- **Netlify** or **Vercel** (both free for PWA)
- Enable HTTPS (required for camera, geolocation, notifications)
- Add to manifest.json for "Add to Home Screen"

## Learning Notes

### PWA Concepts to Understand
- Service Workers (for offline functionality)
- Web App Manifest (for installation)
- IndexedDB (browser database)
- Camera API (getUserMedia)
- Notification API
- Geolocation API

### React Patterns
- Custom hooks for data fetching
- Context for global state (if needed)
- React Router for navigation

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Using React Native APIs
```typescript
// DON'T - AsyncStorage is React Native only
import AsyncStorage from '@react-native-async-storage/async-storage';

// DO - Use IndexedDB with Dexie
import { db } from './db/database';
```

### ❌ Mistake 2: Not optimizing images
```typescript
// DON'T - Store full-res camera photos
const photoURL = imageBlobURL; // Could be 5MB

// DO - Compress before storing
const compressedPhoto = await compressImage(imageBlobURL, { maxWidth: 800 });
```

### ❌ Mistake 3: Forgetting browser compatibility
```typescript
// DON'T - Assume all features work
navigator.mediaDevices.getUserMedia();

// DO - Feature detection
if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
  // Safe to use camera
}
```

## Current Status
- [x] Project planning
- [x] Tech stack decisions
- [ ] Project creation (NEXT STEP)
- [ ] Basic structure setup
- [ ] Database configuration
- [ ] First component

---

Last updated: 2025-02-01
Mistakes caught by this file: 0 (just started!)
