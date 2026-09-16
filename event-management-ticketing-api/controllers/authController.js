const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, admin } = require('../config/firebaseConfig');

const usersCollection = db.collection('users');
const VALID_ROLES = ['attendee', 'organizer'];

function signToken(user) {
  return jwt.sign(
    { id: user.uid, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/auth/register — public. Registers as either "attendee" or "organizer".
 */
async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await usersCollection.where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const docRef = await usersCollection.add({
      name,
      email,
      password: hashedPassword,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const user = { uid: docRef.id, name, email, role };
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: `${role} registered successfully`,
      data: { user, token }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/auth/login — public
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const snapshot = await usersCollection.where('email', '==', email).limit(1).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const doc = snapshot.docs[0];
    const userData = doc.data();

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = { uid: doc.id, name: userData.name, email: userData.email, role: userData.role };
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/auth/profile — authenticated
 */
async function getProfile(req, res) {
  try {
    const doc = await usersCollection.doc(req.user.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { password, ...userData } = doc.data();
    return res.status(200).json({ success: true, data: { uid: doc.id, ...userData } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { register, login, getProfile };
