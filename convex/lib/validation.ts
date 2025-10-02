// Email validation utilities

// List of disposable/test email domains that should be rejected
const BLOCKED_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'localhost',
  'invalid',
];

// Basic email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  // Check basic format
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  // Trim whitespace
  email = email.trim().toLowerCase();

  // Check regex pattern
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Extract domain
  const domain = email.split('@')[1];

  // Check for blocked domains
  if (BLOCKED_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: `Email domain '${domain}' is not allowed. Please use a real email address.`
    };
  }

  // Check for localhost/local domains
  if (domain.includes('localhost') || domain.endsWith('.local')) {
    return {
      valid: false,
      error: 'Local email addresses are not allowed'
    };
  }

  return { valid: true };
}
