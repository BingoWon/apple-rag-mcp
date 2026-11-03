import {
	IconCheck,
	IconCopy,
	IconDeviceLaptop,
	IconKey,
	IconPlus,
	IconTerminal2,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
	const [createOpen, setCreateOpen] = useState(false);
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
			setCreateOpen(false);
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
		<Card id="cli-access" className="rounded-xl shadow-none">
			<CardHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b border-default space-y-0">
				<div className="flex gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-secondary">
						<IconTerminal2 size={20} className="text-brand" />
					</div>
					<div>
						<CardTitle className="text-base leading-6">{t("cli.access_title")}</CardTitle>
						<CardDescription className="mt-1 max-w-md text-xs leading-relaxed">
							{t("cli.access_description")}
						</CardDescription>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setCreateOpen(true)}
					disabled={busy || rows.length >= 20}
				>
					<IconPlus size={14} />
					{t("cli.create_key")}
				</Button>
			</CardHeader>
			<CardContent className="p-0">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-secondary/50 px-6 py-4">
					<div className="min-w-0">
						<p className="text-xs text-muted-foreground mb-2">{t("cli.login_hint")}</p>
						<code className="text-[13px] font-medium text-foreground">apple-rag auth login</code>
					</div>
					<Button
						size="icon"
						variant="outline"
						aria-label={t("cli.copy_command")}
						onClick={async () => {
							try {
								await copyText("apple-rag auth login");
								toast.success(t("common.copied"));
							} catch {
								toast.error(t("common.copy_failed"));
							}
						}}
					>
						<IconCopy size={15} />
					</Button>
				</div>
				{error ? (
					<div role="alert" className="flex items-center justify-between gap-3 px-6 py-5 text-sm">
						<p>{t("cli.access_error")}</p>
						<Button variant="outline" size="sm" onClick={load}>
							{t("common.retry")}
						</Button>
					</div>
				) : loading ? (
					<div role="status" className="px-6 py-8 text-center text-sm text-muted-foreground">
						{t("common.loading")}
					</div>
				) : rows.length === 0 ? (
					<div className="px-6 py-8 text-center">
						<IconDeviceLaptop size={24} className="mx-auto mb-3 text-muted-foreground" />
						<p className="text-sm font-medium">{t("cli.no_sessions_title")}</p>
						<p className="mt-1 text-xs text-muted-foreground">{t("cli.no_sessions")}</p>
					</div>
				) : (
					<ul className="divide-y divide-border">
						{rows.map((row) => (
							<li key={row.id} className="flex items-center justify-between gap-3 px-6 py-4">
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-default bg-secondary text-muted-foreground">
										{row.kind === "device" ? <IconDeviceLaptop size={18} /> : <IconKey size={18} />}
									</div>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium" title={row.name}>
											{row.name}
										</p>
										<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
											<span>{t(row.kind === "device" ? "cli.device" : "cli.api_key")}</span>
											<span aria-hidden="true">·</span>
											<span>
												{t("cli.expires", { date: new Date(row.expires_at).toLocaleDateString() })}
											</span>
										</div>
									</div>
								</div>
								<Button
									size="sm"
									variant="link"
									className="shrink-0 text-muted-foreground hover:text-error"
									onClick={() => setTarget(row)}
									aria-label={t("cli.revoke_named", { name: row.name })}
								>
									{t("cli.revoke")}
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<Dialog
				open={createOpen}
				onOpenChange={(open) => {
					if (!busy) setCreateOpen(open);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("cli.create_key")}</DialogTitle>
						<DialogDescription>{t("cli.key_description")}</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-5"
						onSubmit={(e) => {
							e.preventDefault();
							create();
						}}
					>
						<Input
							id="cli-key-name"
							label={t("cli.key_name")}
							placeholder={t("cli.key_placeholder")}
							value={name}
							maxLength={80}
							required
							onChange={(e) => setName(e.target.value)}
						/>
						<label className="block space-y-1.5 text-sm" htmlFor="cli-key-validity">
							<span className="font-medium">{t("cli.validity")}</span>
							<select
								id="cli-key-validity"
								className="h-11 w-full rounded-lg border border-default bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
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
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
								{t("common.cancel")}
							</Button>
							<Button
								variant="primary"
								type="submit"
								loading={busy}
								disabled={busy || !name.trim() || rows.length >= 20}
							>
								{t("cli.create_key")}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
			<Dialog
				open={key !== null}
				onOpenChange={(open) => {
					if (!open) setKey(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success">
							<IconCheck size={22} />
						</div>
						<DialogTitle>{t("cli.key_created")}</DialogTitle>
						<DialogDescription>{t("cli.key_once")}</DialogDescription>
					</DialogHeader>
					<code className="block break-all rounded-lg border border-default bg-secondary p-4 text-xs leading-relaxed">
						{key}
					</code>
					<div className="mt-5 flex justify-end gap-2">
						<Button variant="outline" onClick={() => setKey(null)}>
							{t("common.close")}
						</Button>
						<Button
							variant="primary"
							onClick={async () => {
								if (!key) return;
								try {
									await copyText(key);
									toast.success(t("common.copied"));
								} catch {
									toast.error(t("common.copy_failed"));
								}
							}}
						>
							<IconCopy size={15} />
							{t("common.copy")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
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
					<div className="flex justify-end gap-2">
						<Button variant="outline" disabled={busy} onClick={() => setTarget(null)}>
							{t("common.cancel")}
						</Button>
						<Button variant="destructive" loading={busy} disabled={busy} onClick={revoke}>
							{t("cli.revoke")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
