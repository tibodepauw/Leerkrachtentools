import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));

// Exercise the component's event handlers without a DOM or browser dependency.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) {
      state.values[index] = typeof initial === "function" ? initial() : initial;
    }
    return [state.values[index], (value: unknown) => { state.values[index] = value; }];
  },
}));
vi.mock("@/hooks/useAppReady", () => ({ useClientMounted: () => true }));
vi.mock("@/components/shared/LoadingGate", () => ({ LoadingGate: () => null }));
vi.mock("@/components/shared/GlowWordmark", () => ({ GlowWordmark: () => null }));
vi.mock("@/lib/storage/sharedDevice", () => ({
  isSharedDevice: () => false,
  setSharedDevice: vi.fn(),
}));

type Element = ReactElement<Record<string, unknown>>;

function renderContent(): Element {
  state.cursor = 0;
  const gate = AuthScreen();
  const content = gate.props.children;
  return content.type();
}

function find(tree: Element, predicate: (node: Element) => boolean): Element {
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop()!;
    if (predicate(node)) return node;
    for (const child of Children.toArray(node.props.children as ReactNode)) {
      if (isValidElement<Record<string, unknown>>(child)) pending.push(child);
    }
  }
  throw new Error("Expected element was not found");
}

function changeEmail(tree: Element, email: string) {
  const input = find(tree, (node) => node.props.id === "email");
  if (input.props.disabled) return;
  (input.props.onChange as (event: unknown) => void)({ target: { value: email } });
}

function submit(tree: Element): Promise<void> {
  const form = find(tree, (node) => node.type === "form");
  return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}

describe("AuthScreen e-mail tijdens codeaanvraag", () => {
  beforeEach(() => {
    state.values = [];
    state.cursor = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("houdt de ontvanger vast terwijl de aanvraag nog loopt", async () => {
    let finishRequest!: (value: Response) => void;
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise<Response>((resolve) => { finishRequest = resolve; }))
      .mockResolvedValueOnce(Response.json({ error: "Ongeldige code." }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    changeEmail(renderContent(), "eerste@school.be");
    const pending = submit(renderContent());
    const waiting = renderContent();
    expect(find(waiting, (node) => node.props.id === "email").props.disabled).toBe(true);
    changeEmail(waiting, "tweede@school.be");

    finishRequest(Response.json({}));
    await pending;
    const codeScreen = renderContent();
    expect(JSON.stringify(codeScreen)).toContain("eerste@school.be");
    expect(JSON.stringify(codeScreen)).not.toContain("tweede@school.be");
    const codeInput = find(codeScreen, (node) => node.props.id === "code");
    (codeInput.props.onChange as (value: string) => void)("123456");
    await submit(renderContent());

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe("eerste@school.be");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: "eerste@school.be", code: "123456",
    });
  });

  it("maakt het adres opnieuw wijzigbaar na een mislukte aanvraag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Probeer opnieuw." }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    changeEmail(renderContent(), "eerste@school.be");
    await submit(renderContent());
    const failed = renderContent();
    expect(find(failed, (node) => node.props.id === "email").props.disabled).toBe(false);
    expect(JSON.stringify(failed)).toContain("Probeer opnieuw.");

    changeEmail(failed, "tweede@school.be");
    await submit(renderContent());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).email).toBe("tweede@school.be");
  });
});
