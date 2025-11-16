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
            jest.isolateModules(() => {
                require(path.resolve(__dirname, "../src/mode/orgmode/orgmode-mode.js"));
            });
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
});
