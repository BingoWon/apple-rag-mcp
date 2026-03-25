export const normalizeEmail = (email: string): string => {
	return email.toLowerCase().trim();
};

export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};
