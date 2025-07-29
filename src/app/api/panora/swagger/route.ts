import { NextResponse } from 'next/server';

export async function GET() {
  const swagger = {
    openapi: "3.0.0",
    info: {
      title: "Panora API",
      version: "1.0.0",
      description: "API for working with Panora"
    },
    paths: {
      "/api/panora/tokenList": {
        get: {
          summary: "Get token list",
          description: "Returns a list of all tokens from Panora API",
          parameters: [
            {
              name: "chainId",
              in: "query",
              description: "Chain ID (default: 1 for Aptos)",
              required: false,
              schema: {
                type: "integer",
                default: 1
              }
            }
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            chainId: {
                              type: "integer",
                              example: 1
                            },
                            panoraId: {
                              type: "string",
                              example: "aptos-coin"
                            },
                            tokenAddress: {
                              type: "string",
                              nullable: true,
                              example: "0x1::aptos_coin::AptosCoin"
                            },
                            name: {
                              type: "string",
                              example: "Aptos Coin"
                            },
                            symbol: {
                              type: "string",
                              example: "APT"
                            }
                          }
                        }
                      },
                      status: {
                        type: "integer",
                        example: 200
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/panora/tokenPrices": {
        get: {
          summary: "Get token prices",
          description: "Returns token prices from Panora API. You can get prices for all tokens or specific tokens by their addresses.",
          parameters: [
            {
              name: "tokenAddress",
              in: "query",
              description: "Token addresses separated by comma (optional)",
              required: false,
              schema: {
                type: "string",
                example: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b,0x1::aptos_coin::AptosCoin"
              }
            },
            {
              name: "chainId",
              in: "query",
              description: "Chain ID (default: 1 for Aptos)",
              required: false,
              schema: {
                type: "integer",
                default: 1
              }
            }
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            chainId: {
                              type: "integer",
                              example: 1
                            },
                            tokenAddress: {
                              type: "string",
                              nullable: true,
                              example: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
                            },
                            faAddress: {
                              type: "string",
                              example: "0x456"
                            },
                            name: {
                              type: "string",
                              example: "USDC"
                            },
                            symbol: {
                              type: "string",
                              example: "USDC"
                            },
                            decimals: {
                              type: "integer",
                              example: 6
                            },
                            usdPrice: {
                              type: "string",
                              example: "0.99995"
                            },
                            nativePrice: {
                              type: "string",
                              example: "0.18077031"
                            }
                          }
                        }
                      },
                      status: {
                        type: "integer",
                        example: 200
                      }
                    }
                  }
                }
              }
            },
            "500": {
              description: "Server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        example: "Failed to fetch token prices"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  return NextResponse.json(swagger);
} 