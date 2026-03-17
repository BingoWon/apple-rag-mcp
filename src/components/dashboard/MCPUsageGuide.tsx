import {
	IconChevronDown,
	IconClipboard,
	IconKey,
	IconSettings,
	IconShieldCheck,
	IconSquareRoundedPlus,
	IconTerminal,
	IconWorld,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/code-block";
import { LoaderFive } from "@/components/ui/loader";
import { MCPInstallButtons } from "@/components/ui/MCPInstallButtons";
import { useDashboardStore } from "@/stores/dashboard";
import { MCPConfigService } from "@/utils/mcpConfigService";

export function MCPUsageGuide() {
	const { t } = useTranslation();
	const { mcpTokens, fetchMCPTokens, createMCPToken, isLoadingTokens } = useDashboardStore();
	const [selectedTokenId, setSelectedTokenId] = useState<string>("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [showCodexGuide, setShowCodexGuide] = useState(false);
	const [showClaudeGuide, setShowClaudeGuide] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// 样式常量
	const sectionTitleClass = "flex items-center gap-2 text-sm font-semibold text-light mb-3";
	const copyButtonClass = "text-muted hover:text-light h-6 w-6 p-0";
	const configRowClass = "flex items-center justify-between py-2.5 mb-0 border-b border-default/50";

	// 获取 tokens 数据
	useEffect(() => {
		fetchMCPTokens();
	}, [fetchMCPTokens]);

	// 当 tokens 加载完成后，自动选择最新的 token
	useEffect(() => {
		if (mcpTokens.length > 0 && !selectedTokenId) {
			// 按创建时间排序，选择最新的
			const sortedTokens = [...mcpTokens].sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			);
			setSelectedTokenId(sortedTokens[0].id);
		}
	}, [mcpTokens, selectedTokenId]);

	// 点击外部关闭下拉框
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};

		if (isDropdownOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isDropdownOpen]);

	const handleCreateToken = async () => {
		try {
			const tokenName = `MCP Token ${new Date().toLocaleDateString()}`;
			const newToken = await createMCPToken({
				name: tokenName,
				permissions: ["rag.read"],
			});

			if (newToken) {
				setSelectedTokenId(newToken.id);
				toast.success(t("tokens.created_success", { name: tokenName }));
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("tokens.create_error"));
		}
	};

	const selectedToken = mcpTokens.find((token) => token.id === selectedTokenId);
	const mcpServerUrl = "https://mcp.apple-rag.com";

	// 通用复制函数
	const copyToClipboard = async (text: string, successMessage: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(successMessage);
		} catch (_error) {
			toast.error(t("guide.copy_clipboard_failed"));
		}
	};

	// 配置参数数据
	const configParams = [
		{
			label: t("guide.field_name"),
			value: "apple-rag-mcp",
			copyMessage: t("guide.name_copied"),
		},
		{ label: t("guide.field_type"), value: "SSE / Streamable HTTP", copyable: false },
		{
			label: t("guide.field_url"),
			value: mcpServerUrl,
			copyMessage: t("guide.url_copied"),
		},
		{
			label: t("guide.field_auth_type"),
			value: "API key / Token",
			copyable: false,
		},
		{
			label: t("guide.field_api_key"),
			value: selectedToken?.mcp_token || "",
			copyMessage: t("guide.key_copied"),
		},
		{
			label: t("guide.field_authorization"),
			value: selectedToken ? `Bearer ${selectedToken.mcp_token}` : "",
			copyMessage: t("guide.auth_copied"),
		},
	];

	// 渲染配置参数行
	const renderConfigRow = (param: (typeof configParams)[0], isLast = false) => (
		<div
			key={param.label}
			className={isLast ? "flex items-center justify-between py-2.5" : configRowClass}
		>
			<span className="font-medium text-light">{param.label}</span>
			<div className="flex items-center gap-2">
				<code className="text-xs font-mono bg-secondary px-2 py-1 rounded border max-w-[200px] truncate">
					{param.value}
				</code>
				{param.copyable !== false && (
					<Button
						size="sm"
						variant="ghost"
						onClick={() =>
							copyToClipboard(param.value || "", param.copyMessage || "Copied to clipboard!")
						}
						title={t("guide.copy_param", { param: param.label.replace(":", "") })}
						className={copyButtonClass}
					>
						<IconClipboard className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("guide.title")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* MCP Configuration - 放在最前面 */}
				<div>
					<h3 className={sectionTitleClass}>
						<IconSettings className="h-4 w-4 text-info" />
						{isLoadingTokens
							? t("guide.loading_config")
							: mcpTokens.length === 0
								? t("guide.create_first_title")
								: t("guide.client_config")}
					</h3>

					{isLoadingTokens ? (
						// 加载状态显示 LoaderFive
						<div className="text-center py-8 bg-tertiary rounded-lg border border-default">
							<div className="flex justify-center mb-4">
								<LoaderFive text={t("guide.loading_tokens")} />
							</div>
							<p className="text-sm text-muted">{t("guide.loading_tokens_desc")}</p>
						</div>
					) : mcpTokens.length === 0 ? (
						// 没有 token 时显示创建按钮
						<div className="text-center py-8 bg-tertiary rounded-lg border border-default">
							<IconKey className="h-12 w-12 text-muted mx-auto mb-4" />
							<h4 className="text-sm font-medium text-light mb-2">
								{t("guide.create_first_subtitle")}
							</h4>
							<p className="text-sm text-muted mb-6 max-w-sm mx-auto">
								{t("guide.create_first_desc")}
							</p>
							<Button
								onClick={handleCreateToken}
								variant="primary"
								disabled={isLoadingTokens}
								className="px-6"
							>
								<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
								{t("tokens.create")}
							</Button>
						</div>
					) : (
						// 有 token 时显示配置
						<div className="space-y-3">
							{/* Token 选择下拉框 */}
							<div className="relative" ref={dropdownRef}>
								<label
									htmlFor="token-selector"
									className="block text-xs font-medium text-muted mb-2"
								>
									{t("guide.select_token")}
								</label>
								<button
									id="token-selector"
									type="button"
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className="w-full flex items-center justify-between px-3 py-2 text-sm bg-tertiary border border-default rounded-md hover:bg-secondary hover:border-light transition-colors"
								>
									<span className="text-light">
										{selectedToken ? selectedToken.name : t("guide.select_placeholder")}
									</span>
									<IconChevronDown
										className={`h-4 w-4 text-muted transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
									/>
								</button>

								{isDropdownOpen && (
									<div className="absolute top-full left-0 right-0 mt-1 bg-tertiary border border-default rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
										{mcpTokens.map((token) => (
											<button
												key={token.id}
												type="button"
												onClick={() => {
													setSelectedTokenId(token.id);
													setIsDropdownOpen(false);
													toast.success(t("guide.config_updated"));
												}}
												className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${
													selectedTokenId === token.id ? "bg-secondary text-light" : "text-muted"
												}`}
											>
												{token.name}
											</button>
										))}
									</div>
								)}
							</div>

							{/* 快速安装按钮 */}
							{selectedToken && (
								<MCPInstallButtons
									token={selectedToken.mcp_token}
									serverUrl={mcpServerUrl}
									disabled={!selectedToken}
								/>
							)}

							{/* 配置代码块 */}
							<CodeBlock
								language="json"
								filename="mcp-config.json"
								code={MCPConfigService.generateJsonString({
									token: selectedToken?.mcp_token || "your-mcp-token-here",
									serverUrl: mcpServerUrl,
								})}
							/>

							{/* Codex CLI Configuration - 紧跟 JSON 配置 */}
							{selectedToken && (
								<div className="border border-info/30 rounded-lg overflow-hidden">
									<button
										type="button"
										onClick={() => setShowCodexGuide(!showCodexGuide)}
										className="w-full flex items-center justify-between p-4 bg-info/5 hover:bg-info/10 transition-colors"
									>
										<div className="flex items-center gap-3">
											<div className="flex items-center gap-1.5">
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src="https://api.iconify.design/logos:openai-icon.svg"
													alt="OpenAI"
													className="h-5 w-5"
												/>
												<span className="text-sm font-semibold text-light">OpenAI</span>
											</div>
											<div className="flex items-center gap-1.5">
												<IconTerminal className="h-5 w-5 text-light" />
												<span className="text-sm font-semibold text-light">Codex CLI</span>
											</div>
											<span className="text-sm text-muted">{t("guide.codex_config")}</span>
										</div>
										<IconChevronDown
											className={`h-4 w-4 text-muted transition-transform ${showCodexGuide ? "rotate-180" : ""}`}
										/>
									</button>

									{showCodexGuide && (
										<div className="p-4 space-y-4">
											<div>
												<p className="text-sm text-muted mb-3">
													{t("guide.codex_desc")}{" "}
													<code className="text-xs font-mono bg-secondary px-1 py-0.5 rounded">
														~/.codex/config.toml
													</code>{" "}
													{t("guide.codex_desc_suffix")}{" "}
													<a
														href="https://github.com/openai/codex/blob/main/docs/config.md#mcp_servers"
														target="_blank"
														rel="noopener noreferrer"
														className="text-brand hover:text-brand-secondary underline"
													>
														{t("guide.official_docs")}
													</a>
													.
												</p>
												<CodeBlock
													language="toml"
													filename="config.toml"
													code={MCPConfigService.generateTomlString(selectedToken.mcp_token)}
												/>
											</div>
										</div>
									)}
								</div>
							)}

							{/* Claude Code Configuration */}
							{selectedToken && (
								<div className="border border-info/30 rounded-lg overflow-hidden mt-3">
									<button
										type="button"
										onClick={() => setShowClaudeGuide(!showClaudeGuide)}
										className="w-full flex items-center justify-between p-4 bg-info/5 hover:bg-info/10 transition-colors"
									>
										<div className="flex items-center gap-3">
											<div className="flex items-center gap-1.5">
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img
													src="https://api.iconify.design/logos:claude-icon.svg"
													alt="Claude Code"
													className="h-5 w-5"
												/>
												<span className="text-sm font-semibold text-light">Claude Code</span>
											</div>
											<span className="text-sm text-muted">{t("guide.claude_command")}</span>
										</div>
										<IconChevronDown
											className={`h-4 w-4 text-muted transition-transform ${showClaudeGuide ? "rotate-180" : ""}`}
										/>
									</button>

									{showClaudeGuide && (
										<div className="p-4 space-y-4">
											<div>
												<p className="text-sm text-muted mb-3">{t("guide.claude_desc")}</p>
												<CodeBlock
													language="bash"
													filename="terminal"
													code={MCPConfigService.generateClaudeCodeCommand(
														selectedToken.mcp_token,
														mcpServerUrl,
													)}
												/>
											</div>
										</div>
									)}
								</div>
							)}

							{/* 参数配置指南 */}
							{selectedToken && (
								<div className="mt-6">
									<h4 className="text-sm font-medium text-light mb-4 flex items-center gap-2">
										<IconSettings className="h-4 w-4 text-warning" />
										{t("guide.manual_title")}
									</h4>
									<div className="space-y-3 text-sm">
										<p className="text-muted mb-3">{t("guide.manual_desc")}</p>
										{configParams.map((param, index) =>
											renderConfigRow(param, index === configParams.length - 1),
										)}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* 服务介绍或 Token Management - 只在非加载状态显示 */}
				{!isLoadingTokens &&
					(mcpTokens.length === 0 ? (
						// 无 Token 状态：显示服务介绍
						<>
							<h3 className={sectionTitleClass}>
								<IconShieldCheck className="h-4 w-4 text-success" />
								{t("guide.about_title")}
							</h3>
							<div className="space-y-3 text-sm text-muted">
								<p>{t("guide.about_desc")}</p>
								<div className="bg-tertiary rounded-lg p-4 border border-default">
									<h4 className="font-medium text-light mb-2">{t("guide.about_features")}</h4>
									<ul className="space-y-1 text-xs">
										<li>• {t("guide.about_feature_1")}</li>
										<li>• {t("guide.about_feature_2")}</li>
										<li>• {t("guide.about_feature_3")}</li>
										<li>• {t("guide.about_feature_4")}</li>
									</ul>
								</div>
							</div>
						</>
					) : (
						// 有 Token 状态：显示 Token Management
						<>
							<h3 className={sectionTitleClass}>
								<IconKey className="h-4 w-4 text-pink-600" />
								{t("guide.token_management")}
							</h3>
							<div className="space-y-2 text-sm text-muted">
								<p>
									• {t("guide.token_higher_limits")}{" "}
									<Link
										to="/mcp-tokens"
										className="text-brand hover:text-brand-secondary underline"
									>
										{t("guide.token_link")}
									</Link>
								</p>
								<p>
									• {t("guide.usage_monitor")}{" "}
									<Link to="/usage" className="text-brand hover:text-brand-secondary underline">
										{t("guide.usage_dashboard")}
									</Link>
								</p>
							</div>
						</>
					))}

				{/* IP Authentication Section - 只在非加载状态显示 */}
				{!isLoadingTokens && (
					<>
						<h3 className={sectionTitleClass}>
							<IconWorld className="h-4 w-4 text-success" />
							{t("guide.ip_auth_title")}
						</h3>
						<div className="space-y-2 text-sm text-muted">
							<p>
								•{" "}
								<Link
									to="/authorized-ips"
									className="text-brand hover:text-brand-secondary underline"
								>
									{t("guide.ip_auth_link")}
								</Link>{" "}
								{t("guide.ip_auto_auth")}
							</p>
							<p>• {t("guide.ip_auth_desc")}</p>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
