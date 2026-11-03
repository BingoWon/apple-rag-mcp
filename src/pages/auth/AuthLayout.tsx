import { useEffect, useState } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
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
		<AuthShell>
			<Outlet />
		</AuthShell>
	);
}
