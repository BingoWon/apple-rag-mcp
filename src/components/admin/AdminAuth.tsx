/**
 * Admin Authentication Component
 * Password-protected access to admin dashboard
 */
import { IconEye, IconEyeOff, IconShieldCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api } from "@/lib/api";
import { ADMIN_SESSION_KEY } from "@/lib/constants";

interface AdminAuthProps {
	onAuthenticated: () => void;
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const verifyStoredPassword = async (_storedPassword: string) => {
		try {
			// Test the stored password by making an admin API call
			// Password is already in localStorage, so API call will include it
			await api.getAdminUsers();
			onAuthenticated();
		} catch (_error) {
			// Invalid stored password, clear it
			localStorage.removeItem(ADMIN_SESSION_KEY);
		}
	};

	// Check if already authenticated
	useEffect(() => {
		const storedPassword = localStorage.getItem(ADMIN_SESSION_KEY);
		if (storedPassword) {
			// Verify stored password with backend
			verifyStoredPassword(storedPassword);
		}
	}, [
		// Verify stored password with backend
		verifyStoredPassword,
	]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			// Store password permanently for API call
			localStorage.setItem(ADMIN_SESSION_KEY, password);

			// Verify password by making an admin API call
			await api.getAdminUsers();

			// If successful, authenticate
			onAuthenticated();
		} catch (error) {
			// Clear invalid password from storage
			localStorage.removeItem(ADMIN_SESSION_KEY);

			// Handle authentication error
			if (
				error &&
				typeof error === "object" &&
				"response" in error &&
				error.response &&
				typeof error.response === "object" &&
				"status" in error.response &&
				error.response.status === 401
			) {
				setError("Invalid admin password");
			} else {
				setError("Authentication failed. Please try again.");
			}
			setPassword("");
		}

		setIsLoading(false);
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
			{/* Theme Toggle in top right corner */}
			<div className="absolute top-4 right-4">
				<ThemeToggle />
			</div>

			<div className="max-w-md w-full space-y-8">
				{/* Header */}
				<div className="text-center">
					<div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
						<IconShieldCheck className="h-8 w-8 text-primary-foreground" />
					</div>
					<h2 className="mt-6 text-3xl font-bold text-foreground">Admin Access</h2>
					<p className="mt-2 text-muted-foreground">Enter admin password to continue</p>
				</div>

				{/* Form */}
				<form name="admin-login" className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div>
						<label htmlFor="password" className="sr-only">
							Admin Password
						</label>
						<div className="relative">
							<input
								id="password"
								name="password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand pr-10"
								placeholder="Admin password"
								autoComplete="current-password"
								required
								disabled={isLoading}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-gray-300"
								onClick={() => setShowPassword(!showPassword)}
								disabled={isLoading}
							>
								{showPassword ? (
									<IconEyeOff className="h-5 w-5" />
								) : (
									<IconEye className="h-5 w-5" />
								)}
							</Button>
						</div>
					</div>

					{error && (
						<div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-lg p-3">
							{error}
						</div>
					)}

					<Button
						type="submit"
						variant="primary"
						disabled={isLoading || !password}
						className="w-full"
						loading={isLoading}
					>
						{isLoading ? "Verifying..." : "Access Admin Dashboard"}
					</Button>
				</form>

				{/* Footer */}
				<div className="text-center">
					<p className="text-xs text-gray-500">Admin access is password protected for security</p>
				</div>
			</div>
		</div>
	);
}
