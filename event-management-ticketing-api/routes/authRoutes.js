const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login and profile
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register as an Attendee or Organizer
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, example: Kunal Sharma }
 *               email: { type: string, example: kunal@gmail.com }
 *               password: { type: string, example: secret123 }
 *               role: { type: string, enum: [attendee, organizer] }
 *     responses:
 *       201: { description: Registered successfully }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email & password, returns JWT token with embedded role
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid email or password }
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Retrieve current user profile & role
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current user's profile }
 *       401: { description: Authentication required }
 *       404: { description: User not found }
 */
router.get('/profile', authenticate, getProfile);

module.exports = router;
