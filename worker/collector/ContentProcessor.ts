import type { AppleAPIResponse, BatchResult, DocumentContent } from "./types/index.js";
import { BatchErrorHandler } from "./utils/batch-error-handler.js";
import { UrlProcessor } from "./utils/url-processor.js";

class ContentProcessor {
	private urlProcessor = new UrlProcessor();

	async processDocuments(
		apiResults: BatchResult<AppleAPIResponse>[],
	): Promise<BatchResult<DocumentContent>[]> {
		// Direct concurrent processing - no sub-batching needed
		return await Promise.all(apiResults.map((item) => this.processSingleDocument(item)));
	}

	private async processSingleDocument(
		item: BatchResult<AppleAPIResponse>,
	): Promise<BatchResult<DocumentContent>> {
		if (!item.data) {
			return BatchErrorHandler.failure(item.url, item.error || "No API data available");
		}

		return BatchErrorHandler.safeExecute(item.url, () => {
			const { titles, content } = this.cleanAndSeparateContent(item.data!);
			const extractedUrls = this.urlProcessor.extractAllUrls(item.data!);

			return {
				title: titles.trim() || null,
				content: this.normalizeLineTerminators(content),
				extractedUrls,
			};
		});
	}

	private cleanAndSeparateContent(docData: AppleAPIResponse): {
		titles: string;
		content: string;
	} {
		const titles = this.extractTitleContent(docData);
		const content = this.extractMainContent(docData);
		return { titles, content };
	}

	private extractTitleContent(docData: AppleAPIResponse): string {
		const parts = [];

		// Combine roleHeading and title for better readability
		if (docData.metadata.roleHeading && docData.metadata.title) {
			parts.push(`${docData.metadata.roleHeading}: ${docData.metadata.title}`);
		} else if (docData.metadata.title) {
			parts.push(docData.metadata.title);
		} else if (docData.metadata.roleHeading) {
			parts.push(docData.metadata.roleHeading);
		}

		// Add abstract as description
		if (docData.abstract?.length && docData.abstract.length > 0) {
			const abstractText = docData.abstract.map((item) => item.text).join("");
			if (abstractText.trim()) {
				parts.push(`\n${abstractText}`);
			}
		}

		// Add platform information with clear formatting
		if (docData.metadata.platforms?.length && docData.metadata.platforms.length > 0) {
			const platformInfo = docData.metadata.platforms
				.map((platform) => this.formatPlatformInfo(platform))
				.filter((info) => info.trim())
				.join(", ");
			if (platformInfo) {
				parts.push(`\nPlatforms: ${platformInfo}`);
			}

			// Collect unique deprecation messages
			const deprecationMessages = new Set<string>();
			docData.metadata.platforms.forEach((platform: any) => {
				if ((platform.deprecated || platform.deprecatedAt) && platform.message) {
					deprecationMessages.add(platform.message);
				}
			});

			// Add deprecation note if there are any messages
			if (deprecationMessages.size > 0) {
				const messages = Array.from(deprecationMessages).join("; ");
				parts.push(`\nDeprecation Note: ${messages}`);
			}
		}

		return `${parts.join("")}\n`;
	}

	private formatPlatformInfo(platform: any): string {
		// Handle special case: deprecated item without name (global deprecation)
		if (!platform.name && platform.deprecated) {
			const message = platform.message ? ` (${platform.message})` : "";
			return `Deprecated${message}`;
		}

		// Skip items without name that aren't deprecated
		if (!platform.name) {
			return "";
		}

		// Handle version information
		let version = "";
		if (platform.deprecatedAt && platform.introducedAt) {
			version = `${platform.introducedAt}–${platform.deprecatedAt} deprecated`;
		} else if (platform.introducedAt) {
			version = `${platform.introducedAt}+`;
		} else if (platform.deprecated) {
			version = "deprecated";
		}

		const beta = platform.beta ? " [Beta]" : "";

		return `${platform.name}${version ? ` ${version}` : ""}${beta}`;
	}

	private extractMainContent(docData: AppleAPIResponse): string {
		if (!docData.primaryContentSections?.length) return "";

		const sections = docData.primaryContentSections
			.map((section) => this.convertContentSectionToMarkdown(section, docData.references || {}, 0))
			.filter((result) => result.content)
			.map((result) => result.content.trim());

		return this.normalizeLineTerminators(sections.join("\n\n"));
	}

	private convertContentSectionToMarkdown(
		section: any,
		references: Record<string, any>,
		indentLevel: number,
	): { title: string; content: string } {
		const sectionType = section.type || section.kind;

		if (!sectionType) {
			return { title: "", content: "" };
		}

		const handlers: Record<string, () => { title: string; content: string }> = {
			heading: () => this.renderHeading(section),
			paragraph: () => this.renderParagraph(section, references),
			row: () => this.renderTableRow(section, references, indentLevel),
			unorderedList: () => this.renderList(section, references, indentLevel, "unordered"),
			orderedList: () => this.renderList(section, references, indentLevel, "ordered"),
			codeListing: () => this.renderCodeListing(section),
			declarations: () => this.renderDeclarations(section),
			properties: () => this.renderProperties(section, references),
			parameters: () => this.renderParameters(section, references),
			aside: () => this.renderAside(section, references, indentLevel),
			termList: () => this.renderTermList(section, references, indentLevel),
			restEndpoint: () => this.renderRestEndpoint(section),
			restParameters: () => this.renderRestParameters(section, references),
			restResponses: () => this.renderRestResponses(section, references),
			details: () => this.renderDetails(section),
			possibleValues: () => this.renderPossibleValues(section),
			attributes: () => this.renderAttributes(section),
		};

		return handlers[sectionType]?.() || this.renderGenericContent(section, references, indentLevel);
	}

	private renderHeading(section: any): { title: string; content: string } {
		const level = section.level || 2;
		const headingPrefix = "#".repeat(level);
		const title = section.text || "";
		const content = `${headingPrefix} ${section.text}`;
		return { title, content };
	}

	private renderParagraph(
		section: any,
		references: Record<string, any>,
	): { title: string; content: string } {
		let content = "";
		if (section.inlineContent) {
			content = section.inlineContent
				.map((inline: any) => this.renderInlineContent(inline, references))
				.join("");
		}
		return { title: "", content };
	}

	private renderCodeListing(section: any): { title: string; content: string } {
		if (!section.code?.length) {
			return { title: "", content: "" };
		}

		const language = section.syntax || "";
		const content = `\`\`\`${language}\n${section.code.join("\n")}\n\`\`\``;
		return { title: "", content };
	}

	private renderList(
		section: any,
		references: Record<string, any>,
		indentLevel: number,
		listType: "ordered" | "unordered",
	): { title: string; content: string } {
		let content = "";
		if (!section.items) {
			return { title: "", content };
		}

		if (indentLevel > 10) {
			return { title: "", content };
		}

		section.items.forEach((item: any, index: number) => {
			if (item.content) {
				const indent = "  ".repeat(indentLevel);
				const marker = listType === "ordered" ? `${index + 1}. ` : "- ";
				content += `${indent}${marker}`;

				let isFirstContent = true;
				item.content.forEach((contentItem: any, contentIndex: number) => {
					const result = this.convertContentSectionToMarkdown(
						contentItem,
						references,
						indentLevel + 1,
					);
					if (result.content) {
						if (this.isNestedList(contentItem)) {
							if (!isFirstContent) {
								content += "\n";
							}
							content += result.content;
						} else {
							const cleanContent = this.cleanContent(result.content);
							content += cleanContent;

							if (contentIndex < item.content.length - 1) {
								content += "\n";
							}
						}
						isFirstContent = false;
					}
				});

				content += "\n";
			}
		});

		if (indentLevel === 0) {
			content += "\n";
		}

		return { title: "", content };
	}

	private isNestedList(contentItem: any): boolean {
		return (
			contentItem.type === "unorderedList" ||
			contentItem.kind === "unorderedList" ||
			contentItem.type === "orderedList" ||
			contentItem.kind === "orderedList"
		);
	}

	private cleanContent(content: string): string {
		const safeContent = this.toSafeString(content);
		return this.normalizeLineTerminators(safeContent)
			.replace(/^#+\s*/, "")
			.replace(/\n+$/, "");
	}

	private renderInlineContent(inline: any, references: Record<string, any>): string {
		const handlers: Record<string, () => string> = {
			text: () => this.normalizeLineTerminators(this.toSafeString(inline.text)),
			reference: () => this.renderReference(inline, references),
			codeVoice: () => {
				if (!inline.code) return "";
				return `\`${this.normalizeLineTerminators(this.toSafeString(inline.code))}\``;
			},
			image: () => this.renderMedia(inline, "Image"),
			video: () => this.renderMedia(inline, "Video"),
		};

		return handlers[inline.type]?.() || "";
	}

	private renderReference(inline: any, references: Record<string, any>): string {
		const refText =
			inline.identifier && references[inline.identifier]
				? references[inline.identifier].title || inline.text || inline.identifier
				: inline.text || inline.identifier || "";

		return refText ? `\`${refText}\`` : "";
	}

	private renderMedia(inline: any, mediaType: string): string {
		const abstractText = inline.metadata?.abstract?.map((item: any) => item.text || "").join("");

		return abstractText ? `[${mediaType}: ${abstractText}]` : "";
	}

	private renderTableRow(
		section: any,
		references: Record<string, any>,
		indentLevel: number,
	): { title: string; content: string } {
		let title = "";
		let content = "";
		if (section.columns) {
			section.columns.forEach((column: any) => {
				if (column.content) {
					column.content.forEach((contentItem: any) => {
						const result = this.convertContentSectionToMarkdown(
							contentItem,
							references,
							indentLevel,
						);
						if (result.title) title += `${result.title}\n`;
						if (result.content) content += result.content;
					});
				}
			});
		}
		return { title, content };
	}

	private renderDeclarations(section: any): { title: string; content: string } {
		if (!section.declarations?.length) {
			return { title: "", content: "" };
		}

		const allDeclarations: Array<{ platforms: string; code: string }> = [];

		for (const declaration of section.declarations) {
			const languages = declaration.languages || [];
			const platforms = declaration.platforms || [];

			// Format platform information
			const platformLabel = platforms.length > 0 ? platforms.join(", ") : "";

			// Process main declaration
			if (declaration.tokens?.length) {
				const formatted = this.formatFunctionDeclaration(declaration.tokens, languages);
				if (formatted.trim()) {
					allDeclarations.push({
						platforms: platformLabel,
						code: formatted,
					});
				}
			}

			// Process method overloads from otherDeclarations
			if (declaration.otherDeclarations?.declarations?.length) {
				for (const overload of declaration.otherDeclarations.declarations) {
					if (overload.tokens?.length) {
						const formatted = this.formatFunctionDeclaration(overload.tokens, languages);
						if (formatted.trim()) {
							allDeclarations.push({
								platforms: platformLabel,
								code: formatted,
							});
						}
					}
				}
			}
		}

		// Generate output with platform labels and code blocks
		const content = allDeclarations
			.map((decl) => {
				if (decl.platforms) {
					return `${decl.platforms}\n\n\`\`\`\n${decl.code}\n\`\`\``;
				}
				return `\`\`\`\n${decl.code}\n\`\`\``;
			})
			.join("\n\n");

		return { title: "", content };
	}

	private formatFunctionDeclaration(tokens: any[], languages: string[]): string {
		// Get the raw declaration text
		const rawText = tokens.map((token: any) => token.text || "").join("");

		// Check if this is a Swift function based on languages array
		const isSwiftFunction = languages.includes("swift");

		if (isSwiftFunction) {
			// Use multi-line format for Swift functions
			return this.formatSwiftFunction(rawText);
		} else {
			// Use single-line format for C/C++/Objective-C functions
			return rawText;
		}
	}

	private formatSwiftFunction(rawText: string): string {
		const parts = rawText.split("(");
		if (parts.length < 2) return rawText;

		const funcPart = parts[0]; // "func isValid"
		const remaining = parts.slice(1).join("("); // everything after first (

		const closingParenIndex = remaining.lastIndexOf(")");
		if (closingParenIndex === -1) return rawText;

		const paramsPart = remaining.substring(0, closingParenIndex);
		const returnPart = remaining.substring(closingParenIndex); // ") -> Bool"

		// Split parameters by comma, but be careful with nested types
		const params = this.splitParameters(paramsPart);

		let result = `${funcPart}(\n`;
		params.forEach((param, index) => {
			const trimmedParam = param.trim();
			if (trimmedParam) {
				result += `  ${trimmedParam}`;
				if (index < params.length - 1) {
					result += ",";
				}
				result += "\n";
			}
		});
		result += returnPart;

		return result;
	}

	private splitParameters(paramString: string): string[] {
		const params: string[] = [];
		let current = "";
		let depth = 0;

		for (let i = 0; i < paramString.length; i++) {
			const char = paramString[i];

			if (char === "(" || char === "[" || char === "<") {
				depth++;
			} else if (char === ")" || char === "]" || char === ">") {
				depth--;
			} else if (char === "," && depth === 0) {
				if (current.trim()) {
					params.push(current.trim());
				}
				current = "";
				continue;
			}

			current += char;
		}

		if (current.trim()) {
			params.push(current.trim());
		}

		return params;
	}

	private renderProperties(
		section: any,
		references: Record<string, any>,
	): { title: string; content: string } {
		let content = "";
		if (section.title) {
			content += `### ${section.title}\n\n`;
		}

		if (section.items && section.items.length > 0) {
			section.items.forEach((item: any) => {
				if (item.name) {
					const propertyHeader = this.buildPropertyHeader(item);
					content += `${propertyHeader}\n\n`;

					if (item.content && item.content.length > 0) {
						item.content.forEach((contentItem: any) => {
							const result = this.convertContentSectionToMarkdown(contentItem, references, 0);
							if (result.content) {
								content += result.content;
							}
						});
					}

					content += "\n";
				}
			});
		}
		return { title: "", content };
	}

	private buildPropertyHeader(item: any): string {
		let propertyHeader = `#### ${item.name}`;

		if (item.type && item.type.length > 0) {
			const typeText = item.type.map((t: any) => t.text || "").join("");
			if (typeText) {
				propertyHeader += ` (${typeText})`;
			}
		}

		const statusParts = [];
		if (item.required) {
			statusParts.push("Required");
		}
		if (item.deprecated) {
			statusParts.push("Deprecated");
		}

		if (statusParts.length > 0) {
			propertyHeader += ` [${statusParts.join(", ")}]`;
		}

		return propertyHeader;
	}

	private renderAside(
		section: any,
		references: Record<string, any>,
		indentLevel: number,
	): { title: string; content: string } {
		let content = "";

		// Add the aside type as an inline emphasis (Important, Note, Warning, etc.)
		let asideLabel = "";
		if (section.name) {
			asideLabel = section.name;
		} else if (section.style) {
			// Capitalize the first letter of the style
			asideLabel = section.style.charAt(0).toUpperCase() + section.style.slice(1);
		}

		// Process the aside content
		if (section.content) {
			section.content.forEach((contentItem: any, index: number) => {
				const result = this.convertContentSectionToMarkdown(contentItem, references, indentLevel);
				if (result.content) {
					// Add the label before the first content item
					if (index === 0 && asideLabel) {
						content += `**${asideLabel}**: ${result.content}\n`;
					} else {
						content += `${result.content}\n`;
					}
				}
			});
		}

		return { title: "", content };
	}

	private renderTermList(
		section: any,
		references: Record<string, any>,
		_indentLevel: number,
	): { title: string; content: string } {
		let content = "";

		if (section.items?.length) {
			section.items.forEach((item: any) => {
				// Render the term (parameter name) as bold text
				if (item.term?.inlineContent) {
					const termContent = item.term.inlineContent
						.map((inline: any) => this.renderInlineContent(inline, references))
						.join("");
					content += `**${termContent}**\n`;
				}

				// Render the definition (parameter description)
				if (item.definition?.content) {
					item.definition.content.forEach((defItem: any) => {
						const result = this.convertContentSectionToMarkdown(defItem, references, 0);
						if (result.content) {
							content += `${result.content}\n`;
						}
					});
				}
			});
		}

		return { title: "", content };
	}

	private renderGenericContent(
		section: any,
		references: Record<string, any>,
		indentLevel: number,
	): { title: string; content: string } {
		let title = "";
		let content = "";

		if (section.content) {
			section.content.forEach((contentItem: any) => {
				const result = this.convertContentSectionToMarkdown(contentItem, references, indentLevel);
				if (result.title) title += `${result.title}\n`;
				if (result.content) content += `${result.content}\n`;
			});
		}

		return { title, content };
	}

	private renderParameters(
		section: any,
		references: Record<string, any>,
	): { title: string; content: string } {
		if (!section.parameters?.length) {
			return { title: "", content: "" };
		}

		let content = "## Parameters\n";

		section.parameters.forEach((param: any) => {
			if (param.name) {
				content += `### ${param.name}\n`;

				if (param.content?.length) {
					param.content.forEach((contentItem: any) => {
						const result = this.convertContentSectionToMarkdown(contentItem, references, 0);
						if (result.content) {
							content += `${result.content}\n`;
						}
					});
				}
			}
		});

		return { title: "", content };
	}

	private renderRestEndpoint(section: any): { title: string; content: string } {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n`;
		}

		if (section.tokens?.length) {
			let endpointLine = "";
			section.tokens.forEach((token: any) => {
				if (token.kind === "method") {
					endpointLine += `**${token.text}**`;
				} else if (token.kind === "baseURL" || token.kind === "path") {
					endpointLine += token.text;
				} else if (token.kind === "parameter") {
					endpointLine += `{${token.text}}`;
				} else {
					endpointLine += token.text;
				}
			});
			content += `\`${endpointLine}\`\n`;
		}

		return { title: section.title || "", content };
	}

	private renderRestParameters(
		section: any,
		references: Record<string, any>,
	): { title: string; content: string } {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n`;
		}

		if (section.items?.length) {
			section.items.forEach((item: any, index: number) => {
				if (item.name) {
					if (index > 0) content += "\n";
					content += `### ${item.name}\n`;

					if (item.type?.length) {
						const typeText = item.type.map((t: any) => t.text).join("");
						content += `**Type:** \`${typeText}\`\n`;
					}

					if (item.required) {
						content += `**Required:** Yes\n`;
					}

					if (item.content?.length) {
						item.content.forEach((contentItem: any) => {
							const result = this.convertContentSectionToMarkdown(contentItem, references, 0);
							if (result.content) {
								content += `${result.content}\n`;
							}
						});
					}
				}
			});
		}

		return { title: section.title || "", content };
	}

	private renderRestResponses(
		section: any,
		references: Record<string, any>,
	): { title: string; content: string } {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n`;
		}

		if (section.items?.length) {
			section.items.forEach((item: any, index: number) => {
				if (item.status) {
					if (index > 0) content += "\n";
					content += `### ${item.status} ${item.reason || ""}\n`;

					if (item.type?.length) {
						const typeText = item.type.map((t: any) => t.text).join("");
						content += `**Response Type:** \`${typeText}\`\n`;
					}

					if (item.mimeType) {
						content += `**Content Type:** \`${item.mimeType}\`\n`;
					}

					if (item.content?.length) {
						item.content.forEach((contentItem: any) => {
							const result = this.convertContentSectionToMarkdown(contentItem, references, 0);
							if (result.content) {
								content += `${result.content}\n`;
							}
						});
					}
				}
			});
		}

		return { title: section.title || "", content };
	}

	private renderDetails(section: any): { title: string; content: string } {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n\n`;
		}

		if (section.details) {
			const details = section.details;
			const items = [];

			// Collect all items first
			if (details.name) {
				items.push(`**Name:** ${details.name}`);
			}

			// Render value type information
			if (details.value && Array.isArray(details.value)) {
				details.value.forEach((valueInfo: any) => {
					if (valueInfo.baseType) {
						const arrayMode = valueInfo.arrayMode ? " (array)" : "";
						items.push(`**Type:** ${valueInfo.baseType}${arrayMode}`);
					}
				});
			}

			// Render platform information if available
			if (details.platforms && Array.isArray(details.platforms) && details.platforms.length > 0) {
				const platformInfo = details.platforms
					.map((platform: any) => this.formatPlatformInfo(platform))
					.filter((info: string) => info.trim())
					.join(", ");
				if (platformInfo) {
					items.push(`**Platforms:** ${platformInfo}`);
				}
			}

			// Join items with proper spacing
			content += items.join("\n\n");
		}

		return { title: section.title || "", content };
	}

	private renderPossibleValues(section: any): {
		title: string;
		content: string;
	} {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n\n`;
		}

		if (section.values && Array.isArray(section.values)) {
			section.values.forEach((value: any) => {
				if (value.name) {
					content += `- **${value.name}**`;

					// If there's content for this value, render it
					if (value.content && Array.isArray(value.content) && value.content.length > 0) {
						content += ": ";
						const valueContent = value.content
							.map((contentItem: any) => {
								if (contentItem.inlineContent) {
									return contentItem.inlineContent
										.map((inline: any) => this.renderInlineContent(inline, {}))
										.join("");
								}
								return "";
							})
							.join(" ");
						content += valueContent;
					}

					content += "\n";
				}
			});
			// No trailing newline needed - handled by extractMainContent
		}

		return { title: section.title || "", content };
	}

	private renderAttributes(section: any): { title: string; content: string } {
		let content = "";

		if (section.title) {
			content += `## ${section.title}\n\n`;
		}

		if (section.attributes && Array.isArray(section.attributes)) {
			const items: string[] = [];
			section.attributes.forEach((attribute: any) => {
				if (attribute.kind && attribute.value) {
					items.push(`**${attribute.kind}:** ${attribute.value}`);
				}
			});

			// Join items with proper spacing
			content += items.join("\n\n");
		}

		return { title: section.title || "", content };
	}

	/**
	 * Lightweight synchronous type conversion for frequently called methods
	 * Converts any value to string without sending notifications
	 */
	private toSafeString(value: any): string {
		return typeof value === "string" ? value : String(value || "");
	}

	private normalizeLineTerminators(text: string): string {
		return text.replace(/[\u2028\u2029]/g, "\n");
	}
}

export { ContentProcessor };
