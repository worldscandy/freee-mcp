import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import freeeApiSchema from '../data/freee-api-schema.json';
import { OpenAPIOperation, OpenAPIPathItem, OpenAPIParameter } from '../api/types.js';
import { convertParameterToZodSchema, convertPathToToolName, sanitizePropertyName } from './schema.js';
import { makeApiRequest } from '../api/client.js';

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
        const sanitizedName = sanitizePropertyName(param.name);
        parameterSchema[sanitizedName] = convertParameterToZodSchema(param);
        parameterNameMap[sanitizedName] = param.name;
      });

      const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
      queryParams.forEach((param) => {
        let schema = convertParameterToZodSchema(param);
        if (param.name === 'company_id') {
          schema = schema.optional();
        }
        const sanitizedName = sanitizePropertyName(param.name);
        parameterSchema[sanitizedName] = schema;
        parameterNameMap[sanitizedName] = param.name;
      });

      // Add file_path parameter for download endpoints
      const isDownloadEndpoint = pathKey.includes('/download');
      if (isDownloadEndpoint) {
        parameterSchema['file_path'] = z.string().describe('保存先ファイルパス（例: /tmp/receipt.pdf）');
      }

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
            const sanitizedName = sanitizePropertyName(param.name);
            if (params[sanitizedName] !== undefined) {
              actualPath = actualPath.replace(`{${param.name}}`, String(params[sanitizedName]));
            }
          });

          const queryParameters: Record<string, unknown> = {};
          queryParams.forEach((param: OpenAPIParameter) => {
            const sanitizedName = sanitizePropertyName(param.name);
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
            // For download endpoints, save file if file_path is provided
            if (isDownloadEndpoint && params.file_path) {
              try {
                // Ensure directory exists
                const dir = path.dirname(params.file_path as string);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                
                // Save binary data to file
                fs.writeFileSync(params.file_path as string, Buffer.from(result));
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Binary file downloaded successfully.\nSaved to: ${params.file_path}\nSize: ${result.byteLength} bytes`,
                    },
                  ],
                };
              } catch (fileError) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error saving file: ${fileError instanceof Error ? fileError.message : String(fileError)}\nBinary data size: ${result.byteLength} bytes`,
                    },
                  ],
                };
              }
            }
            
            // Fallback: return Base64 (may hit token limits for large files)
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