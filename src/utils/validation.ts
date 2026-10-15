export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a worker's full name.
 * Must be non-empty after trimming.
 */
export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Name is too long (max 100 characters)' };
  }
  return { valid: true };
}

/**
 * Validates a phone number.
 * Accepts international format with optional country code.
 * e.g. +919876543210, 9876543210, +1-555-123-4567
 */
export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Phone number is required' };
  }
  // Strip spaces, dashes, parentheses for length check
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  // Must start with + or a digit, contain only digits/dashes/spaces/parens
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return { valid: false, error: 'Phone number contains invalid characters' };
  }
  if (digitsOnly.replace(/^\+/, '').length < 7) {
    return { valid: false, error: 'Phone number is too short' };
  }
  if (digitsOnly.replace(/^\+/, '').length > 15) {
    return { valid: false, error: 'Phone number is too long' };
  }
  return { valid: true };
}

/**
 * Validates a worker role.
 */
export function validateRole(role: string): ValidationResult {
  const trimmed = role.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Role is required' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Role is too long (max 50 characters)' };
  }
  return { valid: true };
}

/**
 * Validates an email address.
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  return { valid: true };
}

/**
 * Validates a password.
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true };
}

export const WORKER_ROLES = [
  'Helper',
  'Mason',
  'Painter',
  'Electrician',
  'Carpenter',
  'Plumber',
  'Welder',
] as const;
