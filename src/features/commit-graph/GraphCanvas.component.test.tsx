import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { GraphCanvas, graphGutter } from "./GraphCanvas";
import { layout } from "./layout";

vi.mock("@/state/git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
  fetchHeadBranch: vi.fn().mockResolvedValue("main"),
}));

/** Install a mock 2D context on every HTMLCanvasElement in the test env.
 *  happy-dom returns null from `getContext("2d")`; the GraphCanvas effect
 *  bails in that case, so we patch it to return a no-op mock. */
function installMockCanvasContext(): void {
  const ctxMock = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    globalAlpha: 1,
  };
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (id: string) => unknown;
  };
  proto.getContext = function getContext(id: string) {
    if (id === "2d") return ctxMock;
    return null;
  };
  // The component reads clientWidth/clientHeight; provide non-zero sizes so
  // the `if (width === 0 || height === 0) return` guard doesn't short-circuit.
  Object.defineProperty(proto, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(proto, "clientHeight", { configurable: true, value: 400 });
}

describe("GraphCanvas", () => {
  it("renders a <canvas> element with the expected CSS class", () => {
    const lay = layout([{ hash: "c1", parents: [] }]);
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <GraphCanvas
        layout={lay}
        selectedHash={null}
        hasWorkingRow={false}
        workingSelected={false}
        scrollRef={scrollRef}
        graphBand={graphGutter(lay.maxLane)}
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    // pointerEvents: none so the canvas never blocks clicks on the rows beneath.
    expect(canvas?.style.pointerEvents).toBe("none");
  });

  it("runs the draw effect when getContext returns a context (mocked)", () => {
    installMockCanvasContext();
    const lay = layout([{ hash: "c1", parents: [] }]);
    const scrollRef = createRef<HTMLDivElement>();
    // The component will not throw when the draw effect runs.
    expect(() =>
      render(
        <GraphCanvas
          layout={lay}
          selectedHash="c1"
          hasWorkingRow
          workingSelected
          scrollRef={scrollRef}
          graphBand={graphGutter(lay.maxLane)}
        />,
      ),
    ).not.toThrow();
  });

  it("renders without crashing when given a single-commit layout and a working row", () => {
    const lay = layout([{ hash: "c1", parents: [] }]);
    const scrollRef = createRef<HTMLDivElement>();
    expect(() =>
      render(
        <GraphCanvas
          layout={lay}
          selectedHash="c1"
          hasWorkingRow
          workingSelected
          scrollRef={scrollRef}
          graphBand={graphGutter(lay.maxLane)}
        />,
      ),
    ).not.toThrow();
  });
});
