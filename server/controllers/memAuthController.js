/**
 * In-memory user store — used as a fallback when MongoDB is unavailable.
 * Data resets on every server restart (dev mode only).
 * Pre-seeded with a developer admin account on startup.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── In-memory store ──────────────────────────────────────────────────────────
const users = new Map(); // email → { _id, name, email, passwordHash }
let idCounter = 1;

// Generate a fake ObjectId-style ID
const fakeId = () => `mem_${Date.now()}_${idCounter++}`;

const generateToken = (id) => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d', algorithm: 'HS256' });
};

// ── Seed admin on module load ─────────────────────────────────────────────────
async function seedAdminInMemory() {
    const adminEmail = 'admin@scribeai.com';
    const adminPassword = 'Password123';
    if (!users.has(adminEmail)) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        users.set(adminEmail, {
            _id: fakeId(),
            name: 'Developer Admin',
            email: adminEmail,
            passwordHash
        });
    }
}

// ── Auth handlers ─────────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ message: 'Name, email and password are required.' });

        if (users.has(email))
            return res.status(400).json({ message: 'User already exists.' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const user = { _id: fakeId(), name, email, passwordHash };
        users.set(email, user);

        res.status(201).json({ _id: user._id, name: user.name, email: user.email, token: generateToken(user._id) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.get(email);
        if (user && (await bcrypt.compare(password, user.passwordHash))) {
            res.json({ _id: user._id, name: user.name, email: user.email, token: generateToken(user._id) });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = { registerUser, loginUser, seedAdminInMemory };
