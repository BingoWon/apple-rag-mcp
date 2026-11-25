import { zodResolver } from "@hookform/resolvers/zod";
import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthorizedIPsList } from "@/components/dashboard/AuthorizedIPsList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { canonicalIP } from "../../../shared/ip";

interface AuthorizedIP {
	id: string;
	ip_address: string;
	name: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

export default function AuthorizedIPsPage() {
	const { t } = useTranslation();
	const authorizedIPSchema = z.object({
		ip_address: z.string().refine((value) => !!canonicalIP(value), t("ips.invalid_ip")),
		name: z.string().trim().min(1, t("ips.name_required")).max(100, t("ips.name_too_long")),
	});
	type AuthorizedIPFormData = z.infer<typeof authorizedIPSchema>;

	const [ips, setIPs] = useState<AuthorizedIP[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [currentIP, setCurrentIP] = useState<string | null>(null);

	const form = useForm<AuthorizedIPFormData>({
		resolver: zodResolver(authorizedIPSchema),
		defaultValues: {
			ip_address: "",
			name: "",
		},
	});

	// Load authorized IPs + first-party Cloudflare-detected client IP
	const loadIPs = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			const response = (await api.getAuthorizedIPs()) as {
				success: boolean;
				data?: AuthorizedIP[];
				client_ip?: string | null;
				error?: { message?: string };
			};
			if (response.success && response.data) {
				setIPs(Array.isArray(response.data) ? response.data : []);
				setCurrentIP(response.client_ip ?? "");
			} else {
				const msg = response.error?.message || t("ips.load_error");
				setLoadError(msg);
				setCurrentIP("");
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : t("ips.load_error");
			setLoadError(msg);
			setCurrentIP("");
			toast.error(t("ips.load_error"));
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		loadIPs();
	}, [loadIPs]);

	// Create new authorized IP
	const onSubmit = async (data: AuthorizedIPFormData) => {
		setIsCreating(true);
		try {
			const response = await api.createAuthorizedIP(data);
			if (response.success) {
				toast.success(t("ips.added_success", { name: data.name }));
				form.reset();
				setIsAddOpen(false);
				loadIPs();
			} else {
				const errorMessage = response.error?.message || t("ips.create_error");
				toast.error(errorMessage);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t("ips.create_error");
			toast.error(errorMessage);
		} finally {
			setIsCreating(false);
		}
	};

	// Update authorized IP name
	const handleUpdate = async (id: string, name: string) => {
		const response = await api.updateAuthorizedIP(id, { name });
		if (!response.success) {
			throw new Error(response.error?.message || t("ips.update_error"));
		}
	};

	// Delete authorized IP
	const handleDelete = async (id: string) => {
		const response = await api.deleteAuthorizedIP(id);
		if (!response.success) {
			if (response.error?.code === "RESOURCE_NOT_FOUND") {
				return;
			}
			throw new Error(response.error?.message || t("ips.delete_error"));
		}
	};

	// Auto-fill current IP
	const fillCurrentIP = () => {
		if (currentIP) {
			form.setValue("ip_address", currentIP, { shouldValidate: true });
		}
	};

	const handleAddOpenChange = (open: boolean) => {
		if (!open && isCreating) return;
		setIsAddOpen(open);
		if (!open) form.reset();
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("ips.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("ips.subtitle")}</p>
			</div>

			{/* Current IP Info */}
			<Card>
				<CardContent className="p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<IconInfoCircle className="h-5 w-5 text-brand" />
						</div>
						<div className="ml-3 min-w-0">
							<h3 className="text-sm font-medium text-foreground break-all">
								{t("ips.current_ip")}{" "}
								<span className="font-mono text-brand">
									{currentIP === null ? t("common.loading") : currentIP || t("ips.detect_failed")}
								</span>
							</h3>
							<div className="mt-2 text-sm text-muted">
								<p>{t("ips.current_ip_desc")}</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Authorized IPs List */}
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<CardTitle>{t("ips.your_ips", { count: ips.length })}</CardTitle>
						<Dialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
							<DialogTrigger asChild>
								<Button variant="primary" disabled={ips.length >= 10}>
									<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
									{t("ips.add")}
								</Button>
							</DialogTrigger>
							<AddIPDialogContent
								currentIP={currentIP || ""}
								form={form}
								isCreating={isCreating}
								onSubmit={onSubmit}
								onCancel={() => handleAddOpenChange(false)}
								fillCurrentIP={fillCurrentIP}
							/>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{loadError ? (
						<div
							role="alert"
							className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm"
						>
							<span className="text-destructive">{loadError}</span>
							<Button variant="outline" size="sm" onClick={() => void loadIPs()}>
								{t("common.retry")}
							</Button>
						</div>
					) : (
						<AuthorizedIPsList
							ips={ips}
							onRefresh={loadIPs}
							onUpdate={handleUpdate}
							onDelete={handleDelete}
							isLoading={isLoading}
						/>
					)}
				</CardContent>
			</Card>

			{/* Maximum limit reached */}
			{ips.length >= 10 && (
				<Card>
					<CardContent className="p-4">
						<div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
							<p className="text-sm text-warning">{t("ips.max_reached")}</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Usage Instructions */}
			<Card>
				<CardContent className="p-4">
					<h3 className="text-sm font-medium text-foreground mb-2">{t("ips.how_title")}</h3>
					<ul className="text-sm text-muted space-y-1">
						<li>• {t("ips.how_1")}</li>
						<li>• {t("ips.how_2")}</li>
						<li>• {t("ips.how_3")}</li>
						<li>• {t("ips.how_4")}</li>
						<li>• {t("ips.how_5")}</li>
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}

interface AddIPDialogContentProps {
	currentIP: string;
	form: UseFormReturn<{ ip_address: string; name: string }>;
	isCreating: boolean;
	onSubmit: (data: { ip_address: string; name: string }) => void;
	onCancel: () => void;
	fillCurrentIP: () => void;
}

function AddIPDialogContent({
	currentIP,
	form,
	isCreating,
	onSubmit,
	onCancel,
	fillCurrentIP,
}: AddIPDialogContentProps) {
	const { t } = useTranslation();

	return (
		<DialogContent className="max-w-lg">
			<DialogHeader className="text-center">
				<DialogTitle className="text-xl font-semibold text-foreground">
					{t("ips.add_title")}
				</DialogTitle>
				<DialogDescription className="text-sm text-subtle">
					{t("ips.add_subtitle")}
				</DialogDescription>
			</DialogHeader>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
				<div className="space-y-4">
					<div className="space-y-1.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<label htmlFor="ip_address" className="text-sm font-medium text-foreground">
								{t("ips.ip_label")}
							</label>
							<Button
								type="button"
								variant="link"
								onClick={fillCurrentIP}
								disabled={!currentIP}
								className="h-auto max-w-full p-0 text-xs font-mono truncate"
							>
								{currentIP
									? t("ips.use_current", { ip: currentIP })
									: t("ips.use_current_fallback")}
							</Button>
						</div>
						<Input
							id="ip_address"
							placeholder={t("ips.ip_placeholder")}
							{...form.register("ip_address")}
							error={form.formState.errors.ip_address?.message}
							className="font-mono"
						/>
					</div>

					<Input
						label={t("ips.name_label")}
						placeholder={t("ips.name_placeholder")}
						{...form.register("name")}
						error={form.formState.errors.name?.message}
					/>
				</div>

				<div className="flex gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isCreating}
						className="flex-1"
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="submit"
						variant="primary"
						loading={isCreating}
						disabled={isCreating}
						className="flex-1"
					>
						{t("ips.add_btn")}
					</Button>
				</div>
			</form>
		</DialogContent>
	);
}
