import { IconClipboard, IconDownload } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { INSTALL_CLIENTS, type MCPInstallClient, PROMPT_CLIENTS } from "@/constants/mcpClients";
import { cn } from "@/lib/utils";
import { copyText } from "@/utils/clipboard";
import { MCPConfigService } from "@/utils/mcpConfigService";

interface MCPInstallButtonsProps {
	token: string;
	serverUrl: string;
	disabled?: boolean;
	className?: string;
}

function ClientButton({
	client,
	token,
	serverUrl,
	disabled,
}: {
	client: MCPInstallClient;
	token: string;
	serverUrl: string;
	disabled: boolean;
}) {
	const { t } = useTranslation();

	const handleClick = async () => {
		try {
			const messageKey = await client.action(token, serverUrl);
			toast.success(t(messageKey, { client: client.label }));
		} catch {
			toast.error(t("common.copy_failed"));
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled || !token}
			className={cn(
				"inline-flex items-center gap-2",
				"px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				"bg-tertiary text-light border border-default",
				"hover:bg-secondary hover:border-light hover:shadow-sm hover:scale-[1.02]",
				"active:scale-[0.98]",
			)}
		>
			<img
				src={client.logo}
				alt={client.alt}
				className="w-4 h-4 bg-white rounded-sm flex-shrink-0"
			/>
			<span className="whitespace-nowrap">{client.label}</span>
		</button>
	);
}

export function MCPInstallButtons({
	token,
	serverUrl,
	disabled = false,
	className,
}: MCPInstallButtonsProps) {
	const { t, i18n } = useTranslation();

	const handleCopyPrompt = async () => {
		try {
			await copyText(
				MCPConfigService.generateInstallPrompt({ token, serverUrl }, i18n.resolvedLanguage),
			);
			toast.success(t("guide.install_prompt_copied"));
		} catch {
			toast.error(t("guide.copy_clipboard_failed"));
		}
	};

	return (
		<div className={cn("space-y-4", className)}>
			<Button
				type="button"
				variant="primary"
				onClick={handleCopyPrompt}
				disabled={disabled || !token}
				title={PROMPT_CLIENTS.map((client) => client.label).join(", ")}
				className="w-full h-auto min-h-14 flex-wrap gap-x-3 gap-y-2 px-4 py-3"
			>
				<span aria-hidden="true" className="flex -space-x-2 shrink-0">
					{PROMPT_CLIENTS.map((client) => (
						<span
							key={client.label}
							className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand bg-white"
						>
							<img src={client.logo} alt="" width={20} height={20} className="h-5 w-5" />
						</span>
					))}
				</span>
				<span className="inline-flex min-w-0 items-center gap-2">
					<IconClipboard className="h-4 w-4 shrink-0" aria-hidden="true" />
					<span>{t("guide.copy_install_prompt")}</span>
				</span>
			</Button>
			{/* One-click Install */}
			<div>
				<div className="flex items-center gap-1.5 mb-2">
					<IconDownload className="h-3.5 w-3.5 text-success" />
					<span className="text-xs font-semibold text-muted uppercase tracking-wide">
						{t("guide.section_install")}
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{INSTALL_CLIENTS.map((c) => (
						<ClientButton
							key={c.key}
							client={c}
							token={token}
							serverUrl={serverUrl}
							disabled={disabled}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
