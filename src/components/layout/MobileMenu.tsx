import { Dialog, Transition } from "@headlessui/react";
import { IconX } from "@tabler/icons-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

interface MobileMenuProps {
	open: boolean;
	onClose: () => void;
	navigation: Array<{ name: string; href: string }>;
	isAuthenticated: boolean;
	user?: {
		name?: string;
		email: string;
	};
}

export function MobileMenu({ open, onClose, navigation, isAuthenticated, user }: MobileMenuProps) {
	return (
		<Transition.Root show={open} as={Fragment}>
			<Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter="transition-opacity ease-linear duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="transition-opacity ease-linear duration-300"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-primary/80" />
				</Transition.Child>

				<div className="fixed inset-0 flex">
					<Transition.Child
						as={Fragment}
						enter="transition ease-in-out duration-300 transform"
						enterFrom="-translate-x-full"
						enterTo="translate-x-0"
						leave="transition ease-in-out duration-300 transform"
						leaveFrom="translate-x-0"
						leaveTo="-translate-x-full"
					>
						<Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
							<div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background/90 backdrop-blur-md border border-border px-6 pb-4">
								<div className="flex h-16 shrink-0 items-center justify-between">
									<Link to="/" className="flex items-center space-x-2" onClick={onClose}>
										<div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center">
											<span className="text-inverse font-bold text-sm">AR</span>
										</div>
										<span className="text-xl font-bold text-light">Apple RAG MCP</span>
									</Link>
									<Button type="button" variant="ghost" size="icon" onClick={onClose}>
										<span className="sr-only">Close menu</span>
										<IconX className="h-6 w-6 text-light" aria-hidden="true" />
									</Button>
								</div>
								<nav className="flex flex-1 flex-col">
									<ul className="flex flex-1 flex-col gap-y-7">
										<li>
											<ul className="-mx-2 space-y-1">
												{navigation.map((item) => (
													<li key={item.name}>
														<Link
															to={item.href}
															className="text-muted hover:text-brand hover:bg-secondary group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
															onClick={onClose}
														>
															{item.name}
														</Link>
													</li>
												))}
											</ul>
										</li>
										<li className="mt-auto">
											<div className="space-y-4">
												{isAuthenticated ? (
													<>
														<div className="text-sm text-muted px-2">
															Welcome, {user?.name || user?.email}
														</div>
														<Link to="/overview/" onClick={onClose}>
															<Button className="w-full">Dashboard</Button>
														</Link>
													</>
												) : (
													<>
														<Link to="/login" onClick={onClose}>
															<Button variant="outline" className="w-full">
																Sign In
															</Button>
														</Link>
														<Link to="/register" onClick={onClose}>
															<Button className="w-full">Get Started</Button>
														</Link>
													</>
												)}
											</div>
										</li>
									</ul>
								</nav>
							</div>
						</Dialog.Panel>
					</Transition.Child>
				</div>
			</Dialog>
		</Transition.Root>
	);
}
