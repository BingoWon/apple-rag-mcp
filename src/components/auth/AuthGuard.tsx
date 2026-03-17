import { Suspense, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoaderFive } from "@/components/ui/loader";
import { useAuth } from "@/hooks/useAuth";

function AuthGuardInner({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isHydrated } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const isOAuthCallback = searchParams.has("auth");

	useEffect(() => {
		if (isHydrated && !isAuthenticated && !isOAuthCallback) {
			navigate("/login/", { replace: true });
		}
	}, [isAuthenticated, isHydrated, isOAuthCallback, navigate]);

	if (!isHydrated) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<LoaderFive text="Loading..." />
			</div>
		);
	}

	if (!isAuthenticated && !isOAuthCallback) return null;

	return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<LoaderFive text="Loading..." />
				</div>
			}
		>
			<AuthGuardInner>{children}</AuthGuardInner>
		</Suspense>
	);
}
