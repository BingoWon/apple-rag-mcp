import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { MacbookScroll } from "@/components/ui/macbook-scroll";
import { copyText } from "@/utils/clipboard";
import { type HeroPreview, loadPreview, original, storageKey } from "./hero-preview";

const round = (n: number) => Math.round(n * 10) / 10;
const field = "w-full rounded border border-default bg-card px-2 py-1 text-sm text-light";

function measure(host: HTMLDivElement | null) {
	const rect = host?.getBoundingClientRect();
	const video = host?.querySelector("video");
	return {
		viewport: [innerWidth, innerHeight],
		pageY: Math.round(scrollY),
		heroTop: rect ? Math.round(rect.top + scrollY) : 0,
		heroHeight: Math.round(rect?.height ?? 0),
		heroPercent: rect?.height
			? round(Math.max(0, Math.min(100, (-rect.top * 100) / rect.height)))
			: 0,
		videoSeconds: video && video.readyState >= 2 ? Math.round(video.currentTime * 100) / 100 : null,
	};
}

function Slider({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (n: number) => void;
}) {
	return (
		<label className="grid gap-1">
			<span className="flex justify-between">
				{label}
				<span className="tabular-nums">{value}%</span>
			</span>
			<input
				type="range"
				aria-label={label}
				className="w-full accent-current"
				min={min}
				max={max}
				step={0.1}
				value={value}
				onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
			/>
		</label>
	);
}

function Panel({
	host,
	value,
	change,
	close,
}: {
	host: RefObject<HTMLDivElement | null>;
	value: HeroPreview;
	change: (v: HeroPreview) => void;
	close: () => void;
}) {
	const [live, setLive] = useState(() => measure(host.current));
	const [message, setMessage] = useState("");
	const [manualCopy, setManualCopy] = useState("");
	useEffect(() => {
		const node = host.current;
		let pending = 0;
		const refresh = () => {
			if (!pending)
				pending = requestAnimationFrame(() => {
					pending = 0;
					setLive(measure(node));
				});
		};
		refresh();
		window.addEventListener("scroll", refresh, { passive: true });
		window.addEventListener("resize", refresh);
		node?.addEventListener("seeked", refresh, true);
		const observer = new ResizeObserver(refresh);
		if (node) observer.observe(node);
		return () => {
			cancelAnimationFrame(pending);
			window.removeEventListener("scroll", refresh);
			window.removeEventListener("resize", refresh);
			node?.removeEventListener("seeked", refresh, true);
			observer.disconnect();
		};
	}, [host]);
	function update(patch: Partial<HeroPreview>) {
		setMessage("");
		setManualCopy("");
		change({ ...value, ...patch });
	}
	function mark(which: "start" | "end") {
		const pct = measure(host.current).heroPercent;
		const [start, end] = value.range ?? [0, 100];
		const range: [number, number] = which === "start" ? [pct, end] : [start, pct];
		if (range[0] >= range[1]) {
			setMessage("起点必须早于终点，请换一个滚动位置。");
			return;
		}
		update({ range });
	}
	async function copy() {
		const json = JSON.stringify(
			{
				preset: "apple-rag-macbook-hero/v1",
				baseline: "5.14.2",
				playback: value.range
					? { mode: "linear-hero-percent", start: value.range[0], end: value.range[1] }
					: { mode: "original" },
				uprightHeroPercent: value.upright,
				minHeroHeightVh: value.height,
				screenAspect: value.aspect === "video" ? "1280:848" : "4:3",
				objectFit: value.fit,
				measured: measure(host.current),
			},
			null,
			2,
		);
		try {
			await copyText(json);
			setManualCopy("");
			setMessage("已复制，可以发给我。");
		} catch {
			setManualCopy(json);
			setMessage("浏览器未允许复制，可从下方文本框复制。");
		}
	}
	return (
		<aside
			aria-label="Hero 调试"
			className="fixed bottom-3 left-3 z-[110] flex max-h-[82dvh] w-[min(20rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-default bg-card text-light shadow-lg"
		>
			<header className="flex items-center justify-between border-b border-default px-3 py-2">
				<h2 className="text-sm font-semibold">Hero 调试</h2>
				<Button size="sm" variant="ghost" onClick={close}>
					收起
				</Button>
			</header>
			<div className="space-y-3 overflow-y-auto px-3 py-3 text-xs">
				<p className="tabular-nums">
					页面 {live.pageY} px · Hero {live.heroPercent}% · 视频{" "}
					{live.videoSeconds === null ? "静态封面" : `${live.videoSeconds.toFixed(2)} s`}
				</p>
				<label className="grid gap-1">
					播放区间
					<select
						className={field}
						value={value.range ? "custom" : "original"}
						onChange={(e) => update({ range: e.target.value === "original" ? null : [0, 100] })}
					>
						<option value="original">原版曲线（5.14.2）</option>
						<option value="custom">自定起点和终点</option>
					</select>
				</label>
				{value.range && (
					<>
						<Slider
							label="视频起点"
							min={0}
							max={round(value.range[1] - 0.1)}
							value={value.range[0]}
							onChange={(n) => update({ range: [n, value.range![1]] })}
						/>
						<Slider
							label="视频终点"
							min={round(value.range[0] + 0.1)}
							max={100}
							value={value.range[1]}
							onChange={(n) => update({ range: [value.range![0], n] })}
						/>
					</>
				)}
				<div className="grid grid-cols-2 gap-2">
					<Button size="sm" onClick={() => mark("start")}>
						当前位置设为起点
					</Button>
					<Button size="sm" onClick={() => mark("end")}>
						当前位置设为终点
					</Button>
				</div>
				<Slider
					label="屏幕摆正位置"
					value={value.upright}
					min={13}
					max={100}
					onChange={(upright) => update({ upright })}
				/>
				<div className="grid grid-cols-2 gap-2">
					<label className="grid gap-1">
						屏幕比例
						<select
							className={field}
							value={value.aspect}
							onChange={(e) =>
								update({ aspect: e.target.value === "video" ? "video" : "original" })
							}
						>
							<option value="original">原版 4∶3</option>
							<option value="video">视频原比例</option>
						</select>
					</label>
					<label className="grid gap-1">
						画面填充
						<select
							className={field}
							value={value.fit}
							onChange={(e) => update({ fit: e.target.value as HeroPreview["fit"] })}
						>
							<option value="contain">完整显示</option>
							<option value="fill">拉伸铺满</option>
							<option value="cover">裁切铺满</option>
						</select>
					</label>
				</div>
				<label className="grid gap-1">
					Hero 最小滚动高度
					<select
						className={field}
						value={value.height ?? ""}
						onChange={(e) => update({ height: e.target.value ? Number(e.target.value) : null })}
					>
						<option value="">原版（桌面 2 屏 / 手机 1.5 屏）</option>
						{[100, 150, 200, 250, 300, 350, 400, 500, 600].map((h) => (
							<option key={h} value={h}>
								{h / 100} 屏
							</option>
						))}
					</select>
				</label>
			</div>
			<footer className="grid gap-1 border-t border-default px-3 py-2">
				<div className="flex gap-2">
					<Button variant="primary" size="sm" className="grow" onClick={copy}>
						复制调试参数
					</Button>
					<Button size="sm" variant="ghost" onClick={() => update(original)}>
						恢复原版
					</Button>
				</div>
				<span role="status" className="text-xs">
					{message}
				</span>
				{manualCopy && (
					<textarea
						aria-label="调试参数"
						readOnly
						value={manualCopy}
						onFocus={(e) => e.target.select()}
						className={field}
					/>
				)}
			</footer>
		</aside>
	);
}

export default function HeroDebug() {
	const host = useRef<HTMLDivElement>(null);
	const [value, setValue] = useState(loadPreview);
	const [open, setOpen] = useState(() => new URLSearchParams(location.search).has("hero-debug"));
	function change(next: HeroPreview) {
		setValue(next);
		try {
			localStorage.setItem(storageKey, JSON.stringify(next));
		} catch {
			/* Keep in-memory preview. */
		}
	}
	return (
		<>
			<div ref={host}>
				<MacbookScroll preview={value} />
			</div>
			{createPortal(
				open ? (
					<Panel host={host} value={value} change={change} close={() => setOpen(false)} />
				) : (
					<Button
						size="sm"
						className="fixed bottom-3 left-3 z-[110] shadow-md"
						onClick={() => setOpen(true)}
					>
						Hero 调试
					</Button>
				),
				document.body,
			)}
		</>
	);
}
