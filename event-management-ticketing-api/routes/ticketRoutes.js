const express = require('express');
const router = express.Router();
const { bookTicket, myTickets, cancelTicket } = require('../controllers/ticketController');
const authenticate = require('../middleware/auth');
const { verifyAttendee } = require('../middleware/checkRole');
const { bookingLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket booking and management (Attendee)
 */

/**
 * @swagger
 * /api/tickets/book:
 *   post:
 *     summary: Book tickets for an event (Attendee only). Rate limited to 10 requests/min to deter scalper bots. Uses a Firestore transaction so tickets are never oversold under concurrent traffic.
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, quantity, attendeeName, attendeeEmail]
 *             properties:
 *               eventId: { type: string }
 *               quantity: { type: integer, example: 2 }
 *               attendeeName: { type: string }
 *               attendeeEmail: { type: string }
 *     responses:
 *       201: { description: Tickets booked successfully }
 *       400: { description: Insufficient tickets available or validation error }
 *       403: { description: Forbidden - attendees only }
 *       404: { description: Event not found }
 *       429: { description: Too many booking attempts }
 */
router.post('/book', authenticate, verifyAttendee, bookingLimiter, bookTicket);

/**
 * @swagger
 * /api/tickets/my-tickets:
 *   get:
 *     summary: View tickets purchased by the current attendee
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of the caller's tickets }
 *       403: { description: Forbidden - attendees only }
 */
router.get('/my-tickets', authenticate, verifyAttendee, myTickets);

/**
 * @swagger
 * /api/tickets/{id}/cancel:
 *   post:
 *     summary: Cancel a ticket and restore inventory (Attendee only, must own the ticket)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ticket cancelled and inventory restored }
 *       400: { description: Ticket already cancelled }
 *       403: { description: Forbidden - not the ticket owner }
 *       404: { description: Ticket not found }
 */
router.post('/:id/cancel', authenticate, verifyAttendee, cancelTicket);

module.exports = router;
