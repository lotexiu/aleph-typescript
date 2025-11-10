import type { Dispatch } from "react";
import { ReactBaseComponent } from "./ReactBaseComponent";

export abstract class ReactClientComponent<Props=any> extends ReactBaseComponent<Props> {
	private dispatch!: Dispatch<any>

	updateView(): void {
		if (!this.dispatch) throw new Error(`Não é possível atualizar a "updateView" antes do componente ser montado.`);
		this.dispatch(Math.random());
	}
}