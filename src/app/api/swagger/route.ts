import { NextResponse } from 'next/server';

export async function GET() {
  const swagger = {
    openapi: "3.0.0",
    info: {
      title: "Yield AI API",
      version: "1.0.0",
      description: "API for working with token balances and prices"
    },
    tags: [
      {
        name: "aptos",
        description: "Aptos blockchain related endpoints"
      },
      {
        name: "panora",
        description: "Panora API integration endpoints"
      },
      {
        name: "protocols",
        description: "Protocol related endpoints"
      }
    ],
    paths: {
      "/api/panora/tokenList": {
        get: {
          tags: ["panora"],
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
          tags: ["panora"],
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
          tags: ["aptos"],
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
      },
      "/api/aptos/walletBalanceWithPrices": {
        get: {
          tags: ["aptos"],
          summary: "Get Aptos wallet balances with token prices",
          description: "Returns all fungible token balances with price information for the specified address",
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
                                symbol: {
                                  type: "string",
                                  example: "APT"
                                },
                                usd_price: {
                                  type: "number",
                                  example: 3.92
                                },
                                usd_value: {
                                  type: "number",
                                  example: 313.58
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
                        example: "Failed to fetch wallet balance with prices"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/aptos/portfolio": {
        get: {
          tags: ["aptos"],
          summary: "Get portfolio data for an Aptos address",
          description: "Returns portfolio information for the specified address with token details and prices",
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
                          tokens: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                address: {
                                  type: "string",
                                  example: "0x1::aptos_coin::AptosCoin"
                                },
                                name: {
                                  type: "string",
                                  example: "Aptos Coin"
                                },
                                symbol: {
                                  type: "string",
                                  example: "APT"
                                },
                                decimals: {
                                  type: "number",
                                  example: 8
                                },
                                amount: {
                                  type: "string",
                                  example: "79995869"
                                },
                                price: {
                                  type: "string",
                                  example: "3.92"
                                },
                                value: {
                                  type: "string",
                                  example: "313.58"
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
                        example: "Failed to fetch portfolio"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/protocols/hyperion/pools": {
        get: {
          tags: ["protocols"],
          summary: "Get Hyperion pools",
          description: "Returns all pools from Hyperion protocol",
          parameters: [],
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
                            id: {
                              type: "string",
                              example: "0x12345"
                            },
                            name: {
                              type: "string",
                              example: "APT-USDC"
                            },
                            apy: {
                              type: "number",
                              example: 12.5
                            },
                            tvl: {
                              type: "number",
                              example: 1200000
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
                        example: "Failed to fetch pools"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/protocols/hyperion/userPositions": {
        get: {
          tags: ["protocols"],
          summary: "Get user positions in Hyperion protocol",
          description: "Returns user positions in Hyperion protocol for the specified address",
          parameters: [
            {
              name: "address",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "User wallet address",
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
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            poolId: {
                              type: "string",
                              example: "0x12345"
                            },
                            amount: {
                              type: "string",
                              example: "100.5"
                            },
                            value: {
                              type: "number",
                              example: 152.75
                            },
                            rewards: {
                              type: "number",
                              example: 5.2
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
                        example: "Failed to fetch user positions"
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