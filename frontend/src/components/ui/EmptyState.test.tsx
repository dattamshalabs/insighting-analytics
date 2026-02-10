import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No data available" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <EmptyState
        title="No data"
        description="Try adding some data to get started."
      />
    );
    expect(screen.getByText("Try adding some data to get started.")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        title="No data"
        action={<button>Add Data</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Add Data" })).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <EmptyState
        title="No data"
        icon={<span data-testid="test-icon">Icon</span>}
      />
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});
