import { IconArrowLeft, IconHome } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { activateFabContact } from "@/components/ui/FabButton";
import { LampContainer } from "@/components/ui/lamp";

export default function NotFound() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen flex flex-col">
			<LampContainer>
				<motion.h1
					initial={{ opacity: 0.5, y: 100 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{
						delay: 0.3,
						duration: 0.8,
						ease: "easeInOut",
					}}
					className="mt-8 bg-gradient-to-br from-slate-300 to-slate-500 py-4 bg-clip-text text-center text-5xl font-medium tracking-tight text-transparent md:text-7xl"
				>
					404 <br /> {t("notfound.title")}
				</motion.h1>

				<motion.p
					initial={{ opacity: 0.5, y: 50 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{
						delay: 0.5,
						duration: 0.8,
						ease: "easeInOut",
					}}
					className="mt-6 text-center text-slate-400 text-lg max-w-md"
				>
					{t("notfound.subtitle")}
				</motion.p>

				<motion.div
					initial={{ opacity: 0.5, y: 50 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{
						delay: 0.7,
						duration: 0.8,
						ease: "easeInOut",
					}}
					className="mt-8 flex flex-col sm:flex-row gap-4"
				>
					<Link to="/">
						<Button
							size="lg"
							className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3"
						>
							<IconHome className="h-5 w-5" />
							{t("notfound.home")}
						</Button>
					</Link>

					<Button
						variant="outline"
						size="lg"
						onClick={() => window.history.back()}
						className="flex items-center gap-2 border-slate-400 text-slate-400 hover:bg-slate-400 hover:text-slate-900 px-6 py-3"
					>
						<IconArrowLeft className="h-5 w-5" />
						{t("notfound.back")}
					</Button>
				</motion.div>

				<motion.div
					initial={{ opacity: 0.5, y: 50 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{
						delay: 0.8,
						duration: 0.8,
						ease: "easeInOut",
					}}
					className="mt-8 flex flex-col items-center gap-3"
				>
					<p className="text-center text-slate-500 text-sm">{t("notfound.is_error")}</p>
					<Button
						variant="link"
						size="sm"
						onClick={() => activateFabContact()}
						className="text-slate-400 hover:text-slate-200 underline-offset-4"
						data-nav-action="fab-contact"
					>
						{t("nav.contact")}
					</Button>
				</motion.div>
			</LampContainer>
		</div>
	);
}
