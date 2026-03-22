import { ForbiddenException } from "@nestjs/common";
import { ERROR_CODE } from "@inffinancems/shared";
import { CsrfMiddleware } from "./csrf.middleware";

describe("CsrfMiddleware", () => {
  let middleware: CsrfMiddleware;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
    next = jest.fn();
  });

  it("should bypass safe methods", () => {
    middleware.use(
      {
        method: "GET",
        path: "/api/costs",
        headers: {},
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should bypass configured auth paths", () => {
    middleware.use(
      {
        method: "POST",
        path: "/api/auth/login",
        headers: {},
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject request when csrf token is missing", () => {
    expect(() =>
      middleware.use(
        {
          method: "POST",
          path: "/api/costs",
          headers: {
            cookie: "",
          },
        } as any,
        {} as any,
        next,
      ),
    ).toThrow(ForbiddenException);
  });

  it("should reject request when csrf token mismatches", () => {
    expect(() =>
      middleware.use(
        {
          method: "DELETE",
          path: "/api/costs/1",
          headers: {
            cookie: "csrfToken=cookie-token",
            "x-csrf-token": "header-token",
          },
        } as any,
        {} as any,
        next,
      ),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: ERROR_CODE.CSRF_TOKEN_INVALID,
        }),
      }),
    );
  });

  it("should pass request when csrf token matches", () => {
    middleware.use(
      {
        method: "PATCH",
        path: "/api/costs/1",
        headers: {
          cookie: "foo=bar; csrfToken=same-token",
          "x-csrf-token": "same-token",
        },
      } as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});
