import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
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
import { type FieldErrors, validateWithSchema } from "@/lib/form";
import { canonicalIP } from "../../../shared/ip";

interface AuthorizedIP {
	id: string;
	ip_address: string;
	name: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

interface AuthorizedIPFields extends Record<string, string> {
	ip_address: string;
	name: string;
}

const INITIAL_FIELDS: AuthorizedIPFields = { ip_address: "", name: "" };

export default function AuthorizedIPsPage() {
	const { t } = useTranslation();
	const authorizedIPSchema = z.object({
		ip_address: z.string().refine((value) => !!canonicalIP(value), t("ips.invalid_ip")),
		name: z.string().trim().min(1, t("ips.name_required")).max(100, t("ips.name_too_long")),
	});

	const [ips, setIPs] = useState<AuthorizedIP[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [currentIP, setCurrentIP] = useState<string | null>(null);
	const [fields, setFields] = useState<AuthorizedIPFields>(INITIAL_FIELDS);
	const [errors, setErrors] = useState<FieldErrors<AuthorizedIPFields>>({});

	const resetForm = () => {
		setFields(INITIAL_FIELDS);
		setErrors({});
	};

	const updateField = (key: keyof AuthorizedIPFields, value: string) => {
		setFields((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) {
			setErrors((prev) => ({ ...prev, [key]: undefined }));
		}
	};

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

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const result = validateWithSchema(authorizedIPSchema, fields);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setErrors({});
		setIsCreating(true);
		try {
			const response = await api.createAuthorizedIP(result.data);
			if (response.success) {
				toast.success(t("ips.added_success", { name: result.data.name }));
				resetForm();
				setIsAddOpen(false);
				loadIPs();
			} else {
				toast.error(response.error?.message || t("ips.create_error"));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t("ips.create_error");
			toast.error(errorMessage);
		} finally {
			setIsCreating(false);
		}
	};

	const handleUpdate = async (id: string, name: string) => {
		const response = await api.updateAuthorizedIP(id, { name });
		if (!response.success) {
			throw new Error(response.error?.message || t("ips.update_error"));
		}
	};

	const handleDelete = async (id: string) => {
		const response = await api.deleteAuthorizedIP(id);
		if (!response.success) {
			if (response.error?.code === "RESOURCE_NOT_FOUND") {
				return;
			}
			throw new Error(response.error?.message || t("ips.delete_error"));
		}
	};

	const fillCurrentIP = () => {
		if (!currentIP) return;
		setFields((prev) => ({ ...prev, ip_address: currentIP }));
		setErrors((prev) => ({
			...prev,
			ip_address: canonicalIP(currentIP) ? undefined : t("ips.invalid_ip"),
		}));
	};

	const handleAddOpenChange = (open: boolean) => {
		if (!open && isCreating) return;
		setIsAddOpen(open);
		if (!open) resetForm();
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("ips.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("ips.subtitle")}</p>
			</div>

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
								fields={fields}
								errors={errors}
								isCreating={isCreating}
								onFieldChange={updateField}
								onSubmit={handleSubmit}
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

			{ips.length >= 10 && (
				<Card>
					<CardContent className="p-4">
						<div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
							<p className="text-sm text-warning">{t("ips.max_reached")}</p>
						</div>
					</CardContent>
				</Card>
			)}

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
	fields: AuthorizedIPFields;
	errors: FieldErrors<AuthorizedIPFields>;
	isCreating: boolean;
	onFieldChange: (key: keyof AuthorizedIPFields, value: string) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onCancel: () => void;
	fillCurrentIP: () => void;
}

function AddIPDialogContent({
	currentIP,
	fields,
	errors,
	isCreating,
	onFieldChange,
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

			<form onSubmit={onSubmit} className="space-y-5">
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
							value={fields.ip_address}
							onChange={(event) => onFieldChange("ip_address", event.target.value)}
							error={errors.ip_address}
							className="font-mono"
						/>
					</div>

					<Input
						label={t("ips.name_label")}
						placeholder={t("ips.name_placeholder")}
						value={fields.name}
						onChange={(event) => onFieldChange("name", event.target.value)}
						error={errors.name}
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
