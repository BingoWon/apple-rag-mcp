import { Fragment, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoaderFive } from "@/components/ui/loader";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { authReturnPath, clearAuthReturn, oauthReturnState } from "@/lib/auth-return";
import { useAuthStore } from "@/stores/auth";

const loading = (
	<div className="min-h-screen flex items-center justify-center">
		<LoaderFive text="Loading..." />
	</div>
);

function OAuthReturn({ state }: { state: string }) {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const exchange = useRef<ReturnType<typeof api.post<{ token: string }>>>(null);
	useEffect(() => {
		let active = true;
		exchange.current ??= api.post<{ token: string }>("/oauth/session/exchange", { state });
		exchange.current
			.then((response) => {
				if (!active) return;
				if (!response.success || !response.data) throw Error("Login expired");
				useAuthStore.getState().loginWithToken(response.data.token);
				toast.success(t("dashboard.welcome_oauth", { name: useAuthStore.getState().user?.name }));
				const path = authReturnPath();
				clearAuthReturn();
				navigate(path, { replace: true });
			})
			.catch(() => {
				if (active) {
					toast.error(t("dashboard.auth_failed"));
					navigate("/login", { replace: true });
				}
			});
		return () => {
			active = false;
		};
	}, [navigate, t, state]);
	return loading;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const { isHydrated, user, isAuthenticated } = useAuth();
	const location = useLocation();
	if (!isHydrated) return loading;
	const state = oauthReturnState(location);
	if (state) return <OAuthReturn key={state} state={state} />;
	if (!isAuthenticated || !user) return <Navigate to="/login/" replace />;
	return <Fragment key={user.id}>{children}</Fragment>;
}
