import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
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

// Confirmation schema
const deleteConfirmationSchema = z.object({
	confirmation: z.string().refine((val) => val === "DELETE", {
		message: "Please type DELETE to confirm",
	}),
});

type DeleteConfirmationData = z.infer<typeof deleteConfirmationSchema>;

export function DeleteAccount() {
	const { t } = useTranslation();
	const [isLoading, setIsLoading] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const confirmForm = useForm<DeleteConfirmationData>({
		resolver: zodResolver(deleteConfirmationSchema),
	});

	const handleDeleteAccount = async (_data: DeleteConfirmationData) => {
		setIsLoading(true);
		try {
			const response = await api.deleteAccount();

			if (response.success) {
				toast.success(t("settings.delete_success"));

				// Close dialog
				setIsDialogOpen(false);

				// Logout and redirect after a short delay
				setTimeout(async () => {
					await logout();
					navigate("/");
				}, 2000);
			} else {
				throw new Error(response.error?.message || t("settings.delete_error"));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t("settings.delete_error");
			toast.error(`Error\n${errorMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDialogClose = () => {
		setIsDialogOpen(false);
		confirmForm.reset();
	};

	return (
		<Card className="border-red-200 dark:border-red-800">
			<CardHeader>
				<CardTitle className="text-red-600 dark:text-red-400">
					{t("settings.delete_title")}
				</CardTitle>
				<CardDescription>{t("settings.delete_desc")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="inline-flex items-center justify-center p-2.5 bg-red-100 dark:bg-red-950/70 border border-red-400 dark:border-red-600 rounded-lg">
						<div className="flex items-center gap-2">
							<span className="text-sm">⚠️</span>
							<p className="text-sm text-red-900 dark:text-red-100 font-semibold">
								{t("settings.delete_warning")}
							</p>
						</div>
					</div>

					<div>
						<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
									<DialogTitle className="text-red-600 dark:text-red-400">
										{t("settings.delete_title")}
									</DialogTitle>
									<DialogDescription>{t("settings.delete_desc")}</DialogDescription>
								</DialogHeader>

								<form
									onSubmit={confirmForm.handleSubmit(handleDeleteAccount)}
									className="space-y-4"
								>
									<div>
										<p className="text-sm text-muted-foreground mb-3">
											{t("settings.delete_confirm_label")}:
										</p>
										<Input
											placeholder={t("settings.delete_confirm_placeholder")}
											{...confirmForm.register("confirmation")}
											error={confirmForm.formState.errors.confirmation?.message}
											className="font-mono"
										/>
									</div>

									<DialogFooter className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={handleDialogClose}
											disabled={isLoading}
										>
											{t("common.cancel")}
										</Button>
										<Button
											type="submit"
											variant="destructive"
											disabled={isLoading || !confirmForm.watch("confirmation")}
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
