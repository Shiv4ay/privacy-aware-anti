/**
 * Input Validation Middleware
 * Prevents SQL injection, XSS, and malicious input
 * 
 * Uses express-validator for comprehensive validation
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
}

/**
 * Email validation rules
 */
const validateEmail = [
    body('email')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .trim()
        .isLength({ max: 255 }).withMessage('Email too long')
];

/**
 * Password strength validation rules
 */
const validatePassword = [
    body('password')
        .isString()
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/).withMessage('Password must contain at least one special character')
];

/**
 * Username validation
 */
const validateUsername = [
    body('username')
        .isString()
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens')
];

/**
 * OTP validation
 */
const validateOTP = [
    body('otp')
        .isString()
        .trim()
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .matches(/^\d{6}$/).withMessage('OTP must contain only digits')
];

/**
 * Search query validation (prevent SQL injection)
 */
const validateSearchQuery = [
    query('q')
        .optional()
        .trim()
        .escape()
        .isLength({ max: 500 }).withMessage('Search query too long')
        .matches(/^[a-zA-Z0-9\s\-_.,!?]*$/).withMessage('Invalid characters in search query')
];

/**
 * ID parameter validation
 */
const validateId = [
    param('id')
        .isString()
        .trim()
        .matches(/^[A-Z]{3}\d{5,8}$/).withMessage('Invalid ID format')
];

/**
 * Role validation
 */
const validateRole = [
    body('role')
        .optional()
        .isIn(['student', 'faculty', 'university_admin', 'auditor', 'guest'])
        .withMessage('Invalid role')
];

/**
 * Department validation
 */
const validateDepartment = [
    body('department_id')
        .optional()
        .matches(/^DEPT_[A-Z]{2,10}$/).withMessage('Invalid department ID format')
];

/**
 * Sanitize HTML/script tags from input
 */
function sanitizeHtml(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<iframe/gi, '')
        .replace(/<embed/gi, '')
        .replace(/<object/gi, '');
}

/**
 * Middleware to sanitize all request body fields
 */
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeHtml(req.body[key]);
            }
        }
    }
    next();
}

/**
 * Validate pagination parameters
 */
const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('offset')
        .optional()
        .isInt({ min: 0 }).withMessage('Offset must be non-negative')
];

/**
 * Validate date range
 */
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
        .optional()
        .isISO8601().withMessage('Invalid end date format')
];

module.exports = {
    handleValidationErrors,
    validateEmail,
    validatePassword,
    validateUsername,
    validateOTP,
    validateSearchQuery,
    validateId,
    validateRole,
    validateDepartment,
    sanitizeHtml,
    sanitizeBody,
    validatePagination,
    validateDateRange
};
