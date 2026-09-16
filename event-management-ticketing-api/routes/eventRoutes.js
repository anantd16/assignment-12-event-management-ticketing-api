const express = require('express');
const router = express.Router();
const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listAttendees
} = require('../controllers/eventController');
const authenticate = require('../middleware/auth');
const { verifyOrganizer } = require('../middleware/checkRole');

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event listing management
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Browse all upcoming events with optional filters
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of upcoming events }
 */
router.get('/', listEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: View event details & live remaining ticket count
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Event details }
 *       404: { description: Event not found }
 */
router.get('/:id', getEvent);

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event listing (Organizer only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category, eventDate, venue, ticketPrice, totalCapacity]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               city: { type: string }
 *               eventDate: { type: string, format: date-time }
 *               venue: { type: string }
 *               ticketPrice: { type: number }
 *               totalCapacity: { type: integer }
 *     responses:
 *       201: { description: Event created }
 *       400: { description: Validation error }
 *       403: { description: Forbidden - organizers only }
 */
router.post('/', authenticate, verifyOrganizer, createEvent);

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update an event (Organizer only, must own the event)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               city: { type: string }
 *               eventDate: { type: string, format: date-time }
 *               venue: { type: string }
 *               ticketPrice: { type: number }
 *               totalCapacity: { type: integer }
 *     responses:
 *       200: { description: Event updated }
 *       403: { description: Forbidden - not the owning organizer }
 *       404: { description: Event not found }
 */
router.put('/:id', authenticate, verifyOrganizer, updateEvent);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Cancel and delete an event (Organizer only, must own the event)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Event cancelled and deleted }
 *       403: { description: Forbidden - not the owning organizer }
 *       404: { description: Event not found }
 */
router.delete('/:id', authenticate, verifyOrganizer, deleteEvent);

/**
 * @swagger
 * /api/events/{id}/attendees:
 *   get:
 *     summary: List all registered attendees for an event (Organizer only, must own the event)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of confirmed ticket holders }
 *       403: { description: Forbidden - not the owning organizer }
 *       404: { description: Event not found }
 */
router.get('/:id/attendees', authenticate, verifyOrganizer, listAttendees);

module.exports = router;
