/**
 * Modern email normalization utilities
 * Implements RFC 5321 best practices for case-insensitive email handling
 */

/**
 * Normalize email address to lowercase and trim whitespace
 * This is the single source of truth for email normalization across the application
 */
export const normalizeEmail = (email: string): string => {
	return email.toLowerCase().trim();
};

/**
 * Validate email format using modern regex
 * More permissive than the basic regex to handle international domains
 */
export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

/**
 * Validate and normalize email in one step
 * Returns normalized email if valid, throws error if invalid
 */
export const validateAndNormalizeEmail = (email: string): string => {
	const normalized = normalizeEmail(email);

	if (!isValidEmail(normalized)) {
		throw new Error("Invalid email format");
	}

	return normalized;
};

/**
 * Check if two emails are equivalent (case-insensitive)
 */
export const areEmailsEquivalent = (email1: string, email2: string): boolean => {
	return normalizeEmail(email1) === normalizeEmail(email2);
};
