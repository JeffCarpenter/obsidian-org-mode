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
        location: { pathname: "/view/sample" },
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

function loadOrgmodeModeModule() {
    jest.isolateModules(() => {
        require(path.resolve(__dirname, "../src/mode/orgmode/orgmode-mode.js"));
    });
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
});
