import { proxyHandler } from "@lotexiu/typescript/natives/object/proxy/ProxyHandler";
import { Property } from "@lotexiu/typescript/natives/object/proxy/types";
import type { ReactNode } from "react";


export abstract class ReactBaseComponent<Props=any> {
	readonly originalProps!: Props;

	props: Props;
	children?: ReactNode;

	constructor(
		props: Props
	) {
		this.originalProps = props;
		this.props = {...props};
		this.children = (props as any).children;
		

		const proxy: this = proxyHandler(this, {
			allProxy: false,
			onChanges: this.onChanges.bind(this),
			properties: {
				props: {
					onChanges: this.onPropsChange.bind(this) as any,
				},
				render: {
					onGet(value) {return value.rebind(proxy)},
				}
			}
		})
		return proxy
	}

	onInit(): void {};
	setupHooks(): void {};
	onChanges(property: Property<this>): void {}
	onPropsChange(properties: Property<this['props']>): void {}

	/**
	 * Render the component
	 * Any changes on `this` will trigger onChanges
	 */
	abstract render() : ReactNode;
}