import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { clearResources } from "@/shared/api";

afterEach(() => { cleanup(); clearResources(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
