import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import {
	authReturnPath,
	clearAuthReturn,
	rememberAuthReturn,
	safeAuthReturn,
} from "@/lib/auth-return";

export function AuthLayout() {
	const { isAuthenticated, isHydrated } = useAuth();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [returnPath] = useState(() =>
		params.get("return_to") ? safeAuthReturn(params.get("return_to")) : authReturnPath(),
	);
	useEffect(() => {
		if (params.get("return_to")) rememberAuthReturn(returnPath);
	}, [params, returnPath]);

	useEffect(() => {
		if (isHydrated && isAuthenticated) {
			clearAuthReturn();
			navigate(returnPath, { replace: true });
		}
	}, [isAuthenticated, isHydrated, navigate, returnPath]);

	if (!isHydrated || isAuthenticated) return null;

	return (
		<div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-background relative">
			<div className="absolute top-4 right-16 z-10">
				<ThemeToggle />
			</div>

			<div className="sm:mx-auto sm:w-full sm:max-w-lg">
				<Link to="/" className="flex justify-center items-center">
					<img
						src="/logo-with-text.svg"
						alt="Apple RAG MCP"
						width={200}
						height={48}
						className="h-12 w-auto"
					/>
				</Link>
			</div>

			<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
				<Outlet />
			</div>
		</div>
	);
}
