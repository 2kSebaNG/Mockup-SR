import { createServerFn } from "@tanstack/react-start";
import { aiInputSchema } from "./requirements";

export const describeRequirement = createServerFn({ method: "POST" })
  .inputValidator(input => aiInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { analyzeRequirement } = await import("./requirements-ai.server");
    return analyzeRequirement(data);
  });