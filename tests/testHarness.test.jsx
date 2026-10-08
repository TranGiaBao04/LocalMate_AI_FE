import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function SmokeComponent({ title = "FE-UP0 Test Harness" }) {
  return (
    <div data-testid="smoke-container">
      <h1>{title}</h1>
      <p>Harness is active and functional.</p>
    </div>
  );
}

describe("FE-UP0: Frontend Test Harness", () => {
  it("renders a trivial React component in jsdom with jest-dom matchers", () => {
    render(<SmokeComponent />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("FE-UP0 Test Harness");

    const container = screen.getByTestId("smoke-container");
    expect(container).toBeVisible();
  });
});
