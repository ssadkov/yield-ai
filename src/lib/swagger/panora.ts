export const panoraOpenApi = {
  openapi: "3.0.0",
  info: {
    title: "Panora Token List API",
    version: "1.0.0",
    description: "API for retrieving the Panora token list."
  },
  servers: [
    { url: "/api/panora" }
  ],
  paths: {
    "/tokenList": {
      get: {
        summary: "Get Token List",
        description: "Returns the list of Panora tokens for the specified network.",
        parameters: [
          {
            name: "chainId",
            in: "query",
            description: "Network ID (default: 1 for Aptos)",
            required: false,
            schema: { type: "integer", default: 1 }
          }
        ],
        responses: {
          "200": {
            description: "Successful response with token list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TokenListResponse" }
              }
            }
          },
          "400": {
            description: "Invalid chainId",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Token: {
        type: "object",
        properties: {
          chainId: { type: "integer", example: 1 },
          panoraId: { type: "string", example: "a1-hexao-APT" },
          tokenAddress: { type: ["string", "null"], example: "0x1::aptos_coin::AptosCoin" },
          faAddress: { type: ["string", "null"], example: "0xa" },
          name: { type: "string", example: "Aptos Coin" },
          symbol: { type: "string", example: "APT" },
          decimals: { type: "integer", example: 8 },
          bridge: { type: ["string", "null"], example: null },
          panoraSymbol: { type: "string", example: "APT" },
          usdPrice: { type: "string", example: "4.94096887" },
          logoUrl: { type: "string", example: "https://assets.panora.exchange/tokens/aptos/APT.svg" },
          websiteUrl: { type: ["string", "null"], example: "https://aptosfoundation.org" },
          panoraUI: { type: "boolean", example: true },
          panoraTags: { type: "array", items: { type: "string" }, example: ["Native", "Verified"] },
          panoraIndex: { type: "integer", example: 1 },
          coinGeckoId: { type: ["string", "null"], example: "aptos" },
          coinMarketCapId: { type: ["integer", "null"], example: 21794 },
          isInPanoraTokenList: { type: "boolean", example: true },
          isBanned: { type: "boolean", example: false }
        }
      },
      TokenListResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Token" }
          },
          status: { type: "integer", example: 200 }
        }
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Invalid chainId" },
          message: { type: "string", example: "Invalid chainId" },
          status: { type: "integer", example: 400 }
        }
      }
    }
  }
}; 