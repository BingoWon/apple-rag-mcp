import {
	IconArrowRight,
	IconCheck,
	IconDeviceLaptop,
	IconLock,
	IconMail,
	IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { rememberAuthReturn } from "@/lib/auth-return";
import { useAuthStore } from "@/stores/auth";

interface Authorization {
	client_name: string;
	device_name: string;
	kind: "code" | "device";
	status: string;
	expires_at: string;
	scope: string;
}
export default function AuthorizePage() {
	const { user } = useAuth();
	return <AuthorizationForm key={user?.id ?? "anonymous"} />;
}
function AuthorizationForm() {
	const { t, i18n } = useTranslation();
	const { resolvedTheme } = useTheme();
	const { isAuthenticated, isHydrated, user, token } = useAuth();
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
		setDone(null);
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
		if (!token || useAuthStore.getState().token !== token) return;
		setBusy(true);
		try {
			const result = await api.post<{ approved: boolean; redirect_uri?: string }>(
				"/cli/authorization",
				{ ...(request ? { request } : { user_code: userCode }), approve },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			if (useAuthStore.getState().token !== token) return;
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
				url.searchParams.set("lang", i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en");
				url.searchParams.set("theme", resolvedTheme);
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
		<AuthShell>
			{done !== null || error || (data && data.status !== "pending") ? (
				<div className="auth-status" role={error ? "alert" : "status"}>
					<div
						className="auth-status-icon"
						data-tone={error ? "error" : done === true ? "success" : "neutral"}
					>
						{error || done === false ? (
							<IconX aria-hidden="true" />
						) : (
							<IconCheck aria-hidden="true" />
						)}
					</div>
					<h1 className="auth-title">
						{t(
							error
								? "cli.error_title"
								: done === true
									? "cli.success_title"
									: done === false
										? "cli.denied_title"
										: "cli.handled_title",
						)}
					</h1>
					<p className="auth-description">
						{t(
							error
								? "cli.authorization_error"
								: done === true
									? "cli.authorized"
									: done === false
										? "cli.declined"
										: "cli.already_handled",
						)}
					</p>
					{error ? (
						<div className="auth-command">apple-rag auth login</div>
					) : (
						<div className="auth-actions">
							<Button asChild variant="outline" className="auth-secondary">
								<Link to="/settings#cli-access">
									{t("cli.manage")}
									<IconArrowRight size={16} />
								</Link>
							</Button>
						</div>
					)}
				</div>
			) : !request && !userCode ? (
				<>
					<p className="auth-kicker">{t("cli.login_label")}</p>
					<h1 className="auth-title">{t("cli.enter_code_title")}</h1>
					<p className="auth-description">{t("cli.enter_code_description")}</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setParams({ user_code: code.trim() });
						}}
					>
						<label className="auth-field-label" htmlFor="device-code">
							{t("cli.device_code")}
						</label>
						<Input
							id="device-code"
							value={code}
							onChange={(e) => setCode(e.target.value.toUpperCase())}
							maxLength={20}
							autoComplete="off"
							spellCheck={false}
							required
							placeholder="XXXXX-XXXXX"
							className="font-mono tracking-widest"
						/>
						<div className="auth-actions">
							<Button type="submit" variant="primary" className="auth-primary">
								{t("common.continue")}
								<IconArrowRight size={16} />
							</Button>
						</div>
					</form>
				</>
			) : data ? (
				<>
					<p className="auth-kicker">{t("cli.login_label")}</p>
					<h1 className="auth-title">{t("cli.authorize_title")}</h1>
					<p className="auth-description">{t("cli.authorize_description")}</p>
					<dl className="auth-identity">
						<div className="auth-identity-row">
							<IconMail className="auth-row-icon" aria-hidden="true" />
							<div>
								<dt>{t("cli.account")}</dt>
								<dd>{user?.email}</dd>
							</div>
						</div>
						<div className="auth-identity-row">
							<IconDeviceLaptop className="auth-row-icon" aria-hidden="true" />
							<div>
								<dt>{t("cli.device")}</dt>
								<dd>{data.device_name}</dd>
							</div>
						</div>
					</dl>
					{userCode && (
						<div className="auth-code">
							<strong>{userCode}</strong>
							<p>{t("cli.match_code")}</p>
						</div>
					)}
					<ul className="auth-permissions">
						<li>
							<IconCheck className="auth-check" aria-hidden="true" />
							{t("cli.search_permission")}
						</li>
						<li>
							<IconCheck className="auth-check" aria-hidden="true" />
							{t("cli.read_permission")}
						</li>
					</ul>
					<p className="auth-note">{t("cli.quota_note")}</p>
					<div className="auth-actions">
						<Button
							variant="outline"
							className="auth-secondary"
							disabled={busy}
							onClick={() => decide(false)}
						>
							{t("cli.deny")}
						</Button>
						<Button
							variant="primary"
							className="auth-primary"
							loading={busy}
							disabled={busy}
							onClick={() => decide(true)}
						>
							{t("cli.allow")}
							<IconArrowRight size={16} aria-hidden="true" />
						</Button>
					</div>
					<p className="auth-safety">
						<IconLock aria-hidden="true" />
						{t("cli.consent_check")}
					</p>
				</>
			) : (
				<div className="auth-loading" role="status">
					<span className="auth-spinner" aria-hidden="true" />
					{t("common.loading")}
				</div>
			)}
		</AuthShell>
	);
}
