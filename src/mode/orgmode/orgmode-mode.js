const {
	cycleCheckboxState,
	dirname,
	pathBuilder,
	parseSeqTodoFromLines,
} = require("./orgmode-utils");

((mod) => {
	if (typeof exports === "object" && typeof module === "object")
		mod(require("../../lib/codemirror"));
	else if (typeof define === "function" && define.amd)
		define(["../../lib/codemirror"], mod);
	else mod(CodeMirror);
})(function (CodeMirror) {
	const DEFAULT_TODO_KEYWORDS = ["TODO", "DOING", "WAITING", "NEXT", "PENDING"];
	const DEFAULT_DONE_KEYWORDS = [
		"DONE",
		"CANCELLED",
		"CANCELED",
		"DEFERRED",
		"REJECTED",
		"STOP",
		"STOPPED",
	];

	CodeMirror.defineSimpleMode("orgmode", {
		start: [
			{
				regex:
					/(\*\s)(TODO|DOING|WAITING|NEXT|PENDING|)(CANCELLED|CANCELED|CANCEL|DONE|REJECTED|STOP|STOPPED|)(\s+\[#[A-C]\]\s+|)(.*?)(?:(\s{10,}|))(:[\S]+:|)$/,
				sol: true,
				token: [
					"header level1 org-level-star",
					"header level1 org-todo",
					"header level1 org-done",
					"header level1 org-priority",
					"header level1",
					"header level1 void",
					"header level1 comment",
				],
			},
			{
				regex:
					/(\*{1,}\s)(TODO|DOING|WAITING|NEXT|PENDING|)(CANCELLED|CANCELED|CANCEL|DEFERRED|DONE|REJECTED|STOP|STOPPED|)(\s+\[#[A-C]\]\s+|)(.*?)(?:(\s{10,}|))(:[\S]+:|)$/,
				sol: true,
				token: [
					"header org-level-star",
					"header org-todo",
					"header org-done",
					"header org-priority",
					"header",
					"header void",
					"header comment",
				],
			},
			{ regex: /(\+[^+]+\+)/, token: ["strikethrough"] },
			{ regex: /(\*[^*]+\*)/, token: ["strong"] },
			{ regex: /(\/[^/]+\/)/, token: ["em"] },
			{ regex: /(_[^_]+_)/, token: ["link"] },
			{ regex: /(~[^~]+~)/, token: ["comment"] },
			{ regex: /(=[^=]+=)/, token: ["comment"] },
			{ regex: /\[\[[^[\]]+\]\[[^[\]]+\]\]/, token: "org-url" }, // links
			{ regex: /\[\[[^[\]]+\]\]/, token: "org-image" }, // image
			{ regex: /\[[xX\s\-_]\]/, token: "qualifier org-toggle" }, // checkbox
			{
				regex: /#\+(?:(BEGIN|begin))_[a-zA-Z]*/,
				token: "comment",
				next: "env",
				sol: true,
			}, // comments
			{ regex: /:?[A-Z_]+:.*/, token: "comment", sol: true }, // property drawers
			{
				regex: /(#\+[a-zA-Z_]*)(:.*)/,
				token: ["keyword", "qualifier"],
				sol: true,
			}, // environments
			{
				regex: /(CLOCK:|SHEDULED:|DEADLINE:)(\s.+)/,
				token: ["comment", "keyword"],
			},
		],
		env: [
			{
				regex: /#\+(?:(END|end))_[a-zA-Z]*/,
				token: "comment",
				next: "start",
				sol: true,
			},
			{ regex: /.*/, token: "comment" },
		],
	});

	CodeMirror.registerHelper("fold", "orgmode", (cm, start) => {
		// init
		const levelToMatch = headerLevel(start.line);

		// no folding needed
		if (levelToMatch === null) return;

		// find folding limits
		const lastLine = cm.lastLine();
		let end = start.line;
		while (end < lastLine) {
			end += 1;
			const level = headerLevel(end);
			if (level && level <= levelToMatch) {
				end = end - 1;
				break;
			}
		}

		return {
			from: CodeMirror.Pos(start.line, cm.getLine(start.line).length),
			to: CodeMirror.Pos(end, cm.getLine(end).length),
		};

		function headerLevel(lineNo) {
			var line = cm.getLine(lineNo);
			var match = /^\*+/.exec(line);
			if (
				match &&
				match.length === 1 &&
				/header/.test(cm.getTokenTypeAt(CodeMirror.Pos(lineNo, 0)))
			) {
				return match[0].length;
			}
			return null;
		}
	});
	CodeMirror.registerGlobalHelper(
		"fold",
		"drawer",
		(mode) => mode.name === "orgmode",
		(cm, start) => {
			const drawer = isBeginningOfADrawer(start.line);
			if (drawer === false) return;

			// find folding limits
			const lastLine = cm.lastLine();
			let end = start.line;
			while (end < lastLine) {
				end += 1;
				if (isEndOfADrawer(end)) {
					break;
				}
			}

			return {
				from: CodeMirror.Pos(start.line, cm.getLine(start.line).length),
				to: CodeMirror.Pos(end, cm.getLine(end).length),
			};

			function isBeginningOfADrawer(lineNo) {
				var line = cm.getLine(lineNo);
				var match = /^:.*:$/.exec(line);
				if (match && match.length === 1 && match[0] !== ":END:") {
					return true;
				}
				return false;
			}
			function isEndOfADrawer(lineNo) {
				var line = cm.getLine(lineNo);
				return line.trim() === ":END:";
			}
		},
	);

	CodeMirror.registerHelper("orgmode", "init", (editor, fn) => {
		const registerHelperCallback = typeof fn === "function" ? fn : () => {};
		editor.setOption("extraKeys", {
			Tab: (cm) => {
				org_cycle(cm);
			},
			"Shift-Tab": (cm) => {
				org_shifttab(cm);
			},
			"Alt-Left": (cm) => {
				org_metaleft(cm);
			},
			"Alt-Right": (cm) => {
				org_metaright(cm);
			},
			"Alt-Enter": (cm) => {
				org_meta_return(cm);
			},
			"Alt-Up": (cm) => {
				org_metaup(cm);
			},
			"Alt-Down": (cm) => {
				org_metadown(cm);
			},
			"Shift-Alt-Left": (cm) => {
				org_shiftmetaleft(cm);
			},
			"Shift-Alt-Right": (cm) => {
				org_shiftmetaright(cm);
			},
			"Shift-Alt-Enter": (cm) => {
				org_insert_todo_heading(cm);
			},
			"Shift-Left": (cm) => {
				org_shiftleft(cm);
			},
			"Shift-Right": (cm) => {
				org_shiftright(cm);
			},
		});
		registerHelperCallback("shifttab", () => {
			org_shifttab(editor);
		});

		editor.on("mousedown", toggleHandler);
		editor.on("touchstart", toggleHandler);
		editor.on("gutterClick", foldLine);

		// fold everything except headers by default
		editor.operation(() => {
			for (let i = 0; i < editor.lineCount(); i++) {
				if (
					/header/.test(editor.getTokenTypeAt(CodeMirror.Pos(i, 0))) === false
				) {
					fold(editor, CodeMirror.Pos(i, 0));
				}
			}
		});
		return CodeMirror.orgmode.destroy.bind(this, editor);
	});

	CodeMirror.registerHelper("orgmode", "destroy", (editor) => {
		editor.off("mousedown", toggleHandler);
		editor.off("touchstart", toggleHandler);
		editor.off("gutterClick", foldLine);
	});

	function foldLine(cm, line) {
		const cursor = { line: line, ch: 0 };
		isFold(cm, cursor) ? unfold(cm, cursor) : fold(cm, cursor);
	}

function toggleHandler(cm, e) {
	const widgets = cm.__orgmodeWidgets || (cm.__orgmodeWidgets = new Set());
	const position = cm.coordsChar(
				{
					left: e.clientX || e.targetTouches?.[0].clientX,
					top: e.clientY || e.targetTouches?.[0].clientY,
				},
				"page",
			),
			token = cm.getTokenAt(position);

		_disableSelection();
		if (/org-level-star/.test(token.type)) {
			_preventIfShould();
			_foldHeadline();
			_disableSelection();
		} else if (/org-toggle/.test(token.type)) {
			_preventIfShould();
			_toggleCheckbox();
			_disableSelection();
		} else if (/org-todo/.test(token.type)) {
			_preventIfShould();
			_toggleTodo();
			_disableSelection();
		} else if (/org-done/.test(token.type)) {
			_preventIfShould();
			_toggleDone();
			_disableSelection();
		} else if (/org-priority/.test(token.type)) {
			_preventIfShould();
			_togglePriority();
			_disableSelection();
		} else if (/org-url/.test(token.type)) {
			_disableSelection();
			_navigateLink();
		} else if (/org-image/.test(token.type)) {
			_disableSelection();
			_toggleImageWidget();
		}

		function _preventIfShould() {
			if ("ontouchstart" in window) e.preventDefault();
		}
		function _disableSelection() {
			cm.on("beforeSelectionChange", _onSelectionChangeHandler);
			function _onSelectionChangeHandler(cm, obj) {
				obj.update([
					{
						anchor: position,
						head: position,
					},
				]);
				cm.off("beforeSelectionChange", _onSelectionChangeHandler);
			}
		}

		function _foldHeadline() {
			const line = position.line;
			if (line >= 0) {
				const cursor = { line: line, ch: 0 };
				isFold(cm, cursor) ? unfold(cm, cursor) : fold(cm, cursor);
			}
		}

		function _toggleCheckbox() {
			const line = position.line;
			const current = cm.getRange(
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
			const next = cycleCheckboxState(current);
			cm.replaceRange(
				next,
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
		}

		function _toggleTodo() {
			const line = position.line;
			const keyword = cm.getRange(
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
			const config = getTodoConfig(cm);
			const next = cycleKeyword(keyword, config.todo);
			if (next) {
				cm.replaceRange(
					next,
					{ line: line, ch: token.start },
					{ line: line, ch: token.end },
				);
			}
		}

		function _toggleDone() {
			const line = position.line;
			const keyword = cm.getRange(
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
			const config = getTodoConfig(cm);
			const next = cycleKeyword(keyword, config.done);
			if (next) {
				cm.replaceRange(
					next,
					{ line: line, ch: token.start },
					{ line: line, ch: token.end },
				);
			}
		}

		function _togglePriority() {
			const PRIORITIES = [" [#A] ", " [#B] ", " [#C] ", " [#A] "];
			const line = position.line;
			const content = cm.getRange(
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
			const new_content = PRIORITIES[PRIORITIES.indexOf(content) + 1];
			cm.replaceRange(
				new_content,
				{ line: line, ch: token.start },
				{ line: line, ch: token.end },
			);
		}

		function _toggleImageWidget() {
			const exist = widgets.has(position.line);

			if (exist === false) {
				if (!token.string.match(/\[\[(.*)\]\]/)) return null;
				const $node = _buildImage(RegExp.$1);
				const widget = cm.addLineWidget(position.line, $node, {
					coverGutter: false,
				});
				widgets.add(position.line);
				$node.addEventListener("click", closeWidget);

				function closeWidget() {
					widget.clear();
					$node.removeEventListener("click", closeWidget);
					widgets.delete(position.line);
				}
			}
			function _buildImage(src) {
				const $el = document.createElement("div");
				const $img = document.createElement("img");

				if (/^https?:\/\//.test(src)) {
					$img.src = src;
				} else {
					const root_path = dirname(
						window.location.pathname.replace(/^\/view/, ""),
					);
					const img_path = src;
					$img.src =
						"/api/files/cat?path=" +
						encodeURIComponent(pathBuilder(root_path, img_path));
				}
				$el.appendChild($img);
				return $el;
			}
			return null;
		}

		function _navigateLink() {
			const match = token.string.match(/\[\[(.*?)\]\[/);
			const link = match && match[1];
			if (!link) return;

			if (/^https?:\/\//.test(link)) {
				window.open(link);
			} else {
				const root_path = dirname(
					window.location.pathname.replace(/^\/view/, ""),
				);
				const link_path = link;
				window.open(`/view${pathBuilder(root_path, link_path)}`);
			}
		}
	}

	function org_cycle(cm) {
		if (toggleHeadingFold(cm) === false) {
			execDefaultTab(cm);
		}
	}

	function org_shifttab(cm) {
		if (!cm || typeof cm.lineCount !== "function") return;
		const collapse = !cm.state.orgmodeHasCollapsedAll;
		cm.operation(() => {
			for (let i = 0; i < cm.lineCount(); i++) {
				if (isHeaderLine(cm, i)) {
					collapse
						? fold(cm, { line: i, ch: 0 })
						: unfold(cm, { line: i, ch: 0 });
				}
			}
		});
		cm.state.orgmodeHasCollapsedAll = collapse;
	}

	function org_metaleft(cm) {
		execCommand(cm, "indentLess");
	}

	function org_metaright(cm) {
		execCommand(cm, "indentMore");
	}

	function org_meta_return(cm) {
		execCommand(cm, "newlineAndIndent");
	}

	function org_metaup(cm) {
		execCommand(cm, "swapLineUp");
	}

	function org_metadown(cm) {
		execCommand(cm, "swapLineDown");
	}

	function org_shiftmetaleft(cm) {
		execCommand(cm, "indentLess");
	}

	function org_shiftmetaright(cm) {
		execCommand(cm, "indentMore");
	}

	function org_insert_todo_heading(cm) {
		if (!cm) return;
		const cursor = cm.getCursor();
		const level = getHeadingLevel(cm, cursor.line) || 1;
		const stars = new Array(level + 1).join("*");
		const heading = `${stars} TODO `;
		const insertion = `\n${heading}`;
		cm.replaceRange(insertion, cursor);
		cm.setCursor({ line: cursor.line + 1, ch: heading.length });
	}

	function org_shiftleft(cm) {
		execCommand(cm, "indentLess");
	}

	function org_shiftright(cm) {
		execCommand(cm, "indentMore");
	}

	function toggleHeadingFold(cm) {
		if (!cm) return false;
		const cursor = cm.getCursor();
		const line = cursor.line;
		if (isHeaderLine(cm, line) === false) return false;
		const pos = { line: line, ch: 0 };
		if (isFold(cm, pos)) {
			unfold(cm, pos);
		} else {
			fold(cm, pos);
		}
		return true;
	}

	function execDefaultTab(cm) {
		if (!cm) return;
		if (cm.execCommand) {
			cm.execCommand("defaultTab");
		} else {
			cm.replaceSelection("\t");
		}
	}

	function execCommand(cm, command, fallback) {
		if (!cm) return;
		if (CodeMirror.commands?.[command]) {
			CodeMirror.commands[command](cm);
		} else if (typeof fallback === "function") {
			fallback();
		}
	}

	function getHeadingLevel(cm, line) {
		if (line == null || line < 0 || line >= cm.lineCount()) return null;
		const text = cm.getLine(line);
		const match = text?.match(/^(\*+)/);
		if (match) return match[1].length;
		return null;
	}

	function isHeaderLine(cm, line) {
		if (line == null || line < 0 || line >= cm.lineCount()) return false;
		const tokenType = cm.getTokenTypeAt(CodeMirror.Pos(line, 0)) || "";
		return /header/.test(tokenType);
	}

	function normalizeCursor(cursor) {
		if (cursor == null) return CodeMirror.Pos(0, 0);
		if (typeof cursor.line === "number") {
			return CodeMirror.Pos(cursor.line, cursor.ch || 0);
		}
		if (typeof cursor === "number") {
			return CodeMirror.Pos(cursor, 0);
		}
		return CodeMirror.Pos(0, 0);
	}

	function hasFoldSupport(cm) {
		return !!(cm && typeof cm.foldCode === "function");
	}

	function fold(cm, cursor) {
		if (!hasFoldSupport(cm)) return;
		const pos = normalizeCursor(cursor);
		cm.foldCode(pos, null, "fold");
	}

	function unfold(cm, cursor) {
		if (!hasFoldSupport(cm)) return;
		const pos = normalizeCursor(cursor);
		cm.foldCode(pos, null, "unfold");
	}

	function isFold(cm, cursor) {
		if (!cm || typeof cm.findMarksAt !== "function") return false;
		const pos = normalizeCursor(cursor);
		const marks = cm.findMarksAt(pos) || [];
		for (let i = 0; i < marks.length; i++) {
			if (marks[i].__isFold) {
				return true;
			}
		}
		return false;
	}

	function cycleKeyword(current, list) {
		if (!list || list.length === 0) return current;
		const idx = list.indexOf(current);
		if (idx === -1) {
			return list[0];
		}
		const nextIndex = (idx + 1) % list.length;
		return list[nextIndex];
	}

	function getTodoConfig(cm) {
		return (
			parseSeqTodo(cm) || {
				todo: DEFAULT_TODO_KEYWORDS.slice(0),
				done: DEFAULT_DONE_KEYWORDS.slice(0),
			}
		);
	}

	function parseSeqTodo(cm) {
		if (!cm || typeof cm.lineCount !== "function") return null;
		const lines = [];
		for (let i = 0; i < cm.lineCount(); i++) {
			lines.push(cm.getLine(i));
		}
		return parseSeqTodoFromLines(lines, DEFAULT_TODO_KEYWORDS, DEFAULT_DONE_KEYWORDS);
	}

	if (typeof module === "object" && typeof module.exports === "object") {
		module.exports.__orgmodeTesting = {
			cycleKeyword,
			getTodoConfig,
			parseSeqTodo,
			toggleHandler,
			foldLine,
			org_insert_todo_heading,
		};
	}

	CodeMirror.defineMIME("text/org", "org");
});
