import { IconClipboard, IconDownload } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { COPY_CLIENTS, INSTALL_CLIENTS, type MCPClientConfig } from "@/constants/mcpClients";
import { cn } from "@/lib/utils";

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
	client: MCPClientConfig;
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
			disabled={disabled}
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
	const { t } = useTranslation();

	return (
		<div className={cn("space-y-4", className)}>
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

			{/* Copy Configuration */}
			<div>
				<div className="flex items-center gap-1.5 mb-2">
					<IconClipboard className="h-3.5 w-3.5 text-info" />
					<span className="text-xs font-semibold text-muted uppercase tracking-wide">
						{t("guide.section_copy")}
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{COPY_CLIENTS.map((c) => (
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
