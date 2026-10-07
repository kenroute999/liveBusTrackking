# KenRoute Live Bus Tracking

Passenger-facing live bus tracking application for the KenRoute transportation platform.

Repository: https://github.com/kenroute999/liveBusTrackking.git

## Project Overview

KenRoute Live Bus Tracking provides real-time bus location visibility to passengers who have booked through the KenRoute ecosystem. Passengers can track their assigned bus using their PNR (Passenger Name Record) or registered mobile number.

This application connects to the existing KenRoute backend infrastructure and displays live conductor GPS updates through a web interface.

> **Status**: Architecture planning and integration design phase. This repository contains the tracking website specification and planned integration points with verified backend services.

## System Context

Live Bus Tracking operates within the existing KenRoute multi-application architecture:

```
Conductor Mobile (GPS source)
        ↓
Existing KenRoute Backend
        ↓
PostgreSQL (trip, manifest, booking state)
        ↓
Socket.IO / realtime channel
        ↓
Live Tracking Website (this project)
        ↓
Leaflet + OpenStreetMap (map rendering)
```

Verified references:
- Backend: https://github.com/kenroute999/backend.git
- Admin: https://github.com/kenroute999/kenroute-travel-admin.git
- Agent: https://github.com/kenroute999/kenroute-booking-suite-agent.git
- Conductor: https://github.com/kenroute999/kenroute-conductor.git

## Features

### Verified (existing backend integration)
- PNR-based passenger lookup against the existing booking database (verified: `GET /trips/:id/manifest`)
- Mobile number association (verified: conductor login uses `phone`; passenger `pnr` and seat number stored in `Booking` tables)
- Real-time trip status access (verified: `GET /conductor/trip/today`, trip status: `SCHEDULED`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`)
- Manifest data retrieval with passenger name, seat, boarding status (verified: `GET /trips/:id/manifest` returns `items` with `passengerName`, `seatNumber`, `pnr`, `boarded`)
- Booking status awareness (`CANCELLED`, `REFUNDED` handled by backend `REJECTION.BOOKING_CANCELLED`)

### Planned / design phase (requires backend GPS endpoint verification)
- Live conductor GPS tracking via Socket.IO
- Real-time bus location updates pushed to passenger web clients
- Interactive map display using Leaflet and OpenStreetMap tiles
- Automatic bus identification from PNR lookup (trip assignment to conductor verified; GPS endpoint requires confirmation)
- Offline cache for basic trip information (design only)

> **Note**: GPS tracking endpoints and Socket.IO event contracts for live location updates must be verified against the backend repository before implementation. The mobile `socket.service.ts` exists; the server-side GPS broadcast endpoint requires confirmation.

## Architecture

### Flow

1. **Passenger Input**: User enters PNR or mobile number on the tracking website.
2. **Backend Lookup**: Website calls existing verified backend endpoint `/trips/:tripId/manifest` (or proposed `/passenger/lookup` endpoint) to resolve the booking.
3. **Trip Resolution**: System identifies the assigned trip, bus registration, and current conductor.
4. **Realtime Channel**: Client connects via Socket.IO to receive conductor GPS broadcasts (requires verified endpoint).
5. **Map Rendering**: Leaflet renders bus position on OpenStreetMap tiles.

### Components

- **Frontend**: React 19 + Vite + TypeScript
- **Mapping**: Leaflet + OpenStreetMap (free tiles)
- **Realtime**: Socket.IO Client (connecting to verified backend Socket.IO service if confirmed)
- **API**: HTTP REST using existing verified endpoints; proposed GPS stream endpoint to be confirmed

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 |
| Build Tool | Vite |
| Language | TypeScript |
| Mapping Library | Leaflet |
| Map Provider | OpenStreetMap |
| Realtime Transport | Socket.IO Client |
| API Client | Native `fetch` / proposed HTTP client |
| Styling | CSS modules or Tailwind (design phase) |

## Project Structure (Planned)

```
liveBusTrackking/
├── README.md              # This file
├── .env.example            # Environment configuration
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── TrackingForm.tsx      # PNR / mobile input
│   │   ├── MapView.tsx           # Leaflet map container
│   │   ├── BusMarker.tsx         # Live position marker
│   │   └── TripInfo.tsx          # Trip details panel
│   ├── hooks/
│   │   ├── useTracking.ts        # Socket.IO subscription
│   │   └── useLookup.ts          # Backend manifest lookup
│   ├── services/
│   │   ├── api.ts                # Verified endpoint clients
│   │   └── socket.ts             # Socket.IO connection (design)
│   └── types/
│       └── tracking.ts
└── public/
    └── assets/
```

> **Note**: This structure represents the planned application layout. The `src/services/socket.ts` component connects to the backend only if the server-side GPS broadcast endpoint is verified to exist.

## Integration Points (Verified vs Planned)

### Verified Existing Endpoints (from backend repository inspection)
- `POST /auth/login` — authentication
- `GET /me` — authenticated user
- `GET /conductor/trip/today` — today's assigned trip
- `GET /trips/:id/manifest` — passenger manifest
- `POST /bookings/:id/board` — boarding event
- `POST /conductor/sync` — sync queued events
- `POST /trips/:id/start` — start trip
- `POST /trips/:id/end` — end trip
- `GET /conductor/trips` — conductor's trip list

### Proposed / Requires Verification
- GPS coordinate endpoint (`GET /trips/:id/location` or similar)
- Socket.IO server-side event for live location broadcasts
- Passenger lookup by PNR without trip context (group booking handling required)

The backend `service.ts` confirms manifest data includes `boardingPoint` and `droppingPoint`, which can be displayed in tracking details. The backend does not currently expose a dedicated GPS endpoint in the verified routes; this must be added or confirmed before live tracking functions.

## Security and Privacy

- **Passenger Data Protection**: The backend encrypts passenger phone numbers (`phoneEnc`) using AES-256-GCM. Only masked phone numbers (`maskedPhone`) are exposed to the conductor and should be the only data shown to the public tracking interface.
- **Tenant Isolation**: Every endpoint requires a valid JWT token. The operator (`operatorId`) is derived from the JWT, not the request. A trip or manifest not belonging to the authenticated operator returns 404. The tracking website must respect this isolation.
- **Access Control**: Tracking by PNR should only return trip information for the passenger's assigned trip, not reveal other passengers' details.
- **No Sensitive Exposure**: The manifest endpoint intentionally excludes fares, commissions, and financial data (verified from `http-api.ts` comment).

## Environment Variables

```
# Required
VITE_API_URL=https://kenroute-backend.example.com/api/v1
# Example: http://127.0.0.1:5000/api/v1 for local development

# Optional
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_SOCKET_URL=wss://kenroute-backend.example.com
```

> **Important**: Do not expose backend database credentials or JWT secrets in this repository. Only the public API URL may be configured in environment variables, consistent with the conductor mobile app (`.env` file uses `EXPO_PUBLIC_API_URL`).

## Development Setup

```bash
npm install
npm run dev
```

Requires the backend server running at `VITE_API_URL`.

For local development with the verified backend:

```bash
# Terminal 1 — Start backend (from kenroute999/backend)
npm run dev  # http://127.0.0.1:5000/api/v1

# Terminal 2 — Start tracking website
npm run dev
```

Physical Android device testing requires:
```bash
adb reverse tcp:5000 tcp:5000
```

## Deployment Considerations

The tracking website is a static or server-rendered React application. Production options include:

- **Static hosting** (Vercel, Netlify, Cloudflare Pages) if no server-side Socket.IO is required initially.
- **Server-hosted** (single container/VPS) if using Socket.IO server-side broadcasting (requires verified backend endpoint).
- **Reverse proxy** required if integrating with existing backend behind HTTPS.

Refer to `PRODUCTION_ARCHITECTURE_PLAN.md` (in parent workspace) for the full production deployment recommendation: single VPS + managed PostgreSQL + optional Railway/Render deployment.

## Roadmap

### Phase 1 — Design and Integration Planning
- [x] Verify existing backend endpoints
- [x] Confirm manifest and booking contracts
- [x] Identify GPS endpoint requirement (pending verification)
- [x] Design tracking UI (Leaflet + OpenStreetMap)
- [x] Create architecture documentation

### Phase 2 — Implementation (requires verified GPS endpoint)
- [ ] Implement passenger lookup endpoint or reuse `/manifest`
- [ ] Build tracking form component
- [ ] Implement map rendering with Leaflet
- [ ] Add Socket.IO connection (pending verified server event)
- [ ] Display trip details (origin, destination, bus number)

### Phase 3 — Production Integration
- [ ] Confirm backend GPS broadcast endpoint or implement
- [ ] Configure HTTPS/reverse proxy
- [ ] Deploy tracking website
- [ ] Test with real conductor trip data
- [ ] Verify passenger isolation and security

## Related Projects

- **Backend**: https://github.com/kenroute999/backend.git
- **Admin Dashboard**: https://github.com/kenroute999/kenroute-travel-admin.git
- **Agent Booking**: https://github.com/kenroute999/kenroute-booking-suite-agent.git
- **Conductor Mobile**: https://github.com/kenroute999/kenroute-conductor.git

## Important Notes

- This project depends on verified endpoints from the existing KenRoute backend repository. Do not assume GPS or Socket.IO server endpoints exist without inspection.
- The `PRODUCTION_ARCHITECTURE_PLAN.md` (workspace root) contains the verified production architecture recommendation (Option A: single VPS + managed PostgreSQL; or Railway for lower operational burden).
- No application source code is created by this repository; this file serves as documentation and planning reference only.
