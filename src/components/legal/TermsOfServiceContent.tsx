export default function TermsOfServiceContent() {
	return (
		<div className="bg-gradient-to-br from-primary to-secondary border border-default rounded-2xl p-8 md:p-12">
			<div className="prose prose-invert max-w-none text-muted leading-relaxed">
				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">1. Acceptance of Terms</h2>
					<p className="mb-0">
						By accessing and using Apple RAG MCP services ("the Service"), you accept and agree to
						be bound by the terms and provisions of this agreement. If you do not agree to abide by
						these terms, please do not use this Service.
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">2. Description of Service</h2>
					<p className="mb-4">
						Apple RAG MCP provides a Model Context Protocol server that enables AI assistants and
						applications to search and retrieve information from Apple's developer documentation.
						Our service includes:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-0">
						<li>MCP server endpoints for AI assistant integration</li>
						<li>Search functionality across Apple developer documentation</li>
						<li>API token management and authentication</li>
						<li>Usage monitoring and rate limiting</li>
						<li>Access to Apple's public developer resources</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">3. User Accounts and Registration</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">3.1 Account Creation</h3>
						<p className="mb-0">
							To use our Service, you must create an account using OAuth authentication (Google or
							GitHub). You are responsible for maintaining the confidentiality of your account
							credentials.
						</p>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">3.2 Account Responsibility</h3>
						<p className="mb-0">
							You are responsible for all activities that occur under your account. You must notify
							us immediately of any unauthorized use of your account or any other breach of
							security.
						</p>
					</div>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">4. Acceptable Use Policy</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">4.1 Permitted Uses</h3>
						<p className="mb-3">You may use our Service for:</p>
						<ul className="list-disc pl-6 space-y-2 mb-0">
							<li>Legitimate development and research purposes</li>
							<li>Building AI applications that need documentation access</li>
							<li>Educational and learning activities</li>
							<li>Commercial applications that comply with these terms</li>
						</ul>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">4.2 Prohibited Uses</h3>
						<p className="mb-3">You may not use our Service to:</p>
						<ul className="list-disc pl-6 space-y-2 mb-0">
							<li>Violate any applicable laws or regulations</li>
							<li>Infringe on intellectual property rights</li>
							<li>Attempt to reverse engineer or compromise our systems</li>
							<li>Exceed rate limits or attempt to circumvent usage restrictions</li>
							<li>Use the Service for spam, harassment, or malicious activities</li>
						</ul>
					</div>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">5. API Usage and Rate Limits</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">5.1 Rate Limits</h3>
						<p className="mb-0">
							We implement rate limits to ensure fair usage and service availability. Rate limits
							vary based on your account type and authentication status.
						</p>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">5.2 API Tokens</h3>
						<p className="mb-0">
							API tokens may be provided for authentication and enhanced usage limits. You must keep
							any tokens secure and report compromised tokens immediately.
						</p>
					</div>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">6. Intellectual Property</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">6.1 Our Content</h3>
						<p className="mb-0">
							The Service and its original content, features, and functionality are owned by Apple
							RAG MCP and are protected by international copyright, trademark, patent, trade secret,
							and other intellectual property laws.
						</p>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">6.2 Apple Documentation</h3>
						<p className="mb-0">
							The Apple developer documentation accessed through our Service is owned by Apple Inc.
							We provide access to this public information but do not claim ownership of Apple's
							content.
						</p>
					</div>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">
						7. Service Availability and Performance
					</h2>
					<p className="mb-4">
						While we strive to maintain high availability of our Service, we do not guarantee
						uninterrupted, timely, secure, or error-free access. We reserve the right to:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Modify, suspend, or discontinue any part of the Service at any time</li>
						<li>Implement maintenance windows that may affect service availability</li>
						<li>Adjust rate limits and usage quotas based on system capacity</li>
						<li>Update or change our AI models and search algorithms</li>
					</ul>
					<p className="mb-0">
						Users acknowledge that service interruptions may occur due to factors beyond our
						control, including but not limited to third-party service dependencies, network issues,
						or force majeure events. We shall not be liable for any consequences arising from
						service unavailability.
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">
						8. Disclaimers and Limitation of Liability
					</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">8.1 Service Disclaimers</h3>
						<p className="mb-4">
							The Service is provided on an "as is" and "as available" basis without warranties of
							any kind, whether express or implied. We disclaim all warranties, including but not
							limited to implied warranties of merchantability, fitness for a particular purpose,
							non-infringement, and those arising from course of dealing or usage of trade.
						</p>
						<p className="mb-0">
							We do not warrant that the Service will be uninterrupted, secure, or error-free, or
							that any defects will be corrected. The accuracy, reliability, and completeness of
							information accessed through our Service, including Apple documentation and related
							content, are not guaranteed.
						</p>
					</div>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">8.2 Limitation of Liability</h3>
						<p className="mb-4">
							To the fullest extent permitted by applicable law, in no event shall Apple RAG MCP,
							its affiliates, officers, directors, employees, agents, or licensors be liable for any
							direct, indirect, incidental, special, consequential, or punitive damages, including
							but not limited to:
						</p>
						<ul className="list-disc pl-6 space-y-2 mb-4">
							<li>Loss of profits, revenue, or business opportunities</li>
							<li>Loss of data, information, or content</li>
							<li>Business interruption or operational delays</li>
							<li>Loss of goodwill or reputation</li>
							<li>Cost of substitute goods or services</li>
							<li>Any other commercial damages or losses</li>
						</ul>
						<p className="mb-0">
							This limitation applies regardless of the theory of liability, whether based on
							warranty, contract, statute, tort (including negligence), or otherwise, and even if we
							have been advised of the possibility of such damages.
						</p>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">8.3 Maximum Liability</h3>
						<p className="mb-0">
							Our total liability to you for all claims arising out of or relating to the Service
							shall not exceed the amount you have paid us in the twelve (12) months preceding the
							claim. For users of our free services, our maximum liability shall not exceed fifty
							dollars ($50).
						</p>
					</div>
				</section>

				<section className="mb-0">
					<h2 className="text-2xl font-bold text-light mb-4">9. Contact Information</h2>
					<p className="mb-0">
						If you have any questions about these Terms of Service, please contact us through our
						support system in the user dashboard.
					</p>
				</section>
			</div>
		</div>
	);
}
