export default function PrivacyPolicyContent() {
	return (
		<div className="bg-gradient-to-br from-primary to-secondary border border-default rounded-2xl p-8 md:p-12">
			<div className="prose prose-invert max-w-none text-muted leading-relaxed">
				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">1. Introduction</h2>
					<p className="mb-0">
						Apple RAG MCP ("we," "our," or "us") is committed to protecting your privacy. This
						Privacy Policy explains how we collect, use, disclose, and safeguard your information
						when you use our Model Context Protocol (MCP) services that provide access to Apple
						developer documentation and related resources.
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-6">2. Information We Collect</h2>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">2.1 Account Information</h3>
						<p className="mb-0">
							When you create an account, we collect your email address, name, and authentication
							credentials. We use OAuth providers (Google, GitHub) to securely authenticate your
							identity.
						</p>
					</div>

					<div className="mb-6">
						<h3 className="text-lg font-semibold text-light mb-3">2.2 Usage Data</h3>
						<p className="mb-3">
							We collect information about how you use our MCP services, including:
						</p>
						<ul className="list-disc pl-6 space-y-2 mb-0">
							<li>API requests and responses through our MCP server</li>
							<li>Search queries and usage patterns</li>
							<li>Token usage and rate limiting data</li>
							<li>Performance metrics and error logs</li>
							<li>IP addresses for security and rate limiting purposes</li>
						</ul>
					</div>

					<div className="mb-0">
						<h3 className="text-lg font-semibold text-light mb-3">2.3 Technical Information</h3>
						<p className="mb-0">
							We automatically collect certain technical information, including your IP address,
							browser type, device information, and operating system to provide and improve our
							services.
						</p>
					</div>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">3. How We Use Your Information</h2>
					<p className="mb-3">We use the collected information for the following purposes:</p>
					<ul className="list-disc pl-6 space-y-2 mb-0">
						<li>Providing and maintaining our MCP services</li>
						<li>Processing your search requests and API calls</li>
						<li>Managing your account and authentication</li>
						<li>Monitoring usage for rate limiting and fair use policies</li>
						<li>Improving our services and developing new features</li>
						<li>Ensuring security and preventing abuse</li>
						<li>Complying with legal obligations</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">4. Data Sharing and Disclosure</h2>
					<p className="mb-4">
						We do not sell, trade, or otherwise transfer your personal information to third parties,
						except in the following circumstances:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>With your explicit consent</li>
						<li>To comply with legal obligations or court orders</li>
						<li>To protect our rights, property, or safety, or that of our users</li>
						<li>In connection with a business transfer or acquisition</li>
					</ul>
					<p className="mb-0">
						<strong>Note:</strong> Our service queries Apple's public documentation. We do not share
						your personal queries with Apple, but the documentation content comes from Apple's
						public resources.
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">5. Data Security</h2>
					<p className="mb-3">
						We implement industry-standard security measures to protect your information:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-0">
						<li>Encryption in transit and at rest</li>
						<li>Secure authentication using OAuth 2.0</li>
						<li>Regular security audits and monitoring</li>
						<li>Access controls and principle of least privilege</li>
						<li>Secure API token management</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">6. Data Retention</h2>
					<p className="mb-3">
						We retain your information for as long as necessary to provide our services and comply
						with legal obligations. Specifically:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-0">
						<li>Account information: Until you delete your account</li>
						<li>Usage logs: 90 days for operational purposes</li>
						<li>Error logs: 30 days for debugging and improvement</li>
						<li>Security logs: 1 year for security monitoring</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">7. Your Rights</h2>
					<p className="mb-3">You have the following rights regarding your personal information:</p>
					<ul className="list-disc pl-6 space-y-2 mb-0">
						<li>Access: Request a copy of your personal data</li>
						<li>Correction: Update or correct inaccurate information</li>
						<li>Deletion: Request deletion of your account and associated data</li>
						<li>Portability: Export your data in a machine-readable format</li>
						<li>Objection: Object to certain processing activities</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-bold text-light mb-4">
						8. Service Limitations and Disclaimers
					</h2>
					<p className="mb-4">
						While we implement industry-standard security measures and privacy practices, we cannot
						guarantee absolute security or privacy protection. Users acknowledge that:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>Internet transmissions are never completely private or secure</li>
						<li>Any information transmitted may be subject to interception</li>
						<li>
							We are not responsible for circumvention of privacy settings or security measures
						</li>
						<li>Users assume responsibility for their own data protection practices</li>
					</ul>
					<p className="mb-0">
						Our privacy practices are designed to comply with applicable laws, but users are
						responsible for ensuring their own compliance with relevant privacy regulations in their
						jurisdiction.
					</p>
				</section>

				<section className="mb-0">
					<h2 className="text-2xl font-bold text-light mb-4">9. Contact Us</h2>
					<p className="mb-0">
						If you have any questions about this Privacy Policy or our data practices, please
						contact us through our support system in the dashboard.
					</p>
				</section>

				{/* Additional spacing to match Terms of Service height */}
				<div className="h-81 md:h-48"></div>
			</div>
		</div>
	);
}
