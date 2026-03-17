import { motion } from "motion/react";

function ColourfulText({ text }: { text: string }) {
	// 精心挑选的14个高质感颜色：绿→黄→橙→红→紫→蓝
	const premiumColors = [
		"rgb(16, 185, 129)", // 1. 翡翠绿 - 高级翡翠色，深邃而优雅
		"rgb(34, 197, 94)", // 2. 鲜活绿 - 生机勃勃的绿色，充满活力
		"rgb(132, 204, 22)", // 3. 青柠绿 - 清新青柠色，年轻时尚
		"rgb(202, 138, 4)", // 4. 琥珀黄 - 深邃琥珀色，温暖厚重
		"rgb(245, 158, 11)", // 5. 金辉黄 - 温暖金色，奢华典雅
		"rgb(251, 146, 60)", // 6. 蜜桃橙 - 柔和蜜桃色，温柔甜美
		"rgb(249, 115, 22)", // 7. 活力橙 - 充满活力的橙色，热情洋溢
		"rgb(239, 68, 68)", // 8. 珊瑚红 - 优雅珊瑚色，温暖迷人
		"rgb(220, 38, 127)", // 9. 玫瑰红 - 深邃玫瑰色，浪漫高贵
		"rgb(168, 85, 247)", // 10. 薰衣草紫 - 优雅薰衣草色，神秘梦幻
		"rgb(147, 51, 234)", // 11. 皇家紫 - 高贵皇家紫，威严典雅
		"rgb(124, 58, 237)", // 12. 深邃紫 - 神秘深紫色，智慧深沉
		"rgb(79, 70, 229)", // 13. 靛青蓝 - 深邃靛青色，沉稳专业
		"rgb(59, 130, 246)", // 14. 天空蓝 - 清澈天空蓝，纯净明亮
	];

	return text.split("").map((char, index) => {
		// 计算当前字符在可见字符中的位置（跳过空格）
		const charPosition = text.substring(0, index).replace(/\s/g, "").length;

		// 获取颜色
		const getColor = () => {
			if (char === " ") {
				return "transparent"; // 空格使用透明色
			}
			return premiumColors[charPosition % premiumColors.length];
		};

		return (
			<motion.span
				key={`${char}-${index}`}
				initial={{
					y: 0,
				}}
				animate={{
					color: getColor(),
					y: [0, -3, 0],
					scale: [1, 1.01, 1],
					filter: ["blur(0px)", `blur(5px)`, "blur(0px)"],
					opacity: [1, 0.8, 1],
				}}
				transition={{
					duration: 0.5,
					delay: index * 0.05,
				}}
				className="inline-block whitespace-pre font-sans tracking-tight"
			>
				{char}
			</motion.span>
		);
	});
}

export default ColourfulText;
