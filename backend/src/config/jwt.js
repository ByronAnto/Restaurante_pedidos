const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Genera un token JWT
 * @param {Object} payload - Datos del usuario
 * @returns {string} Token JWT
 */
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifica un token JWT
 * @param {string} token
 * @returns {Object} Payload decodificado
 */
const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken, JWT_SECRET };
