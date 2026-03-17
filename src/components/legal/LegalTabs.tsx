import { motion } from "motion/react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PrivacyPolicyContent from "./PrivacyPolicyContent";
import TermsOfServiceContent from "./TermsOfServiceContent";

export default function LegalTabs() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const [hovering, setHovering] = useState(false);

	const tabs = [
		{
			title: "Privacy Policy",
			value: "privacy-policy",
			content: <PrivacyPolicyContent />,
		},
		{
			title: "Terms of Service",
			value: "terms-of-service",
			content: <TermsOfServiceContent />,
		},
	];

	const activeIndex = tabs.findIndex((tab) => pathname.includes(tab.value)) || 0;

	const getDisplayOrder = () => {
		const ordered = [...tabs];
		const activeTab = ordered.splice(activeIndex, 1)[0];
		ordered.unshift(activeTab);
		return ordered;
	};

	const displayTabs = getDisplayOrder();

	const handleTabClick = (originalIndex: number) => {
		if (originalIndex !== activeIndex) {
			navigate(`/${tabs[originalIndex].value}`);
		}
	};

	return (
		<div className="h-[18rem] md:h-[35rem] [perspective:1000px] relative flex flex-col max-w-5xl mx-auto w-full items-start justify-start my-4 md:my-8">
			{/* Tab Navigation */}
			<div className="flex flex-row items-center justify-center [perspective:1000px] relative overflow-auto sm:overflow-visible no-visible-scrollbar max-w-full w-full">
				{tabs.map((tab, idx) => (
					<button
						type="button"
						key={tab.value}
						onClick={() => handleTabClick(idx)}
						onMouseEnter={() => setHovering(true)}
						onMouseLeave={() => setHovering(false)}
						className="relative px-4 py-1.5 rounded-full"
						style={{ transformStyle: "preserve-3d" }}
					>
						{activeIndex === idx && (
							<motion.div
								layoutId="clickedbutton"
								transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
								className="absolute inset-0 bg-gray-800 dark:bg-gray-200 rounded-full shadow-lg"
							/>
						)}
						<span
							className={`relative block font-bold ${
								activeIndex === idx ? "text-white dark:text-gray-800" : "text-foreground"
							}`}
						>
							{tab.title}
						</span>
					</button>
				))}
			</div>

			{/* Content with stacking */}
			<div className="relative w-full h-full mt-8 md:mt-16">
				{displayTabs.map((tab, idx) => (
					<motion.div
						key={tab.value}
						layoutId={tab.value}
						style={{
							scale: 1 - idx * 0.1,
							top: hovering ? idx * -50 : 0,
							zIndex: -idx,
							opacity: idx < 3 ? 1 - idx * 0.1 : 0,
						}}
						animate={{
							y: idx === 0 ? [0, 40, 0] : 0,
						}}
						className="w-full h-full absolute top-0 left-0"
					>
						{tab.content}
					</motion.div>
				))}
			</div>
		</div>
	);
}
