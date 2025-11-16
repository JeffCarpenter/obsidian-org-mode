const path = require("path");

function createCodeMirrorStub() {
    const factory = jest.fn(() => ({
        on: jest.fn(),
        refresh: jest.fn(),
        setValue: jest.fn(),
        getValue: jest.fn().mockReturnValue(""),
        swapDoc: jest.fn(),
        setOption: jest.fn(),
        focus: jest.fn(),
        clearHistory: jest.fn(),
    }));

    factory.defineSimpleMode = jest.fn();
    factory.defineMode = jest.fn();
    factory.simpleMode = jest.fn();
    factory.registerHelper = jest.fn();
    factory.registerGlobalHelper = jest.fn();
    factory.defineMIME = jest.fn();
    factory.Pos = (line, ch) => ({ line, ch });
    factory.copyState = jest.fn();
    factory.startState = jest.fn();
    factory.getMode = jest.fn();
    factory.orgmode = { destroy: jest.fn() };
    factory.helpers = {};
    factory.commands = {};

    return factory;
}

function installGlobals() {
    global.window = {
        location: { pathname: "/view/root/note" },
        open: jest.fn(),
    };
    global.document = {
        createElement: () => ({
            appendChild() {},
            addEventListener() {},
            removeEventListener() {},
            style: {},
        }),
    };
}

function cleanupGlobals() {
    delete global.window;
    delete global.document;
    delete global.CodeMirror;
}

function createCmForToken(token, overrides = {}) {
    const updateMock = jest.fn();
    const base = {
        coordsChar: jest.fn(() => ({ line: token.line ?? 0, ch: token.start ?? 0 })),
        getTokenAt: jest.fn(() => token),
        on: jest.fn((event, handler) => {
            if (event === "beforeSelectionChange") {
                handler(base, { update: updateMock });
            }
        }),
        off: jest.fn(),
        getRange: jest.fn().mockReturnValue(token.string || ""),
        replaceRange: jest.fn(),
        getCursor: jest.fn().mockReturnValue({ line: 0 }),
        findMarksAt: jest.fn().mockReturnValue([]),
        foldCode: jest.fn(),
        state: {},
        lineCount: () => 0,
        getLine: jest.fn().mockReturnValue(""),
        addLineWidget: jest.fn(() => ({ clear: jest.fn() })),
        addEventListener: jest.fn(),
    };
    return Object.assign(base, overrides, { __updateMock: updateMock });
}

function loadOrgmodeModeModule() {
    let exportsValue;
    jest.isolateModules(() => {
        exportsValue = require(path.resolve(__dirname, "../src/mode/orgmode/orgmode-mode.js"));
    });
    return exportsValue || {};
}

describe("orgmode CodeMirror integration", () => {
    let codeMirrorStub;

    beforeEach(() => {
        jest.resetModules();
        installGlobals();
        codeMirrorStub = createCodeMirrorStub();
        global.CodeMirror = codeMirrorStub;
    });

    afterEach(() => {
        cleanupGlobals();
    });

    test("orgmode-mode registers helpers without throwing", () => {
        expect(() => {
            loadOrgmodeModeModule();
        }).not.toThrow();

        expect(codeMirrorStub.registerHelper).toHaveBeenCalledWith(
            "orgmode",
            "init",
            expect.any(Function),
        );
    });

    test("orgmode-fold registers folding helpers", () => {
        expect(() => {
            jest.isolateModules(() => {
                require(path.resolve(__dirname, "../src/mode/orgmode/orgmode-fold.js"));
            });
        }).not.toThrow();

        expect(codeMirrorStub.registerHelper).toHaveBeenCalledWith(
            "fold",
            "orgmode",
            expect.any(Function),
        );
    });

    test("orgmode init helper installs key bindings and returns teardown", () => {
        loadOrgmodeModeModule();
        const initCall = codeMirrorStub.registerHelper.mock.calls.find(
            ([scope, helper]) => scope === "orgmode" && helper === "init",
        );
        expect(initCall).toBeDefined();
        const initFn = initCall[2];

        const editorStub = {
            setOption: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            operation: (fn) => fn(),
            lineCount: () => 0,
            getTokenTypeAt: jest.fn().mockReturnValue("text"),
        };

        const teardown = initFn(editorStub, jest.fn());
        expect(editorStub.setOption).toHaveBeenCalledWith(
            "extraKeys",
            expect.objectContaining({
                Tab: expect.any(Function),
                "Shift-Tab": expect.any(Function),
            }),
        );
        expect(typeof teardown).toBe("function");

        const extraKeys = editorStub.setOption.mock.calls[0][1];
        const cmInstance = {
            getCursor: () => ({ line: 0 }),
            getTokenTypeAt: jest.fn().mockReturnValue("header"),
            findMarksAt: jest.fn().mockReturnValue([]),
            foldCode: jest.fn(),
            state: {},
            lineCount: () => 1,
            operation: (fn) => fn(),
        };

        extraKeys.Tab(cmInstance);
        expect(cmInstance.foldCode).toHaveBeenCalledWith(
            { line: 0, ch: 0 },
            null,
            "fold",
        );

        extraKeys["Shift-Tab"](cmInstance);
        expect(cmInstance.state.orgmodeHasCollapsedAll).toBe(true);
    });

    test("orgmode fold helper computes range for headings", () => {
        loadOrgmodeModeModule();
        const foldCall = codeMirrorStub.registerHelper.mock.calls.find(
            ([scope, helper]) => scope === "fold" && helper === "orgmode",
        );
        expect(foldCall).toBeDefined();
        const foldFn = foldCall[2];
        const cm = {
            getLine: jest
                .fn()
                .mockImplementation((line) =>
                    line === 0 ? "* Heading" : line === 1 ? "Body" : "* Next",
                ),
            getTokenTypeAt: jest.fn((pos) => (pos.line === 0 ? "header" : "text")),
            lastLine: jest.fn().mockReturnValue(1),
        };

        const range = foldFn(cm, { line: 0 });
        expect(range).toEqual({
            from: { line: 0, ch: "* Heading".length },
            to: { line: 1, ch: "Body".length },
        });
    });

    test("cycleKeyword helper rotates entries", () => {
        const mod = loadOrgmodeModeModule();
        const helpers = mod.__orgmodeTesting;
        expect(helpers.cycleKeyword("A", ["A", "B", "C"])).toBe("B");
        expect(helpers.cycleKeyword("C", ["A", "B", "C"])).toBe("A");
    });

    test("getTodoConfig returns parsed keyword sets", () => {
        const mod = loadOrgmodeModeModule();
        const helpers = mod.__orgmodeTesting;
        const cm = {
            lineCount: () => 1,
            getLine: () => "#+SEQ_TODO: TODO NEXT | DONE",
        };
        const config = helpers.getTodoConfig(cm);
        expect(config).toEqual({
            todo: ["TODO", "NEXT"],
            done: ["DONE"],
        });
    });

    test("toggleHandler toggles checkbox and prevents selection", () => {
        const mod = loadOrgmodeModeModule();
        const { toggleHandler } = mod.__orgmodeTesting;

        const cm = createCmForToken({
            type: "org-toggle",
            start: 0,
            end: 3,
            string: "[ ]",
        });

        toggleHandler(cm, { clientX: 5, clientY: 6 });
        expect(cm.replaceRange).toHaveBeenCalledWith(
            "[X]",
            { line: 0, ch: 0 },
            { line: 0, ch: 3 },
        );
        expect(cm.__updateMock).toHaveBeenCalled();
    });

    test("toggleHandler opens relative link when clicking org-url", () => {
        const mod = loadOrgmodeModeModule();
        const { toggleHandler } = mod.__orgmodeTesting;
        const cm = createCmForToken({
            type: "org-url",
            start: 0,
            end: 5,
            string: "[[/next][Label]]",
        });

        toggleHandler(cm, { clientX: 1, clientY: 1 });
        expect(global.window.open).toHaveBeenCalledWith("/view/root/next");
    });

    test("toggleHandler cycles TODO and DONE keywords", () => {
        const mod = loadOrgmodeModeModule();
        const { toggleHandler } = mod.__orgmodeTesting;
        const todoCm = createCmForToken({
            type: "org-todo",
            start: 0,
            end: 4,
            string: "TODO",
        });
        toggleHandler(todoCm, { clientX: 2, clientY: 2 });
        expect(todoCm.replaceRange).toHaveBeenCalledWith(
            "DOING",
            { line: 0, ch: 0 },
            { line: 0, ch: 4 },
        );

        const doneCm = createCmForToken({
            type: "org-done",
            start: 0,
            end: 4,
            string: "DONE",
        });
        toggleHandler(doneCm, { clientX: 3, clientY: 3 });
        expect(doneCm.replaceRange).toHaveBeenCalledWith(
            "CANCELLED",
            { line: 0, ch: 0 },
            { line: 0, ch: 4 },
        );
    });

    test("toggleHandler advances priority tokens", () => {
        const mod = loadOrgmodeModeModule();
        const { toggleHandler } = mod.__orgmodeTesting;
        const cm = createCmForToken({
            type: "org-priority",
            start: 0,
            end: 6,
            string: " [#A] ",
        });
        toggleHandler(cm, { clientX: 4, clientY: 4 });
        expect(cm.replaceRange).toHaveBeenCalledWith(
            " [#B] ",
            { line: 0, ch: 0 },
            { line: 0, ch: 6 },
        );
    });
});
