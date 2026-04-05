/**
 * §24.4 — Unit Tests: Validation logic
 *
 * Tests for import row validation and duplicate detection helpers.
 */

import { validateRow } from "../services/import.service.js";

describe("Import row validation", () => {
  it("should pass valid row with all required fields", () => {
    const result = validateRow(
      {
        candidateName: "John Doe",
        contactNo: "9876543210",
        emailId: "john@example.com",
        zone: "WEST",
      },
      1,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.isDuplicate).toBe(false);
  });

  it("should fail if candidateName is missing", () => {
    const result = validateRow({ contactNo: "9876543210" }, 1);
    expect(result.errors).toContain("candidateName is required");
  });

  it("should fail if contactNo is missing", () => {
    const result = validateRow({ candidateName: "John Doe" }, 1);
    expect(result.errors).toContain("contactNo is required");
  });

  it("should fail if contactNo is not 10 digits", () => {
    const result = validateRow({ candidateName: "John", contactNo: "12345" }, 1);
    expect(result.errors).toContain("contactNo must be 10 digits");
  });

  it("should fail on invalid email format", () => {
    const result = validateRow(
      { candidateName: "John", contactNo: "9876543210", emailId: "not-an-email" },
      1,
    );
    expect(result.errors).toContain("Invalid email format");
  });

  it("should fail on invalid zone", () => {
    const result = validateRow(
      { candidateName: "John", contactNo: "9876543210", zone: "INVALID" },
      1,
    );
    expect(result.errors.some((e) => e.includes("zone must be one of"))).toBe(true);
  });

  it("should fail on negative experience", () => {
    const result = validateRow(
      { candidateName: "John", contactNo: "9876543210", yearsOfExperience: -2 },
      1,
    );
    expect(result.errors).toContain("yearsOfExperience must be a non-negative number");
  });

  it("should accept valid zone values", () => {
    for (const zone of ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]) {
      const result = validateRow({ candidateName: "John", contactNo: "9876543210", zone }, 1);
      expect(result.errors.filter((e) => e.includes("zone"))).toHaveLength(0);
    }
  });
});
