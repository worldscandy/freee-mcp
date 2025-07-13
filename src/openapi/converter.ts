import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import freeeApiSchema from '../data/freee-api-schema.json';
import { OpenAPIOperation, OpenAPIPathItem, OpenAPIParameter } from '../api/types.js';
import { convertParameterToZodSchema, convertPathToToolName } from './schema.js';
import { makeApiRequest } from '../api/client.js';

function sanitizeParameterName(name: string): string {
  // Replace spaces and invalid characters with underscores
  // Keep only letters, numbers, underscores, dots, and hyphens
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64);
}

export function generateToolsFromOpenApi(server: McpServer): void {
  const paths = freeeApiSchema.paths;

  const orderedPathKeys = Object.keys(paths).sort() as (keyof typeof paths)[];
  orderedPathKeys.forEach((pathKey) => {
    const pathItem: OpenAPIPathItem = paths[pathKey];
    Object.entries(pathItem).forEach(([method, operation]: [string, OpenAPIOperation]) => {
      const toolName = `${method}_${convertPathToToolName(pathKey)}`;
      const description = operation.summary || operation.description || '';

      const parameterSchema: Record<string, z.ZodType> = {};
      const parameterNameMap: Record<string, string> = {}; // sanitized -> original

      const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
      pathParams.forEach((param) => {
        const sanitizedName = sanitizeParameterName(param.name);
        parameterSchema[sanitizedName] = convertParameterToZodSchema(param);
        parameterNameMap[sanitizedName] = param.name;
      });

      const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
      queryParams.forEach((param) => {
        let schema = convertParameterToZodSchema(param);
        if (param.name === 'company_id') {
          schema = schema.optional();
        }
        const sanitizedName = sanitizeParameterName(param.name);
        parameterSchema[sanitizedName] = schema;
        parameterNameMap[sanitizedName] = param.name;
      });

      let bodySchema = z.any();
      if (method === 'post' || method === 'put') {
        const requestBody = operation.requestBody?.content?.['application/json']?.schema;
        if (requestBody) {
          parameterSchema['body'] = bodySchema.describe('Request body');
        }
      }

      server.tool(toolName, description, parameterSchema, async (params) => {
        try {
          let actualPath = pathKey as string;
          pathParams.forEach((param: OpenAPIParameter) => {
            const sanitizedName = sanitizeParameterName(param.name);
            if (params[sanitizedName] !== undefined) {
              actualPath = actualPath.replace(`{${param.name}}`, String(params[sanitizedName]));
            }
          });

          const queryParameters: Record<string, unknown> = {};
          queryParams.forEach((param: OpenAPIParameter) => {
            const sanitizedName = sanitizeParameterName(param.name);
            if (params[sanitizedName] !== undefined) {
              queryParameters[param.name] = params[sanitizedName];
            }
          });

          const bodyParameters =
            method === 'post' || method === 'put' ? params.body : undefined;
          const result = await makeApiRequest(
            method.toUpperCase(),
            actualPath,
            queryParameters,
            bodyParameters,
          );

          // Handle binary responses (ArrayBuffer)
          if (result instanceof ArrayBuffer) {
            const base64Data = Buffer.from(result).toString('base64');
            return {
              content: [
                {
                  type: 'text',
                  text: `Binary data downloaded successfully (${result.byteLength} bytes).\nBase64: data:application/octet-stream;base64,${base64Data}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      });
    });
  });
}