import { IconAlertTriangle } from "@tabler/icons-react";
import toast from "react-hot-toast";

export function showAugmentCodeWarning(): void {
	toast.custom(
		() => (
			<button
				type="button"
				onClick={() => window.open("/authorized-ips", "_blank")}
				className="flex max-w-[470px] cursor-pointer select-none items-center gap-3 rounded-xl border-2 border-warning bg-warning px-3.5 py-2.5 text-left text-[15px] font-semibold text-inverse shadow-[0_8px_25px_rgba(251,191,36,0.3)]"
			>
				<IconAlertTriangle size={20} className="shrink-0" />
				<span>
					Augment Code doesn't support Authorization headers. Click to configure Authorized IP
					Addresses!
				</span>
			</button>
		),
		{ duration: 12000 },
	);
}
