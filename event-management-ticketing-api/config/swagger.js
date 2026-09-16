const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management & Ticketing API',
      version: '1.0.0',
      description:
        'A high-concurrency REST API for event listings and ticket booking, built with ' +
        'Express, Firebase Firestore, JWT auth, role-based access control ' +
        '(Organizer vs Attendee), and rate-limited booking routes to deter scalper bots. ' +
        'Documented with Swagger OpenAPI 3.0.'
    },
    servers: [
      {
        url: 'http://localhost:' + (process.env.PORT || 5000),
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' }
          }
        },
        User: {
          type: 'object',
          properties: {
            uid: { type: 'string' },
            name: { type: 'string', example: 'Kunal Sharma' },
            email: { type: 'string', example: 'kunal@gmail.com' },
            role: { type: 'string', enum: ['attendee', 'organizer'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'event_techconf_2026' },
            title: { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            description: { type: 'string' },
            category: { type: 'string', example: 'Technology' },
            city: { type: 'string', example: 'Mumbai' },
            eventDate: { type: 'string', format: 'date-time' },
            venue: { type: 'string', example: 'Bandra Kurla Complex, Mumbai' },
            organizerId: { type: 'string' },
            ticketPrice: { type: 'number', example: 1499 },
            totalCapacity: { type: 'integer', example: 500 },
            availableTickets: { type: 'integer', example: 482 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventId: { type: 'string' },
            eventTitle: { type: 'string' },
            userId: { type: 'string' },
            attendeeName: { type: 'string' },
            attendeeEmail: { type: 'string' },
            quantity: { type: 'integer', example: 2 },
            totalPaid: { type: 'number', example: 2998 },
            bookingRef: { type: 'string', example: 'TKT-2026-88219' },
            status: { type: 'string', enum: ['confirmed', 'cancelled'] },
            bookedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);
