import { IconBrandApple, IconBrandGithub, IconBrandGoogle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MCP_SERVER_URL } from "@/constants/mcp";

export default function DesignSystemPage() {
	return (
		<div className="min-h-screen bg-background text-foreground p-8">
			<div className="max-w-6xl mx-auto">
				{/* Header with Theme Toggle */}
				<div className="flex items-center justify-between mb-8">
					<div className="text-center flex-1">
						<h1 className="text-4xl font-bold mb-2">Apple RAG MCP Design System</h1>
						<p className="text-muted-foreground">Modern dual-mode design system with HSL colors</p>
					</div>
					<div className="flex items-center gap-4">
						<span className="text-sm text-muted-foreground">Theme:</span>
						<ThemeToggle variant="dropdown" />
					</div>
				</div>

				{/* Button Variants */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Button Variants</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">default</h3>
								<Button variant="default">Default Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">primary</h3>
								<Button variant="primary">Primary Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">secondary</h3>
								<Button variant="secondary">Secondary Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">ghost</h3>
								<Button variant="ghost">Ghost Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">link</h3>
								<Button variant="link">Link Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">outline</h3>
								<Button variant="outline">Outline Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">destructive</h3>
								<Button variant="destructive">Destructive Button</Button>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium text-muted-foreground">gradient</h3>
								<Button variant="gradient">Gradient Button</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Button Sizes */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Button Sizes</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							<div className="flex flex-wrap items-center gap-4">
								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">sm</p>
									<Button size="sm" variant="primary">
										Small
									</Button>
								</div>
								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">default</p>
									<Button size="default" variant="primary">
										Default
									</Button>
								</div>
								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">lg</p>
									<Button size="lg" variant="primary">
										Large
									</Button>
								</div>
								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">icon</p>
									<Button size="icon" variant="primary">
										🎨
									</Button>
								</div>
							</div>

							{/* Size comparison with different variants */}
							<div>
								<h3 className="text-lg font-medium mb-3 text-muted-foreground">
									Size Comparison Across Variants
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
									<div className="space-y-2">
										<p className="text-sm text-muted-foreground">Small Buttons</p>
										<div className="flex flex-col gap-2">
											<Button size="sm" variant="primary">
												Primary SM
											</Button>
											<Button size="sm" variant="secondary">
												Secondary SM
											</Button>
											<Button size="sm" variant="outline">
												Outline SM
											</Button>
										</div>
									</div>
									<div className="space-y-2">
										<p className="text-sm text-muted-foreground">Default Buttons</p>
										<div className="flex flex-col gap-2">
											<Button size="default" variant="primary">
												Primary Default
											</Button>
											<Button size="default" variant="gradient">
												Gradient Default
											</Button>
											<Button size="default" variant="outline">
												Outline Default
											</Button>
										</div>
									</div>
									<div className="space-y-2">
										<p className="text-sm text-muted-foreground">Large Buttons</p>
										<div className="flex flex-col gap-2">
											<Button size="lg" variant="destructive">
												Destructive LG
											</Button>
											<Button size="lg" variant="ghost">
												Ghost LG
											</Button>
											<Button size="lg" variant="secondary">
												Secondary LG
											</Button>
										</div>
									</div>
									<div className="space-y-2">
										<p className="text-sm text-muted-foreground">Icon Buttons</p>
										<div className="flex flex-wrap gap-2">
											<Button size="icon" variant="primary">
												P
											</Button>
											<Button size="icon" variant="secondary">
												S
											</Button>
											<Button size="icon" variant="outline">
												O
											</Button>
											<Button size="icon" variant="ghost">
												G
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Badge Variants */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Badge Variants</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-4">
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">default</p>
								<Badge variant="default">Default</Badge>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">secondary</p>
								<Badge variant="secondary">Secondary</Badge>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">destructive</p>
								<Badge variant="destructive">Destructive</Badge>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">success</p>
								<Badge variant="success">Success</Badge>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">warning</p>
								<Badge variant="warning">Warning</Badge>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">outline</p>
								<Badge variant="outline">Outline</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Color Palette */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Color Palette</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{/* Semantic Colors */}
							<div>
								<h3 className="text-lg font-medium mb-4">Semantic Colors</h3>
								<div className="space-y-2">
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-background border border-border rounded"></div>
										<span className="text-sm">bg-background</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-foreground border border-border rounded"></div>
										<span className="text-sm">bg-foreground</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-card border border-border rounded"></div>
										<span className="text-sm">bg-card</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-muted border border-border rounded"></div>
										<span className="text-sm">bg-muted</span>
									</div>
								</div>
							</div>

							{/* Brand Colors */}
							<div>
								<h3 className="text-lg font-medium mb-4">Brand Colors</h3>
								<div className="space-y-2">
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-primary border border-border rounded"></div>
										<span className="text-sm">bg-primary (#60a5fa)</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-secondary border border-border rounded"></div>
										<span className="text-sm">bg-secondary</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-accent border border-border rounded"></div>
										<span className="text-sm">bg-accent</span>
									</div>
								</div>
							</div>

							{/* Status Colors */}
							<div>
								<h3 className="text-lg font-medium mb-4">Status Colors</h3>
								<div className="space-y-2">
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-destructive border border-border rounded"></div>
										<span className="text-sm">bg-destructive</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-green-600 border border-border rounded"></div>
										<span className="text-sm">bg-success</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="w-8 h-8 bg-yellow-600 border border-border rounded"></div>
										<span className="text-sm">bg-warning</span>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Form Components */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Form Components</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="space-y-4">
								<div>
									<Label htmlFor="email">Email</Label>
									<Input id="email" type="email" placeholder="Enter your email" />
								</div>
								<div>
									<Label htmlFor="password">Password</Label>
									<Input id="password" type="password" placeholder="Enter your password" />
								</div>
							</div>
							<div className="space-y-4">
								<div>
									<Label htmlFor="name">Name</Label>
									<Input id="name" placeholder="Enter your name" />
								</div>
								<div>
									<Label htmlFor="message">Message</Label>
									<Input id="message" placeholder="Enter your message" />
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Font Families */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Font Families</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-8">
							{/* Sans — Inter + Noto Sans SC */}
							<div>
								<div className="flex items-baseline gap-3 mb-4">
									<h3 className="text-lg font-medium">Sans</h3>
									<span className="text-xs text-muted-foreground font-mono">
										font-sans → Inter + Noto Sans SC
									</span>
								</div>
								<div className="space-y-3 font-sans">
									<p className="text-2xl font-bold tracking-tight">
										The quick brown fox jumps over the lazy dog
									</p>
									<p className="text-2xl font-bold tracking-tight">
										为开发者打造的 AI 驱动 Apple 文档搜索引擎
									</p>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
										<div>
											<p className="text-base font-normal">Regular 400</p>
											<p className="text-xs text-muted-foreground">AaBbCc 测试</p>
										</div>
										<div>
											<p className="text-base font-medium">Medium 500</p>
											<p className="text-xs text-muted-foreground">AaBbCc 测试</p>
										</div>
										<div>
											<p className="text-base font-semibold">Semibold 600</p>
											<p className="text-xs text-muted-foreground">AaBbCc 测试</p>
										</div>
										<div>
											<p className="text-base font-bold">Bold 700</p>
											<p className="text-xs text-muted-foreground">AaBbCc 测试</p>
										</div>
									</div>
								</div>
							</div>

							{/* Mono — JetBrains Mono */}
							<div>
								<div className="flex items-baseline gap-3 mb-4">
									<h3 className="text-lg font-medium">Mono</h3>
									<span className="text-xs text-muted-foreground font-mono">
										font-mono → JetBrains Mono
									</span>
								</div>
								<div className="space-y-3 font-mono">
									<div className="p-4 rounded-lg bg-[#1e1e1e] text-[#d4d4d4] text-sm leading-relaxed">
										<span className="text-[#569cd6]">const</span>{" "}
										<span className="text-[#9cdcfe]">config</span>{" "}
										<span className="text-[#d4d4d4]">=</span>{" "}
										<span className="text-[#d4d4d4]">{"{"}</span>
										<br />
										{"  "}
										<span className="text-[#9cdcfe]">url</span>
										<span className="text-[#d4d4d4]">:</span>{" "}
										<span className="text-[#ce9178]">"{MCP_SERVER_URL}"</span>
										<br />
										<span className="text-[#d4d4d4]">{"}"}</span>
										<span className="text-[#d4d4d4]">;</span>
									</div>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div>
											<p className="text-sm font-normal">Regular 400</p>
											<p className="text-xs text-muted-foreground">0123456789</p>
										</div>
										<div>
											<p className="text-sm font-medium">Medium 500</p>
											<p className="text-xs text-muted-foreground">0123456789</p>
										</div>
										<div>
											<p className="text-sm font-semibold">Semibold 600</p>
											<p className="text-xs text-muted-foreground">0123456789</p>
										</div>
										<div>
											<p className="text-sm font-bold">Bold 700</p>
											<p className="text-xs text-muted-foreground">0123456789</p>
										</div>
									</div>
								</div>
							</div>

							{/* Bilingual Pairing */}
							<div>
								<div className="flex items-baseline gap-3 mb-4">
									<h3 className="text-lg font-medium">Bilingual Pairing</h3>
									<span className="text-xs text-muted-foreground font-mono">
										Inter + Noto Sans SC seamless mixing
									</span>
								</div>
								<div className="p-4 rounded-lg border border-border bg-card space-y-2">
									<p className="text-base leading-relaxed">
										Apple RAG MCP 让你的 AI Agent 成为 Apple 开发专家。通过 RAG 技术访问官方 Swift
										文档、WWDC 洞察，支持 Cursor、VS Code、Claude Code 等所有 MCP 兼容客户端。
									</p>
									<p className="text-sm text-muted-foreground leading-relaxed">
										Transform your AI agents into Apple development experts. Access official Swift
										docs, WWDC insights, and platform mastery through the Model Context Protocol.
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Typography Scale */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Typography Scale</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<h1 className="text-4xl font-bold tracking-tight">Heading 1 - 4xl Bold</h1>
								<p className="text-sm text-muted-foreground">text-4xl font-bold tracking-tight</p>
							</div>
							<div>
								<h2 className="text-3xl font-semibold tracking-tight">Heading 2 - 3xl Semibold</h2>
								<p className="text-sm text-muted-foreground">
									text-3xl font-semibold tracking-tight
								</p>
							</div>
							<div>
								<h3 className="text-2xl font-medium">Heading 3 - 2xl Medium</h3>
								<p className="text-sm text-muted-foreground">text-2xl font-medium</p>
							</div>
							<div>
								<p className="text-base">Body Text - Base Regular</p>
								<p className="text-sm text-muted-foreground">text-base</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Small Text - SM Muted</p>
								<p className="text-xs text-muted-foreground">text-sm text-muted-foreground</p>
							</div>
							<div>
								<p className="font-mono text-sm">Monospace Text — font-mono text-sm</p>
								<p className="text-xs text-muted-foreground">font-mono text-sm</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Interactive States */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Interactive States</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							<div>
								<h3 className="text-lg font-medium mb-3">Button States</h3>
								<div className="space-y-4">
									<div className="flex flex-wrap gap-4">
										<Button variant="primary">Normal</Button>
										<Button variant="primary" className="hover:scale-105">
											Hover Effect
										</Button>
										<Button variant="primary" disabled>
											Disabled
										</Button>
									</div>
									<div className="flex flex-wrap gap-4">
										<Button variant="secondary">Secondary</Button>
										<Button variant="secondary" disabled>
											Secondary Disabled
										</Button>
										<Button variant="gradient">Gradient</Button>
										<Button variant="outline">Outline</Button>
									</div>
								</div>
							</div>
							<div>
								<h3 className="text-lg font-medium mb-3">Theme Toggle</h3>
								<div className="flex items-center gap-4">
									<ThemeToggle variant="icon" />
									<span className="text-sm text-muted-foreground">Icon variant</span>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Theme Demonstration */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Theme Demonstration</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="space-y-4">
								<h3 className="text-lg font-medium">Current Theme Colors</h3>
								<div className="space-y-2">
									<div className="p-3 bg-background border border-border rounded">
										<span className="text-sm">Background</span>
									</div>
									<div className="p-3 bg-card border border-border rounded">
										<span className="text-sm">Card Background</span>
									</div>
									<div className="p-3 bg-muted border border-border rounded">
										<span className="text-sm">Muted Background</span>
									</div>
								</div>
							</div>
							<div className="space-y-4">
								<h3 className="text-lg font-medium">Text Colors</h3>
								<div className="space-y-2">
									<p className="text-foreground">Primary text (foreground)</p>
									<p className="text-muted-foreground">Secondary text (muted-foreground)</p>
									<p className="text-primary">Brand text (primary)</p>
									<p className="text-destructive">Error text (destructive)</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Button with Icons Examples */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Buttons with Icons</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{/* Social Login Style Buttons */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium text-muted-foreground">Social Login Style</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<Button
										variant="outline"
										onClick={() => console.log("Google login")}
										className="w-full h-11 border-2 hover:border-brand/30 hover:bg-muted/50"
									>
										<IconBrandGoogle className="h-5 w-5 mr-3" />
										Continue with Google
									</Button>
									<Button
										variant="ghost"
										onClick={() => console.log("GitHub login")}
										className="w-full h-11 border-2 border-border hover:border-muted hover:bg-muted/50"
									>
										<IconBrandGithub className="h-5 w-5 mr-3" />
										Continue with GitHub
									</Button>
								</div>
							</div>

							{/* Icon Button Variants */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium text-muted-foreground">
									Icon + Text Combinations
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<Button variant="primary">
										<IconBrandGoogle className="h-4 w-4 mr-2" />
										Primary with Icon
									</Button>
									<Button variant="secondary">
										<IconBrandGithub className="h-4 w-4 mr-2" />
										Secondary with Icon
									</Button>
									<Button variant="ghost">
										<IconBrandApple className="h-4 w-4 mr-2" />
										Ghost with Icon
									</Button>
								</div>
							</div>

							{/* Icon Only Buttons */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium text-muted-foreground">Icon Only Buttons</h3>
								<div className="flex gap-4">
									<Button size="icon" variant="primary">
										<IconBrandGoogle className="h-4 w-4" />
									</Button>
									<Button size="icon" variant="secondary">
										<IconBrandGithub className="h-4 w-4" />
									</Button>
									<Button size="icon" variant="ghost">
										<IconBrandApple className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
