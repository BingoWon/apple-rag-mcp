import { Fragment } from "react";
import { useAuthStore } from "@/stores/auth";
import { UnreadReplyNotification } from "./UnreadReplyNotification";
import { FabButton } from "./ui/FabButton";

export default function AccountOverlays() {
	const owner = useAuthStore((state) => state.user?.id ?? "anonymous");
	return (
		<Fragment key={owner}>
			<FabButton />
			<UnreadReplyNotification />
		</Fragment>
	);
}
