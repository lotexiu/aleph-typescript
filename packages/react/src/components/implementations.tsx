import type { TConstructor } from "@tsn-class/generic/types";
import type { ReactNode } from "react";
import type { ReactComponentProxy, WrappedComponent } from "./ReactComponent/types";
import { ReactClientComponent } from "./ReactComponent/ReactClientComponent";

export function ReactWrapper<T extends TConstructor<any>>(ComponentClass: T): WrappedComponent<T> {
	// Lambda commands cannot be used as components or screens in Next.js because they affect rendering functionality.
	return function ComponentWrapper(props: any): ReactNode {
		const newClassInstance: ReactComponentProxy = new ComponentClass(props)
		
		if (newClassInstance instanceof ReactClientComponent) {
			const {useState} = require("react");
			const [currentInstance, setInstance] = useState(newClassInstance);
	
			Object.assign(currentInstance, {
				dispatch: useState({})[1]
			})

			if (Object.getPrototypeOf(currentInstance) != Object.getPrototypeOf(newClassInstance)) {
				setInstance(newClassInstance)
				newClassInstance.onInit();
			}

			currentInstance.setupHooks();
			return currentInstance.render();
		}
		// cant use render() directly in the return, because its going to break the rendering functionality for Next.js
		const Comp = newClassInstance.render;
		return (
			<>
				<Comp></Comp>
			</>
		);
	}
}