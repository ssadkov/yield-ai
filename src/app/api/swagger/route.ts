import { NextResponse } from 'next/server';

export async function GET() {
  const swagger = {
    openapi: "3.0.0",
    info: {
      title: "Yield AI API",
      version: "1.0.0",
      description: "API for working with token balances and prices"
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
              required: false,
              schema: {
                type: "integer",
                default: 1
              },
              description: "Chain ID"
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
                            tokenAddress: {
                              type: "string",
                              example: "0x1::aptos_coin::AptosCoin"
                            },
                            symbol: {
                              type: "string",
                              example: "APT"
                            },
                            decimals: {
                              type: "number",
                              example: 8
                            },
                            usdPrice: {
                              type: "number",
                              example: 1.23
                            }
                          }
                        }
                      },
                      status: {
                        type: "number",
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
                        example: "Failed to fetch token list"
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
          description: "Returns token prices from Panora API",
          parameters: [
            {
              name: "tokenAddress",
              in: "query",
              required: false,
              schema: {
                type: "string"
              },
              description: "Token address",
              example: "0x1::aptos_coin::AptosCoin"
            },
            {
              name: "chainId",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 1
              },
              description: "Chain ID"
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
                        type: "object",
                        additionalProperties: {
                          type: "number"
                        },
                        example: {
                          "0x1::aptos_coin::AptosCoin": 1.23
                        }
                      },
                      status: {
                        type: "number",
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
      },
      "/api/aptos/walletBalance": {
        get: {
          summary: "Get Aptos wallet balances",
          description: "Returns all fungible token balances with non-zero amount for the specified address",
          parameters: [
            {
              name: "address",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "Aptos wallet address",
              example: "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
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
                        type: "object",
                        properties: {
                          balances: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                asset_type: {
                                  type: "string",
                                  example: "0x1::aptos_coin::AptosCoin"
                                },
                                amount: {
                                  type: "string",
                                  example: "79995869"
                                },
                                last_transaction_timestamp: {
                                  type: "string",
                                  example: "2025-06-12T08:37:41"
                                }
                              }
                            }
                          }
                        }
                      },
                      status: {
                        type: "number",
                        example: 200
                      }
                    }
                  }
                }
              }
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        example: "Address parameter is required"
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
                        example: "Failed to fetch wallet balance"
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