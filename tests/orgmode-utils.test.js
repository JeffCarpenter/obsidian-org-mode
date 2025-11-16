const utils = require("../src/mode/orgmode/orgmode-utils.js");

describe("orgmode utility helpers", () => {
    describe("cycleCheckboxState", () => {
        test("cycles through standard states", () => {
            expect(utils.cycleCheckboxState("[ ]")).toBe("[X]");
            expect(utils.cycleCheckboxState("[X]")).toBe("[-]");
            expect(utils.cycleCheckboxState("[-]")).toBe("[ ]");
        });

        test("preserves lowercase x when cycling", () => {
            expect(utils.cycleCheckboxState("[x]")).toBe("[-]");
        });
    });

    describe("path helpers", () => {
        test("dirname trims trailing segments", () => {
            expect(utils.dirname("/root/child/file")).toBe("/root/child");
            expect(utils.dirname("/")).toBe("/");
        });

        test("pathBuilder resolves relative paths", () => {
            expect(utils.pathBuilder("/root", "child/file")).toBe("/root/child/file");
            expect(utils.pathBuilder("/root/child", "../other")).toBe("/root/other");
        });
    });

    describe("parseSeqTodoFromLines", () => {
        test("parses SEQ_TODO specification", () => {
            const lines = [
                "#+SEQ_TODO: TODO STARTED WAITING | DONE CANCELLED"
            ];
            const parsed = utils.parseSeqTodoFromLines(lines, ["TODO"], ["DONE"]);
            expect(parsed).toEqual({
                todo: ["TODO", "STARTED", "WAITING"],
                done: ["DONE", "CANCELLED"],
            });
        });

        test("returns defaults when sections missing", () => {
            const lines = ["#+SEQ_TODO: |" ];
            const parsed = utils.parseSeqTodoFromLines(lines, ["A"], ["B"]);
            expect(parsed).toEqual({ todo: ["A"], done: ["B"] });
        });
    });
});
