import { zodResolver } from "@hookform/resolvers/zod";
import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthorizedIPsList } from "@/components/dashboard/AuthorizedIPsList";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalTrigger,
	useModal,
} from "@/components/ui/animated-modal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";

// IP validation regex (IPv4 and IPv6)
const IP_REGEX =
	/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

const authorizedIPSchema = z.object({
	ip_address: z.string().regex(IP_REGEX, "Invalid IP address format"),
	name: z.string().min(1, "Name is required").max(50, "Name too long"),
});

type AuthorizedIPFormData = z.infer<typeof authorizedIPSchema>;

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
	const [ips, setIPs] = useState<AuthorizedIP[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [currentIP, setCurrentIP] = useState<string>("");

	const form = useForm<AuthorizedIPFormData>({
		resolver: zodResolver(authorizedIPSchema),
		defaultValues: {
			ip_address: "",
			name: "",
		},
	});

	// Get current user's IP
	useEffect(() => {
		fetch("https://api.ipify.org?format=json")
			.then((res) => res.json())
			.then((data) => setCurrentIP(data.ip))
			.catch(() => setCurrentIP("Unable to detect"));
	}, []);

	// Load authorized IPs
	const loadIPs = useCallback(async () => {
		try {
			const response = await api.getAuthorizedIPs();
			if (response.success && response.data) {
				setIPs(Array.isArray(response.data) ? response.data : []);
			}
		} catch (_error) {
			toast.error(t("ips.load_error"));
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		loadIPs();
	}, [loadIPs]);

	// Create new authorized IP
	const onSubmit = async (data: AuthorizedIPFormData, closeModal?: () => void) => {
		setIsCreating(true);
		try {
			const response = await api.createAuthorizedIP(data);
			if (response.success) {
				// Track IP authorization
				trackEvent("IP_AUTHORIZE", {
					ip_address: data.ip_address,
					ip_name: data.name,
					total_ips: ips.length + 1,
				});

				toast.success(t("ips.added_success", { name: data.name }));
				form.reset();
				closeModal?.(); // Close modal on success
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
			throw new Error(response.error?.message || "Failed to update authorized IP");
		}
	};

	// Delete authorized IP
	const handleDelete = async (id: string) => {
		const response = await api.deleteAuthorizedIP(id);
		if (!response.success) {
			// If the error is "not found", it might already be deleted, so don't throw
			if (response.error?.message?.includes("not found")) {
				console.warn("IP already deleted or not found:", id);
				return; // Silently succeed
			}
			throw new Error(response.error?.message || "Failed to delete authorized IP");
		}
	};

	// Auto-fill current IP
	const fillCurrentIP = () => {
		if (currentIP && currentIP !== "Unable to detect") {
			form.setValue("ip_address", currentIP);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("ips.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("ips.subtitle")}</p>
			</div>

			{/* Current IP Info */}
			<Card>
				<CardContent className="p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<IconInfoCircle className="h-5 w-5 text-info" />
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-light">
								{t("ips.current_ip")} <span className="font-mono text-brand">{currentIP}</span>
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
					<div className="flex items-center justify-between">
						<CardTitle>{t("ips.your_ips", { count: ips.length })}</CardTitle>
						<Modal>
							<ModalTrigger>
								<Button variant="primary" disabled={ips.length >= 10}>
									<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
									{t("ips.add")}
								</Button>
							</ModalTrigger>
							<AddIPModal
								currentIP={currentIP}
								form={form}
								isCreating={isCreating}
								onSubmit={onSubmit}
								fillCurrentIP={fillCurrentIP}
							/>
						</Modal>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<AuthorizedIPsList
						ips={ips}
						onRefresh={loadIPs}
						onUpdate={handleUpdate}
						onDelete={handleDelete}
						isLoading={isLoading}
					/>
				</CardContent>
			</Card>

			{/* Maximum limit reached */}
			{ips.length >= 10 && (
				<Card>
					<CardContent className="p-4">
						<div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
							<p className="text-sm text-yellow-700 dark:text-yellow-300">{t("ips.max_reached")}</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Usage Instructions */}
			<Card>
				<CardContent className="p-4">
					<h3 className="text-sm font-medium text-light mb-2">{t("ips.how_title")}</h3>
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

interface AddIPModalProps {
	currentIP: string;
	form: UseFormReturn<AuthorizedIPFormData>;
	isCreating: boolean;
	onSubmit: (data: AuthorizedIPFormData, closeModal?: () => void) => void;
	fillCurrentIP: () => void;
}

function AddIPModal({ currentIP, form, isCreating, onSubmit, fillCurrentIP }: AddIPModalProps) {
	const { t } = useTranslation();
	const { setOpen } = useModal();

	const handleClose = () => {
		setOpen(false);
		form.reset();
	};

	return (
		<ModalBody className="max-w-lg">
			<ModalContent className="space-y-6">
				{/* Header */}
				<div className="text-center">
					<h2 className="text-xl font-semibold text-foreground">{t("ips.add_title")}</h2>
					<p className="text-sm text-muted-foreground mt-2">{t("ips.add_subtitle")}</p>
				</div>

				<form
					onSubmit={form.handleSubmit((data: AuthorizedIPFormData) =>
						onSubmit(data, () => setOpen(false)),
					)}
					className="space-y-6"
				>
					<div className="space-y-4">
						<div>
							<label
								htmlFor="ip_address"
								className="block text-sm font-medium text-foreground mb-2"
							>
								{t("ips.ip_label")}
							</label>
							<div className="inline-flex items-center gap-2">
								<Input
									id="ip_address"
									placeholder={t("ips.ip_placeholder")}
									{...form.register("ip_address")}
									error={form.formState.errors.ip_address?.message}
									className="w-auto min-w-[200px]"
								/>
								<Button
									type="button"
									variant="link"
									onClick={fillCurrentIP}
									disabled={!currentIP || currentIP === "Unable to detect"}
									className="text-sm p-0 h-auto"
								>
									{currentIP && currentIP !== "Unable to detect"
										? t("ips.use_current", { ip: currentIP })
										: t("ips.use_current_fallback")}
								</Button>
							</div>
							{form.formState.errors.ip_address && (
								<p className="mt-1 text-xs text-destructive">
									{form.formState.errors.ip_address.message}
								</p>
							)}
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
							onClick={handleClose}
							disabled={isCreating}
							className="flex-1"
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="submit"
							variant="primary"
							loading={isCreating}
							disabled={!form.formState.isValid}
							className="flex-1"
						>
							{t("ips.add_btn")}
						</Button>
					</div>
				</form>
			</ModalContent>
		</ModalBody>
	);
}
