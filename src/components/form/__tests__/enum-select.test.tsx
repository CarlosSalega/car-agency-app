// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnumSelect } from "../enum-select";

/**
 * The trigger must read like the popup, not like the database.
 *
 * Base UI renders the raw `value` inside `Select.Value` unless the root is given
 * `items`, so an enum select whose options are translated showed "NEGOTIATING"
 * in the trigger while the list said "En negociación". Same control, two
 * languages.
 */

const options = [
  { value: "NEW", label: "Nueva" },
  { value: "NEGOTIATING", label: "En negociación" },
] as const;

function renderSelect(value: "NEW" | "NEGOTIATING") {
  return render(
    <EnumSelect value={value} onValueChange={() => {}} options={options} />,
  );
}

describe("EnumSelect", () => {
  it("shows the label of the selected option, not its stored value", () => {
    renderSelect("NEGOTIATING");

    const trigger = screen.getByRole("combobox");

    expect(trigger.textContent).toContain("En negociación");
    expect(trigger.textContent).not.toContain("NEGOTIATING");
  });

  it("still shows a label when the selected option is the first one", () => {
    renderSelect("NEW");

    const trigger = screen.getByRole("combobox");

    expect(trigger.textContent).toContain("Nueva");
    expect(trigger.textContent).not.toContain("NEW");
  });
});
