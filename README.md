# 🎟️ Assignment 12: Event Management & Ticketing API with Firebase & Swagger
> **Track:** Backend Development | **Level:** Advanced | **Estimated Time:** 7–9 Hours  
> **Tech Stack:** Node.js, Express.js, Firebase Firestore & Auth, express-rate-limit, swagger-ui-express, swagger-jsdoc, dotenv

---

## 📌 1. Objective & Overview

Develop a high-concurrency **Event Ticketing & Live Booking REST API** backed by **Google Firebase Firestore**, secured with **JWT Role-Based Access Control** (`Organizer` vs `Attendee`), hardened with **API Rate Limiting** to prevent ticket-scalping bots, and documented comprehensively with **Swagger OpenAPI 3.0**. Students will master Firestore atomic transactions (`runTransaction`) to guarantee that tickets are never oversold under concurrent traffic.

### Key Learning Outcomes:
- Implementing Firestore ACID transactions (`runTransaction`) for concurrent ticket decrements.
- Configuring strict rate-limiting policies for booking routes to prevent bot spam and DDoS.
- Generating OpenAPI 3.0 documentation using JSDoc tags and interactive Swagger UI.
- Structuring multi-role authorization pipelines (`Organizer` creates events; `Attendee` purchases tickets).
- Handling Firestore timestamp comparisons for upcoming vs completed events.

---

## 🛠️ 2. Tech Stack & Dependencies

```bash
# Initialize Node.js project
npm init -y

# Install dependencies
npm install express firebase-admin jsonwebtoken bcryptjs express-rate-limit swagger-ui-express swagger-jsdoc dotenv cors

# Install development tools
npm install -D nodemon
```

---

## 🗄️ 3. Firebase Firestore Document Schema

### 1. `events` Collection
```json
{
  "id": "event_techconf_2026",
  "title": "Global Cloud & AI Summit 2026",
  "description": "Annual flagship backend conference",
  "category": "Technology",
  "eventDate": "2026-06-15T09:00:00Z",
  "venue": "Bandra Kurla Complex, Mumbai",
  "organizerId": "usr_organizer_01",
  "ticketPrice": 1499,
  "totalCapacity": 500,
  "availableTickets": 482,
  "createdAt": "2026-03-01T12:00:00Z"
}
```

### 2. `tickets` Collection
```json
{
  "id": "ticket_rec_88219",
  "eventId": "event_techconf_2026",
  "eventTitle": "Global Cloud & AI Summit 2026",
  "userId": "usr_attendee_99",
  "attendeeName": "Kunal Sharma",
  "attendeeEmail": "kunal@gmail.com",
  "quantity": 2,
  "totalPaid": 2998,
  "bookingRef": "TKT-2026-88219",
  "status": "confirmed", // "confirmed", "cancelled"
  "bookedAt": "2026-03-02T16:20:00Z"
}
```

---

## 📋 4. API Endpoints Specification

### 🔐 Authentication

| Method | Endpoint | Role Access | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | Public | Register as `Attendee` or `Organizer` |
| `POST` | `/api/auth/login` | Public | Authenticate and obtain JWT token |
| `GET` | `/api/auth/profile` | Authenticated | Retrieve user profile & role |

### 🎪 Event Management Endpoints

| Method | Endpoint | Role Access | Description |
|---|---|:---:|---|
| `GET` | `/api/events` | Public | Browse all upcoming events (supports `?category=Technology&city=Mumbai`) |
| `GET` | `/api/events/:id` | Public | View event details & live remaining ticket count |
| `POST` | `/api/events` | **Organizer** | Create new event listing |
| `PUT` | `/api/events/:id` | **Organizer** | Update event details (Organizer must own event) |
| `DELETE` | `/api/events/:id` | **Organizer** | Cancel and delete event |

### 🎟️ Ticket Booking & Scalper Protection (Rate Limited)

| Method | Endpoint | Role Access | Description |
|---|---|:---:|---|
| `POST` | `/api/tickets/book` | **Attendee** | **Atomic Booking**: 10 requests / min limit. Decrements tickets via transaction |
| `GET` | `/api/tickets/my-tickets` | **Attendee** | View purchased tickets |
| `POST` | `/api/tickets/:id/cancel` | **Attendee** | Cancel ticket & restore ticket inventory |
| `GET` | `/api/events/:id/attendees` | **Organizer** | List all registered attendees for the event |

### 📚 Interactive Swagger Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api-docs` | Full interactive Swagger UI documentation for all endpoints |

---

## ⚡ 5. Firestore Concurrency Transaction Example

```javascript
// controllers/ticketController.js
const { db } = require('../config/firebaseConfig');

exports.bookTicket = async (req, res, next) => {
  const { eventId, quantity, attendeeName, attendeeEmail } = req.body;
  const userId = req.user.id;
  const qty = parseInt(quantity, 10);

  const eventRef = db.collection('events').doc(eventId);
  const ticketRef = db.collection('tickets').doc();

  try {
    const result = await db.runTransaction(async (t) => {
      const eventDoc = await t.get(eventRef);
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      if (eventData.availableTickets < qty) {
        throw new Error('Insufficient tickets available');
      }

      // 1. Decrement available tickets
      t.update(eventRef, {
        availableTickets: eventData.availableTickets - qty
      });

      // 2. Create ticket document
      const bookingRef = `TKT-${Date.now().toString().slice(-6)}`;
      const newTicket = {
        id: ticketRef.id,
        eventId,
        eventTitle: eventData.title,
        userId,
        attendeeName,
        attendeeEmail,
        quantity: qty,
        totalPaid: qty * eventData.ticketPrice,
        bookingRef,
        status: 'confirmed',
        bookedAt: new Date().toISOString()
      };

      t.set(ticketRef, newTicket);
      return newTicket;
    });

    res.status(201).json({ success: true, message: 'Tickets booked successfully', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

---

## 🏗️ 6. Project Architecture

```text
assignment-12-event-ticketing-api/
├── config/
│   ├── firebaseConfig.js    # Firebase Admin Firestore init
│   └── swagger.js           # Swagger specification config
├── controllers/
│   ├── authController.js
│   ├── eventController.js
│   └── ticketController.js  # Transactional booking logic
├── middleware/
│   ├── auth.js              # JWT verification
│   ├── checkRole.js         # Organizer vs Attendee guard
│   └── rateLimiter.js       # Strict booking rate limit
├── routes/
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   └── ticketRoutes.js
├── serviceAccountKey.json   # (In .gitignore)
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

---

## 🧪 7. Testing & Verification

1. Start server and visit `http://localhost:5000/api-docs` to view Swagger documentation.
2. Register an organizer and create an event with `totalCapacity: 5`.
3. Log in as an attendee and make concurrent booking calls; verify that `availableTickets` never drops below 0.
4. Attempt more than 10 requests within 60 seconds on `/api/tickets/book`; verify `429 Too Many Requests` is returned.

---

## 📊 8. Grading Rubric (100 Marks)

| Evaluation Component | Marks |
|---|:---:|
| **Firestore ACID Transactions (`runTransaction`) for Ticket Booking** | 25 |
| **Role-Based Access Control (Organizer vs Attendee)** | 20 |
| **Swagger / OpenAPI Documentation Completeness** | 20 |
| **Rate Limiting Security Against Bot Abuse (`express-rate-limit`)** | 20 |
| **Error Handling, Status Codes & Clean Code Architecture** | 15 |
| **Total Marks** | **100** |

---

## 📤 9. Submission Guidelines

- Submit your GitHub repository: `itm-assignment-12-event-ticketing-api`.
- Include screenshots of Swagger UI and Firestore collection records in `/docs`.
