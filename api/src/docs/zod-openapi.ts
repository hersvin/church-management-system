import { applyDecorators } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

type JsonSchema = Record<string, unknown> & {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
};

/** Converts a Zod schema into an OpenAPI 3.0 schema object, so docs stay in sync with validation. */
export function toOpenApiSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
    unrepresentable: "any",
  }) as JsonSchema;
  delete json.$schema;
  return json;
}

/** Documents a JSON request body from a Zod schema. */
export const ZodBody = (schema: z.ZodType) =>
  ApiBody({ schema: toOpenApiSchema(schema) as never });

/** Documents each top-level property of a Zod object schema as a query parameter. */
export function ZodQuery(schema: z.ZodType) {
  const json = toOpenApiSchema(schema);
  const required = new Set(json.required ?? []);
  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, prop]) =>
      ApiQuery({
        name,
        required: required.has(name) && !("default" in prop),
        schema: prop as never,
        description: typeof prop.description === "string" ? prop.description : undefined,
      }),
    ),
  );
}

/** Tags a controller and marks it as requiring a session (cookie) or bearer token. */
export const ApiProtected = (tag: string) =>
  applyDecorators(ApiTags(tag), ApiCookieAuth("cookie"), ApiBearerAuth("bearer"));
