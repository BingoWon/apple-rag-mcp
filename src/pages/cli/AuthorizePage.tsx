import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { rememberAuthReturn } from "@/lib/auth-return";

interface Authorization {
	client_name: string;
	device_name: string;
	kind: "code" | "device";
	status: string;
	expires_at: string;
	scope: string;
}
export default function AuthorizePage() {
	const { t } = useTranslation();
	const { isAuthenticated, isHydrated, user } = useAuth();
	const location = useLocation(),
		navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const request = params.get("request"),
		userCode = params.get("user_code");
	const [data, setData] = useState<Authorization | null>(null),
		[error, setError] = useState(false),
		[busy, setBusy] = useState(false),
		[done, setDone] = useState<boolean | null>(null),
		[code, setCode] = useState("");
	useEffect(() => {
		if (isHydrated && !isAuthenticated) {
			const path = location.pathname + location.search;
			rememberAuthReturn(path);
			navigate(`/login?return_to=${encodeURIComponent(path)}`, { replace: true });
		}
	}, [isHydrated, isAuthenticated, location.pathname, location.search, navigate]);
	useEffect(() => {
		if (!isAuthenticated || (!request && !userCode)) return;
		const controller = new AbortController();
		setError(false);
		setData(null);
		api
			.get<Authorization>("/cli/authorization", {
				params: request ? { request } : { user_code: userCode },
				signal: controller.signal,
			})
			.then((result) => {
				if (!result.success || !result.data) throw Error();
				setData(result.data);
			})
			.catch(() => {
				if (!controller.signal.aborted) setError(true);
			});
		return () => controller.abort();
	}, [isAuthenticated, request, userCode]);
	const decide = async (approve: boolean) => {
		setBusy(true);
		try {
			const result = await api.post<{ approved: boolean; redirect_uri?: string }>(
				"/cli/authorization",
				{ ...(request ? { request } : { user_code: userCode }), approve },
			);
			if (!result.success || !result.data) throw Error();
			const redirect = result.data.redirect_uri;
			if (redirect) {
				const url = new URL(redirect);
				if (
					url.protocol !== "http:" ||
					!["127.0.0.1", "[::1]"].includes(url.hostname) ||
					url.pathname !== "/callback" ||
					!url.port ||
					url.hash ||
					url.username ||
					url.password
				)
					throw Error();
				window.location.assign(url.href);
			}
			setDone(approve);
		} catch {
			setError(true);
		} finally {
			setBusy(false);
		}
	};
	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<Card className="w-full max-w-lg">
				<CardHeader>
					<Link to="/" className="mb-5">
						<img src="/logo-with-text.svg" alt="Apple RAG" className="h-9" />
					</Link>
					<CardTitle>{t("cli.authorize_title")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-5">
					{done !== null ? (
						<>
							<p role="status">{t(done ? "cli.authorized" : "cli.declined")}</p>
							<Link className="text-brand underline" to="/settings">
								{t("cli.manage")}
							</Link>
						</>
					) : error ? (
						<p role="alert" className="text-destructive">
							{t("cli.authorization_error")}
						</p>
					) : !request && !userCode ? (
						<form
							className="space-y-4"
							onSubmit={(e) => {
								e.preventDefault();
								setParams({ user_code: code.trim() });
							}}
						>
							<Input
								label={t("cli.device_code")}
								value={code}
								onChange={(e) => setCode(e.target.value)}
								maxLength={20}
								required
							/>
							<Button type="submit">{t("common.continue")}</Button>
						</form>
					) : data ? (
						<>
							<p className="text-sm text-muted-foreground">{t("cli.authorize_description")}</p>
							<dl className="space-y-3 rounded-lg border border-default p-4 text-sm">
								<div>
									<dt className="text-muted-foreground">{t("cli.account")}</dt>
									<dd className="break-all">{user?.email}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">{t("cli.device")}</dt>
									<dd className="break-all">{data.device_name}</dd>
								</div>
								{userCode && (
									<div>
										<dt className="text-muted-foreground">{t("cli.device_code")}</dt>
										<dd className="font-mono text-lg">{userCode}</dd>
									</div>
								)}
							</dl>
							<p className="text-sm">{t("cli.permissions")}</p>
							<p className="text-sm text-muted-foreground">{t("cli.consent_check")}</p>
							{data.status === "pending" ? (
								<div className="flex gap-3">
									<Button variant="outline" disabled={busy} onClick={() => decide(false)}>
										{t("cli.deny")}
									</Button>
									<Button loading={busy} disabled={busy} onClick={() => decide(true)}>
										{t("cli.allow")}
									</Button>
								</div>
							) : (
								<p>{t("cli.already_handled")}</p>
							)}
						</>
					) : (
						<p role="status">{t("common.loading")}</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
