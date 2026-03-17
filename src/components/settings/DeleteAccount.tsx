import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
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
				toast.success("Account deleted successfully.\nYou will be redirected to the homepage.");

				// Close dialog
				setIsDialogOpen(false);

				// Logout and redirect after a short delay
				setTimeout(async () => {
					await logout();
					navigate("/");
				}, 2000);
			} else {
				throw new Error(response.error?.message || "Failed to delete account");
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to delete account. Please try again.";
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
				<CardTitle className="text-red-600 dark:text-red-400">Delete Account</CardTitle>
				<CardDescription>
					Permanently delete your account and all data. This cannot be undone.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="inline-flex items-center justify-center p-2.5 bg-red-100 dark:bg-red-950/70 border border-red-400 dark:border-red-600 rounded-lg">
						<div className="flex items-center gap-2">
							<span className="text-sm">⚠️</span>
							<p className="text-sm text-red-900 dark:text-red-100 font-semibold">
								This will permanently delete your account, tokens, and all data.
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
									Delete My Account
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle className="text-red-600 dark:text-red-400">
										Delete Account
									</DialogTitle>
									<DialogDescription>
										This will permanently delete your account and all data.
									</DialogDescription>
								</DialogHeader>

								<form
									onSubmit={confirmForm.handleSubmit(handleDeleteAccount)}
									className="space-y-4"
								>
									<div>
										<p className="text-sm text-muted-foreground mb-3">
											Type <strong>DELETE</strong> to confirm:
										</p>
										<Input
											placeholder="Type DELETE to confirm"
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
											Cancel
										</Button>
										<Button
											type="submit"
											variant="destructive"
											disabled={isLoading || !confirmForm.watch("confirmation")}
										>
											{isLoading ? "Deleting..." : "Delete Account"}
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
