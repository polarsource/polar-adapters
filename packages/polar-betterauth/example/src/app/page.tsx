import { Login } from "@/components/Login";
import { Me } from "@/components/Me";
import { Register } from "@/components/Register";

export default function Home() {
	return (
		<div className="flex flex-row gap-4 items-center justify-center h-screen">
			<Me />
			<Register />
			<Login />
		</div>
	);
}
