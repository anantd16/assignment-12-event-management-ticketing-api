# 🎟️ Event Management & Ticketing API

A high-concurrency REST API for event listings and ticket booking, built with **Express, Firebase Firestore, JWT auth, role-based access control (Organizer vs Attendee), rate-limited booking routes, and Swagger (OpenAPI 3.0)** docs.

## Tech Stack

- Node.js + Express.js
- Firebase Admin SDK (Firestore)
- JWT (`jsonwebtoken`) + `bcryptjs` for auth
- `express-rate-limit` — general API limiting plus a strict scalper-protection limiter on ticket booking
- `swagger-ui-express` + `swagger-jsdoc` for live API docs

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Firebase project**
   - Create a Firebase project → enable **Firestore** (Native mode).
   - Project Settings → Service Accounts → Generate new private key.
   - Save the downloaded JSON as `serviceAccountKey.json` in the project root (already gitignored).

3. **Environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `JWT_SECRET`.

4. **Run**
   ```bash
   npm run dev     # nodemon, auto-restart
   # or
   npm start
   ```

5. **Explore the API**
   Visit `http://localhost:5000/api-docs` for the interactive Swagger UI.

## Roles

| Role | Capabilities |
|---|---|
| `attendee` | Browse events, book tickets, view own tickets, cancel own tickets |
| `organizer` | Everything an attendee can browse, plus create/update/delete their own events, view attendee lists for their own events |

Both roles register through the same `POST /api/auth/register` endpoint — the `role` field in the request body determines which one is created (no separate secret-key gate, since anyone can legitimately be either an event organizer or an attendee).

## Key Design Notes

- **Atomic ticket booking**: `bookTicket` runs entirely inside a single `db.runTransaction()` — it reads the event's `availableTickets`, verifies enough remain, decrements it, and creates the ticket document, all atomically. Firestore transactions serialize conflicting concurrent writes, so two simultaneous booking requests can never together push `availableTickets` below zero — this was verified with an isolated concurrency simulation during development.
- **Scalper protection**: `POST /api/tickets/book` is rate-limited to **10 requests per minute per IP** (`middleware/rateLimiter.js`), on top of the general 100-requests/15-min limiter applied to all other `/api/*` routes.
- **Ownership checks**: updating, deleting, or viewing attendees for an event all verify `event.organizerId === req.user.id` inside the same transaction/read as the mutation, returning `403` if the caller isn't the owning organizer. Ticket cancellation similarly verifies `ticket.userId === req.user.id`.
- **Cancel restores inventory**: `cancelTicket` also runs in a transaction — it marks the ticket `cancelled` and adds the cancelled quantity back to the event's `availableTickets`, capped at `totalCapacity` so it can never overshoot.
- **Past-event guard**: booking is rejected with `400` if the event's `eventDate` has already passed.
- Passwords are bcrypt-hashed (10 rounds) and never returned in API responses.

## Testing the Concurrency & RBAC Rules

1. Register an organizer and an attendee (`/api/auth/register` with `role: "organizer"` / `"attendee"`).
2. Log in as the organizer, create an event via `POST /api/events` with `totalCapacity: 5`.
3. Log in as the attendee, `POST /api/tickets/book` for 2 tickets → `availableTickets` drops to 3.
4. Fire several booking requests concurrently that together exceed the remaining stock → only the ones that fit succeed; the rest get a clean `400: Insufficient tickets available`, and `availableTickets` never goes negative.
5. Fire more than 10 requests to `/api/tickets/book` within 60 seconds → expect `429 Too Many Requests`.
6. `POST /api/tickets/:id/cancel` on a booked ticket → confirm `availableTickets` goes back up by the cancelled quantity.

## Project Structure

```
event-management-ticketing-api/
├── config/
│   ├── firebaseConfig.js
│   └── swagger.js
├── controllers/
│   ├── authController.js
│   ├── eventController.js
│   └── ticketController.js
├── middleware/
│   ├── auth.js
│   ├── checkRole.js
│   └── rateLimiter.js
├── routes/
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   └── ticketRoutes.js
├── serviceAccountKey.json   # gitignored
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```
