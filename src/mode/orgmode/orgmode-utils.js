(function (factory) {
	if (typeof module === "object" && typeof module.exports === "object") {
		module.exports = factory();
	} else {
		const exports = factory();
		Object.assign((window.OrgModeUtils = window.OrgModeUtils || {}), exports);
	}
})(function () {
	function cycleCheckboxState(value) {
		const normalized = (value || "").toUpperCase();
		const order = ["[ ]", "[X]", "[-]"];
		const index = order.indexOf(normalized);
		if (index === -1) {
			return "[X]";
		}
		const next = order[(index + 1) % order.length];
		if (value && value.charAt(1) === "x" && next === "[X]") {
			return "[x]";
		}
		return next;
	}

	function dirname(pathname) {
		if (typeof pathname !== "string" || pathname.length === 0) return "/";
		let normalized = pathname.replace(/\\/g, "/");
		normalized = normalized.replace(/\/+$/, "");
		if (normalized === "") return "/";
		const idx = normalized.lastIndexOf("/");
		if (idx <= 0) return "/";
		return normalized.slice(0, idx);
	}

	function pathBuilder(root, relative) {
		const stack = [];
		function pushParts(parts) {
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				if (!part || part === ".") continue;
				if (part === "..") {
					if (stack.length) stack.pop();
				} else {
					stack.push(part);
				}
			}
		}
		const base = (root || "").replace(/\\/g, "/").split("/");
		const rel = (relative || "").replace(/\\/g, "/").split("/");
		pushParts(base);
		pushParts(rel);
		return "/" + stack.join("/");
	}

	function extractKeywords(section) {
		if (!section) return [];
		return section
			.trim()
			.split(/\s+/)
			.map((word) => word.replace(/\(.*?\)/g, "").trim())
			.filter(Boolean);
	}

	function uniquePreserveOrder(list) {
		const seen = {};
		const result = [];
		for (let i = 0; i < list.length; i++) {
			const key = list[i];
			if (!seen[key]) {
				seen[key] = true;
				result.push(key);
			}
		}
		return result;
	}

	function parseSeqTodoFromLines(lines, defaultTodo, defaultDone) {
		if (!Array.isArray(lines)) return null;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line || line.charAt(0) !== "#") continue;
			const match = line.match(/^\s*#\+SEQ_TODO:\s*(.+)$/i);
			if (!match) continue;
			const spec = match[1];
			const sections = spec.split("|");
			let undone = extractKeywords(sections[0]);
			let done = [];
			for (let s = 1; s < sections.length; s++) {
				done = done.concat(extractKeywords(sections[s]));
			}
			if (done.length === 0) done = (defaultDone || []).slice(0);
			if (undone.length === 0) undone = (defaultTodo || []).slice(0);
			return { todo: uniquePreserveOrder(undone), done: uniquePreserveOrder(done) };
		}
		return null;
	}

	return {
		cycleCheckboxState,
		dirname,
		pathBuilder,
		parseSeqTodoFromLines,
		extractKeywords,
		uniquePreserveOrder,
	};
});
