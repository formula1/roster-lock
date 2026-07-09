import { describe, it, expect, vi } from "vitest";
import { ErrorObject } from "ajv";
import { formatError, withErrorHandling } from "../../src/lib/errors";

describe("formatError", () => {
  it("formats a plain Error by its message", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
  });

  it("formats an array of AJV ErrorObjects, one per line", () => {
    const errors: Array<ErrorObject> = [
      { instancePath: "/foo", schemaPath: "", keyword: "type", message: "must be string", params: {} },
      { instancePath: "", schemaPath: "", keyword: "required", message: "must have required property 'bar'", params: {} },
    ];
    expect(formatError(errors)).toBe(
      "/foo must be string\n/ must have required property 'bar'"
    );
  });

  it("stringifies anything else", () => {
    expect(formatError("plain string")).toBe("plain string");
    expect(formatError(42)).toBe("42");
  });
});

describe("withErrorHandling", () => {
  it("runs the wrapped function and does not touch exitCode on success", async () => {
    process.exitCode = undefined;
    const fn = vi.fn(async (x: number) => { void x; });
    await withErrorHandling(fn)(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(process.exitCode).toBeUndefined();
  });

  it("logs the formatted error and sets exitCode to 1 on failure", async () => {
    process.exitCode = undefined;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = async () => { throw new Error("nope"); };

    await withErrorHandling(fn)();

    expect(errorSpy).toHaveBeenCalledWith("nope");
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });
});
