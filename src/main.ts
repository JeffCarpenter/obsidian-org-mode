import "./lib/codemirror.js";
import "./mode/simple/simple.js";
import "./mode/orgmode/orgmode-fold.js";
import "./mode/orgmode/orgmode-mode.js";
import { Plugin, TextFileView, type WorkspaceLeaf } from "obsidian";

type OrgmodeHelper = {
	init?: (
		editor: CodeMirror.Editor,
		register?: (
			event: string,
			handler: (...args: unknown[]) => void,
		) => unknown,
	) => undefined | (() => void);
	destroy?: (editor: CodeMirror.Editor) => void;
};

type CodeMirrorWithOrgmodeHelper = {
	helpers?: {
		orgmode?: OrgmodeHelper;
	};
};

export default class OrgMode extends Plugin {
	async onload() {
		super.onload();
		console.log("Loading Org Mode plugin ...");

		this.registerView("orgmode", this.orgViewCreator);
		this.registerExtensions(["org", "org_archive"], "orgmode");
	}

	orgViewCreator = (leaf: WorkspaceLeaf) => {
		return new OrgView(leaf);
	};

	onunload() {
		console.log("Unloading Org Mode plugin ...");
	}
}

// This is the custom view:
class OrgView extends TextFileView {
	// Internal code mirror instance:
	codeMirror: CodeMirror.Editor;
	private destroyOrgHelper?: () => void;

	// this.contentEl is not exposed, so cheat a bit.
	public get extContentEl(): HTMLElement {
		// @ts-expect-error
		return this.contentEl;
	}

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		// @ts-expect-error
		this.codeMirror = CodeMirror(this.extContentEl);

		this.destroyOrgHelper = this.initializeOrgHelper(this.codeMirror);
		this.codeMirror.on("changes", this.changed);
	}

	// When the view is resized, refresh CodeMirror (thanks Licat!).
	onResize() {
		this.codeMirror.refresh();
	}

	changed = async () => {
		this.requestSave();
	};

	getViewData = () => {
		return this.codeMirror.getValue();
	};

	setViewData = (data: string, clear: boolean) => {
		if (clear) {
			// @ts-expect-error
			this.codeMirror.swapDoc(CodeMirror.Doc(data, "orgmode"));
		} else {
			this.codeMirror.setValue(data);
		}

		// @ts-expect-error
		if (this.app?.vault?.config?.vimMode) {
			this.codeMirror.setOption("keyMap", "vim");
		}

		// This seems to fix some odd visual bugs:
		this.codeMirror.refresh();

		// This focuses the editor, which is analogous to the
		// default Markdown behavior in Obsidian:
		this.codeMirror.focus();
	};

	clear = () => {
		this.codeMirror.setValue("");
		this.codeMirror.clearHistory();
	};

	getDisplayText() {
		if (this.file) {
			return this.file.basename;
		} else {
			return "org (No File)";
		}
	}

	canAcceptExtension(extension: string) {
		return extension === "org" || extension === "org_archive";
	}

	getViewType() {
		return "orgmode";
	}

	async onClose() {
		await super.onClose();
		this.teardownOrgHelper();
	}

	private initializeOrgHelper(editor: CodeMirror.Editor) {
		const helpers = (CodeMirror as unknown as CodeMirrorWithOrgmodeHelper)
			?.helpers;
		const orgHelper = helpers?.orgmode;
		if (orgHelper?.init) {
			const maybeDestroy = orgHelper.init(editor);
			if (typeof maybeDestroy === "function") {
				return () => {
					try {
						maybeDestroy();
					} catch (error) {
						console.error("Failed to teardown org helper", error);
					}
				};
			}
		}
		return undefined;
	}

	private teardownOrgHelper() {
		if (this.destroyOrgHelper) {
			this.destroyOrgHelper();
			this.destroyOrgHelper = undefined;
		}
	}
}
