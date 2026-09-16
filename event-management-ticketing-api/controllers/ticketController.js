const { db, admin } = require('../config/firebaseConfig');

const eventsCollection = db.collection('events');
const ticketsCollection = db.collection('tickets');

function serializeTicket(doc) {
  const data = doc.data();
  const toIso = (v) => (v && v.toDate ? v.toDate().toISOString() : v);
  return { id: doc.id, ...data, bookedAt: toIso(data.bookedAt) };
}

/**
 * POST /api/tickets/book — Attendee only, rate-limited (10/min) at the route level.
 * Atomically checks availableTickets >= quantity, decrements it, and creates
 * a ticket document — all inside a single Firestore transaction so
 * concurrent booking requests can never oversell an event.
 */
async function bookTicket(req, res) {
  try {
    const { eventId, quantity, attendeeName, attendeeEmail } = req.body;

    if (!eventId || quantity === undefined || !attendeeName || !attendeeEmail) {
      return res.status(400).json({
        success: false,
        message: 'eventId, quantity, attendeeName and attendeeEmail are required'
      });
    }

    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
    }

    const userId = req.user.id;
    const eventRef = eventsCollection.doc(eventId);
    const ticketRef = ticketsCollection.doc();

    const result = await db.runTransaction(async (t) => {
      const eventDoc = await t.get(eventRef);
      if (!eventDoc.exists) {
        const err = new Error('Event not found');
        err.statusCode = 404;
        throw err;
      }

      const eventData = eventDoc.data();

      if (eventData.eventDate && eventData.eventDate.toDate() < new Date()) {
        const err = new Error('This event has already taken place; booking is closed');
        err.statusCode = 400;
        throw err;
      }

      if (eventData.availableTickets < qty) {
        const err = new Error(
          `Insufficient tickets available. Only ${eventData.availableTickets} remaining.`
        );
        err.statusCode = 400;
        throw err;
      }

      // 1. Decrement available tickets atomically as part of this transaction
      t.update(eventRef, {
        availableTickets: eventData.availableTickets - qty
      });

      // 2. Create the ticket document
      const bookingRef = `TKT-${Date.now().toString().slice(-6)}`;
      const newTicket = {
        eventId,
        eventTitle: eventData.title,
        userId,
        attendeeName,
        attendeeEmail,
        quantity: qty,
        totalPaid: qty * eventData.ticketPrice,
        bookingRef,
        status: 'confirmed',
        bookedAt: admin.firestore.Timestamp.fromDate(new Date())
      };

      t.set(ticketRef, newTicket);
      return { id: ticketRef.id, ...newTicket };
    });

    return res.status(201).json({
      success: true,
      message: 'Tickets booked successfully',
      data: { ...result, bookedAt: result.bookedAt.toDate().toISOString() }
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/tickets/my-tickets — Attendee only
 */
async function myTickets(req, res) {
  try {
    const snapshot = await ticketsCollection
      .where('userId', '==', req.user.id)
      .orderBy('bookedAt', 'desc')
      .get();

    const tickets = snapshot.docs.map(serializeTicket);
    return res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/tickets/:id/cancel — Attendee only, must own the ticket.
 * Atomically marks the ticket cancelled and restores the event's
 * availableTickets by the cancelled quantity (capped at totalCapacity).
 */
async function cancelTicket(req, res) {
  try {
    const ticketRef = ticketsCollection.doc(req.params.id);

    const result = await db.runTransaction(async (t) => {
      const ticketDoc = await t.get(ticketRef);
      if (!ticketDoc.exists) {
        const err = new Error('Ticket not found');
        err.statusCode = 404;
        throw err;
      }

      const ticket = ticketDoc.data();
      if (ticket.userId !== req.user.id) {
        const err = new Error('You do not own this ticket');
        err.statusCode = 403;
        throw err;
      }
      if (ticket.status === 'cancelled') {
        const err = new Error('This ticket is already cancelled');
        err.statusCode = 400;
        throw err;
      }

      const eventRef = eventsCollection.doc(ticket.eventId);
      const eventDoc = await t.get(eventRef);

      if (eventDoc.exists) {
        const eventData = eventDoc.data();
        const restored = Math.min(eventData.totalCapacity, eventData.availableTickets + ticket.quantity);
        t.update(eventRef, { availableTickets: restored });
      }

      t.update(ticketRef, { status: 'cancelled' });
      return { ...ticket, status: 'cancelled' };
    });

    return res.status(200).json({
      success: true,
      message: 'Ticket cancelled and inventory restored',
      data: { id: req.params.id, ...result, bookedAt: result.bookedAt.toDate().toISOString() }
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

module.exports = { bookTicket, myTickets, cancelTicket };
