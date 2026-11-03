import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { copyText } from "@/utils/clipboard";

interface Session {
	id: string;
	name: string;
	kind: "device" | "api_key";
	expires_at: number;
	created_at: number;
}
export function CLIAccess() {
	const { t } = useTranslation();
	const [rows, setRows] = useState<Session[]>([]),
		[loading, setLoading] = useState(true),
		[error, setError] = useState(false),
		[busy, setBusy] = useState(false),
		[name, setName] = useState(""),
		[days, setDays] = useState(30),
		[key, setKey] = useState<string | null>(null),
		[target, setTarget] = useState<Session | null>(null);
	const load = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const r = await api.get<Session[]>("/cli/sessions");
			if (!r.success || !r.data) throw Error();
			setRows(r.data);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		load();
	}, [load]);
	const create = async () => {
		setBusy(true);
		setKey(null);
		try {
			const r = await api.post<{ token: string }>("/cli/sessions", { name: name.trim(), days });
			if (!r.success || !r.data) throw Error();
			setKey(r.data.token);
			setName("");
			await load();
		} catch {
			toast.error(t("cli.access_error"));
		} finally {
			setBusy(false);
		}
	};
	const revoke = async () => {
		if (!target) return;
		setBusy(true);
		try {
			const r = await api.delete(`/cli/sessions/${encodeURIComponent(target.id)}`);
			if (!r.success) throw Error();
			setTarget(null);
			await load();
		} catch {
			toast.error(t("cli.access_error"));
		} finally {
			setBusy(false);
		}
	};
	return (
		<Card id="cli-access">
			<CardHeader>
				<CardTitle>{t("cli.access_title")}</CardTitle>
				<CardDescription>{t("cli.access_description")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<p className="text-sm text-muted-foreground">{t("cli.login_hint")}</p>
				<code className="block rounded-lg bg-background p-3 text-sm">apple-rag auth login</code>
				{error ? (
					<div role="alert" className="space-y-2">
						<p>{t("cli.access_error")}</p>
						<Button variant="outline" onClick={load}>
							{t("common.retry")}
						</Button>
					</div>
				) : loading ? (
					<p role="status">{t("common.loading")}</p>
				) : rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("cli.no_sessions")}</p>
				) : (
					<ul className="divide-y divide-border">
						{rows.map((row) => (
							<li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
								<div className="min-w-0">
									<p className="break-all text-sm font-medium">{row.name}</p>
									<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<Badge variant="outline">
											{t(row.kind === "device" ? "cli.device" : "cli.api_key")}
										</Badge>
										<span>
											{t("cli.expires", { date: new Date(row.expires_at).toLocaleString() })}
										</span>
									</div>
								</div>
								<Button size="sm" variant="outline" onClick={() => setTarget(row)}>
									{t("cli.revoke")}
								</Button>
							</li>
						))}
					</ul>
				)}
				<form
					className="space-y-3 border-t border-border pt-5"
					onSubmit={(e) => {
						e.preventDefault();
						create();
					}}
				>
					<h3 className="text-sm font-medium">{t("cli.create_key")}</h3>
					<p className="text-xs text-muted-foreground">{t("cli.key_description")}</p>
					<Input
						label={t("cli.key_name")}
						value={name}
						maxLength={80}
						required
						onChange={(e) => setName(e.target.value)}
					/>
					<label className="block space-y-1 text-sm">
						<span>{t("cli.validity")}</span>
						<select
							className="w-full rounded-md border border-default bg-background p-2"
							value={days}
							onChange={(e) => setDays(Number(e.target.value))}
						>
							{[7, 30, 90].map((n) => (
								<option key={n} value={n}>
									{t("cli.days", { count: n })}
								</option>
							))}
						</select>
					</label>
					<Button type="submit" loading={busy} disabled={busy || !name.trim() || rows.length >= 20}>
						{t("cli.create_key")}
					</Button>
				</form>
				{key && (
					<div className="space-y-3 rounded-lg border border-default p-4">
						<p className="text-sm">{t("cli.key_once")}</p>
						<code className="block break-all text-sm">{key}</code>
						<div className="flex gap-2">
							<Button
								size="sm"
								onClick={async () => {
									try {
										await copyText(key);
										toast.success(t("common.copied"));
									} catch {
										toast.error(t("common.copy_failed"));
									}
								}}
							>
								{t("common.copy")}
							</Button>
							<Button size="sm" variant="outline" onClick={() => setKey(null)}>
								{t("common.close")}
							</Button>
						</div>
					</div>
				)}
				<Dialog
					open={!!target}
					onOpenChange={(open) => {
						if (!open && !busy) setTarget(null);
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{t("cli.revoke")}</DialogTitle>
							<DialogDescription>
								{t("cli.revoke_description", { name: target?.name })}
							</DialogDescription>
						</DialogHeader>
						<Button variant="destructive" loading={busy} disabled={busy} onClick={revoke}>
							{t("cli.revoke")}
						</Button>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}
