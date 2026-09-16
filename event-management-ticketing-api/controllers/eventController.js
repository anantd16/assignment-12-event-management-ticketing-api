const { db, admin } = require('../config/firebaseConfig');

const eventsCollection = db.collection('events');
const ticketsCollection = db.collection('tickets');

function serializeEvent(doc) {
  const data = doc.data();
  const toIso = (v) => (v && v.toDate ? v.toDate().toISOString() : v);
  return {
    id: doc.id,
    ...data,
    eventDate: toIso(data.eventDate),
    createdAt: toIso(data.createdAt)
  };
}

/**
 * GET /api/events — public. Supports ?category= and ?city= filters.
 * Only returns events whose eventDate is still upcoming (>= now).
 */
async function listEvents(req, res) {
  try {
    const { category, city } = req.query;

    let query = eventsCollection.where('eventDate', '>=', admin.firestore.Timestamp.fromDate(new Date()));

    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.orderBy('eventDate', 'asc').get();
    let events = snapshot.docs.map(serializeEvent);

    // city filter applied in-memory since combining it with the range/order
    // query above would need a composite Firestore index
    if (city) {
      events = events.filter((e) => e.city && e.city.toLowerCase() === city.toLowerCase());
    }

    return res.status(200).json({ success: true, count: events.length, data: events });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/events/:id — public. Includes live remaining ticket count.
 */
async function getEvent(req, res) {
  try {
    const doc = await eventsCollection.doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.status(200).json({ success: true, data: serializeEvent(doc) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/events — Organizer only
 */
async function createEvent(req, res) {
  try {
    const { title, description, category, city, eventDate, venue, ticketPrice, totalCapacity } = req.body;

    if (!title || !category || !eventDate || !venue || ticketPrice === undefined || totalCapacity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'title, category, eventDate, venue, ticketPrice and totalCapacity are required'
      });
    }

    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'eventDate must be a valid date' });
    }
    if (typeof ticketPrice !== 'number' || ticketPrice < 0) {
      return res.status(400).json({ success: false, message: 'ticketPrice must be a non-negative number' });
    }
    if (!Number.isInteger(totalCapacity) || totalCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'totalCapacity must be a positive integer' });
    }

    const docRef = await eventsCollection.add({
      title,
      description: description || '',
      category,
      city: city || '',
      eventDate: admin.firestore.Timestamp.fromDate(parsedDate),
      venue,
      organizerId: req.user.id,
      ticketPrice,
      totalCapacity,
      availableTickets: totalCapacity,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const doc = await docRef.get();
    return res.status(201).json({ success: true, message: 'Event created', data: serializeEvent(doc) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/events/:id — Organizer only, must own the event.
 * If totalCapacity changes, availableTickets is adjusted by the same delta,
 * clamped between 0 and the new totalCapacity.
 */
async function updateEvent(req, res) {
  try {
    const eventRef = eventsCollection.doc(req.params.id);

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(eventRef);
      if (!doc.exists) {
        const err = new Error('Event not found');
        err.statusCode = 404;
        throw err;
      }

      const current = doc.data();
      if (current.organizerId !== req.user.id) {
        const err = new Error('You do not own this event');
        err.statusCode = 403;
        throw err;
      }

      const { title, description, category, city, eventDate, venue, ticketPrice, totalCapacity } = req.body;
      const updates = {};

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (city !== undefined) updates.city = city;
      if (venue !== undefined) updates.venue = venue;

      if (eventDate !== undefined) {
        const parsedDate = new Date(eventDate);
        if (Number.isNaN(parsedDate.getTime())) {
          const err = new Error('eventDate must be a valid date');
          err.statusCode = 400;
          throw err;
        }
        updates.eventDate = admin.firestore.Timestamp.fromDate(parsedDate);
      }

      if (ticketPrice !== undefined) {
        if (typeof ticketPrice !== 'number' || ticketPrice < 0) {
          const err = new Error('ticketPrice must be a non-negative number');
          err.statusCode = 400;
          throw err;
        }
        updates.ticketPrice = ticketPrice;
      }

      if (totalCapacity !== undefined) {
        if (!Number.isInteger(totalCapacity) || totalCapacity <= 0) {
          const err = new Error('totalCapacity must be a positive integer');
          err.statusCode = 400;
          throw err;
        }
        const ticketsSold = current.totalCapacity - current.availableTickets;
        const newAvailable = Math.max(0, totalCapacity - ticketsSold);
        updates.totalCapacity = totalCapacity;
        updates.availableTickets = newAvailable;
      }

      tx.update(eventRef, updates);
    });

    const updatedDoc = await eventRef.get();
    return res.status(200).json({ success: true, message: 'Event updated', data: serializeEvent(updatedDoc) });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/events/:id — Organizer only, must own the event.
 */
async function deleteEvent(req, res) {
  try {
    const eventRef = eventsCollection.doc(req.params.id);
    const doc = await eventRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (doc.data().organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not own this event' });
    }

    await eventRef.delete();
    return res.status(200).json({ success: true, message: 'Event cancelled and deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/events/:id/attendees — Organizer only, must own the event.
 */
async function listAttendees(req, res) {
  try {
    const eventDoc = await eventsCollection.doc(req.params.id).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (eventDoc.data().organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not own this event' });
    }

    const snapshot = await ticketsCollection
      .where('eventId', '==', req.params.id)
      .where('status', '==', 'confirmed')
      .get();

    const toIso = (v) => (v && v.toDate ? v.toDate().toISOString() : v);
    const attendees = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data, bookedAt: toIso(data.bookedAt) };
    });

    return res.status(200).json({ success: true, count: attendees.length, data: attendees });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent, listAttendees };
