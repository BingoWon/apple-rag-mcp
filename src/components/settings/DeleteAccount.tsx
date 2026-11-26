import { IconAlertTriangle } from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { validateWithSchema } from "@/lib/form";

export function DeleteAccount() {
	const { t } = useTranslation();
	const deleteConfirmationSchema = z.object({
		confirmation: z.string().refine((val) => val === "DELETE", {
			message: t("settings.delete_type_confirm"),
		}),
	});

	const [confirmation, setConfirmation] = useState("");
	const [confirmationError, setConfirmationError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const { clearSession } = useAuth();
	const navigate = useNavigate();

	const resetForm = () => {
		setConfirmation("");
		setConfirmationError(undefined);
	};

	const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const result = validateWithSchema(deleteConfirmationSchema, { confirmation });
		if (!result.ok) {
			setConfirmationError(result.errors.confirmation);
			return;
		}
		setConfirmationError(undefined);
		setIsLoading(true);
		try {
			const response = await api.deleteAccount();

			if (response.success) {
				toast.success(t("settings.delete_success"));
				setIsDialogOpen(false);
				clearSession();
				navigate("/", { replace: true });
			} else {
				throw new Error(response.error?.message || t("settings.delete_error"));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t("settings.delete_error");
			toast.error(`${t("common.error")}\n${errorMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDialogOpenChange = (open: boolean) => {
		if (!open && isLoading) return;
		setIsDialogOpen(open);
		if (!open) resetForm();
	};

	return (
		<Card className="border-destructive/30">
			<CardHeader>
				<CardTitle className="text-destructive">{t("settings.delete_title")}</CardTitle>
				<CardDescription>{t("settings.delete_desc")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="inline-flex items-center justify-center p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg">
						<div className="flex items-center gap-2">
							<IconAlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
							<p className="text-sm text-destructive font-semibold">
								{t("settings.delete_warning")}
							</p>
						</div>
					</div>

					<div>
						<Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
							<DialogTrigger asChild>
								<Button
									variant="destructive"
									className="w-auto"
									onClick={() => setIsDialogOpen(true)}
								>
									{t("settings.delete_btn")}
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle className="text-destructive">
										{t("settings.delete_title")}
									</DialogTitle>
									<DialogDescription>{t("settings.delete_desc")}</DialogDescription>
								</DialogHeader>

								<form onSubmit={handleDeleteAccount} className="space-y-4">
									<div>
										<p className="text-sm text-subtle mb-3">
											{t("settings.delete_confirm_label")}:
										</p>
										<Input
											placeholder={t("settings.delete_confirm_placeholder")}
											value={confirmation}
											onChange={(event) => {
												setConfirmation(event.target.value);
												if (confirmationError) setConfirmationError(undefined);
											}}
											error={confirmationError}
											className="font-mono"
										/>
									</div>

									<DialogFooter className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => handleDialogOpenChange(false)}
											disabled={isLoading}
										>
											{t("common.cancel")}
										</Button>
										<Button
											type="submit"
											variant="destructive"
											disabled={isLoading || !confirmation}
										>
											{isLoading ? t("settings.deleting") : t("settings.delete_title")}
										</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
