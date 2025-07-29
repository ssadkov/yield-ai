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
          summary: "Get complete portfolio data for an Aptos address",
          description: "Returns complete portfolio information including wallet tokens and DeFi protocol positions",
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
                      },
                      protocols: {
                        type: "object",
                        properties: {
                          hyperion: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Hyperion protocol positions"
                          },
                          echelon: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Echelon protocol positions"
                          },
                          aries: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Aries protocol positions"
                          },
                          joule: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Joule protocol positions"
                          },
                          tapp: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Tapp Exchange positions"
                          },
                          meso: {
                            type: "array",
                            items: {
                              type: "object"
                            },
                            description: "Meso Finance positions"
                          }
                        }
                      },
                      totals: {
                        type: "object",
                        properties: {
                          walletValue: {
                            type: "number",
                            example: 1234.56,
                            description: "Total value of wallet tokens"
                          },
                          protocolsValue: {
                            type: "number",
                            example: 5678.90,
                            description: "Total value of DeFi protocol positions"
                          },
                          totalValue: {
                            type: "number",
                            example: 6913.46,
                            description: "Total portfolio value"
                          }
                        }
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
      "/api/protocols/hyperion/pools/{poolId}": {
        get: {
          tags: ["protocols"],
          summary: "Get Hyperion pool by ID",
          description: "Returns detailed information about a specific Hyperion pool by its ID",
          parameters: [
            {
              name: "poolId",
              in: "path",
              required: true,
              schema: {
                type: "string"
              },
              description: "Pool ID",
              example: "0x76d9ab75b28e5e9be6268c88a3d223237d23467a3dd5c8703a69f1fbeda23478"
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
                      success: {
                        type: "boolean",
                        example: true
                      },
                      data: {
                        type: "object",
                        properties: {
                          poolId: {
                            type: "string",
                            example: "0x76d9ab75b28e5e9be6268c88a3d223237d23467a3dd5c8703a69f1fbeda23478"
                          },
                          token1: {
                            type: "string",
                            example: "0x000000000000000000000000000000000000000000000000000000000000000a"
                          },
                          token2: {
                            type: "string",
                            example: "0x1ff8bf54987b665fd0aa8b317a22a60f5927675d35021473a85d720e254ed77e"
                          },
                          feeTier: {
                            type: "number",
                            example: 3
                          },
                          currentTick: {
                            type: "number",
                            example: 48400
                          },
                          sqrtPrice: {
                            type: "string",
                            example: "207424390474109573907"
                          }
                        }
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
                        example: "Pool ID is required"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              description: "Pool not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        example: "Pool not found"
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
                        example: "Failed to fetch pool"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/protocols/hyperion/pools/by-tokens": {
        get: {
          tags: ["protocols"],
          summary: "Get Hyperion pool by token pair and fee tier",
          description: "Returns a specific Hyperion pool by token pair and fee tier",
          parameters: [
            {
              name: "token1",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "First token address",
              example: "0x000000000000000000000000000000000000000000000000000000000000000a"
            },
            {
              name: "token2",
              in: "query",
              required: true,
              schema: {
                type: "string"
              },
              description: "Second token address",
              example: "0x1ff8bf54987b665fd0aa8b317a22a60f5927675d35021473a85d720e254ed77e"
            },
            {
              name: "feeTier",
              in: "query",
              required: true,
              schema: {
                type: "number"
              },
              description: "Fee tier index",
              example: 3
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
                      success: {
                        type: "boolean",
                        example: true
                      },
                      data: {
                        type: "object",
                        properties: {
                          poolId: {
                            type: "string",
                            example: "0x76d9ab75b28e5e9be6268c88a3d223237d23467a3dd5c8703a69f1fbeda23478"
                          },
                          token1: {
                            type: "string",
                            example: "0x000000000000000000000000000000000000000000000000000000000000000a"
                          },
                          token2: {
                            type: "string",
                            example: "0x1ff8bf54987b665fd0aa8b317a22a60f5927675d35021473a85d720e254ed77e"
                          },
                          currentTick: {
                            type: "number",
                            example: 48400
                          }
                        }
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
                        example: "token1, token2, and feeTier are required"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              description: "Pool not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                        example: "Pool not found"
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
                        example: "Failed to fetch pool"
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
      },
      "/api/protocols/echelon/pools": {
        get: {
          tags: ["protocols"],
          summary: "Get Echelon pools",
          description: "Returns all pools from Echelon lending protocol",
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
                            poolId: {
                              type: "string",
                              example: "0x1::coin::AptosCoin"
                            },
                            assetName: {
                              type: "string",
                              example: "APT"
                            },
                            supplyApy: {
                              type: "string",
                              example: "3.5"
                            },
                            borrowApy: {
                              type: "string",
                              example: "5.2"
                            },
                            totalSupply: {
                              type: "string",
                              example: "1250000"
                            },
                            totalBorrow: {
                              type: "string",
                              example: "750000"
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
      "/api/protocols/echelon/userPositions": {
        get: {
          tags: ["protocols"],
          summary: "Get user positions in Echelon protocol",
          description: "Returns user positions in Echelon lending protocol for the specified address",
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
                            assetName: {
                              type: "string",
                              example: "APT"
                            },
                            assetType: {
                              type: "string",
                              example: "supply"
                            },
                            balance: {
                              type: "string",
                              example: "125.5"
                            },
                            apy: {
                              type: "string",
                              example: "3.5"
                            },
                            value: {
                              type: "string",
                              example: "456.23"
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
      },
      "/api/protocols/aries/userPositions": {
        get: {
          tags: ["protocols"],
          summary: "Get user positions in Aries protocol",
          description: "Returns user positions in Aries lending protocol for the specified address",
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
                      success: {
                        type: "boolean"
                      },
                      data: {
                        type: "object",
                        properties: {
                          userPositions: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                assetName: {
                                  type: "string",
                                  example: "APT"
                                },
                                assetType: {
                                  type: "string",
                                  enum: ["supply", "borrow"],
                                  example: "supply"
                                },
                                balance: {
                                  type: "string",
                                  example: "125.5"
                                },
                                value: {
                                  type: "string",
                                  example: "456.23"
                                },
                                assetInfo: {
                                  type: "object",
                                  properties: {
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
                                    price: {
                                      type: "string",
                                      example: "3.92"
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
      },
      "/api/protocols/joule/userPositions": {
        get: {
          tags: ["protocols"],
          summary: "Get user positions in Joule protocol",
          description: "Returns user positions in Joule lending protocol for the specified address",
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
                        type: "object",
                        properties: {
                          userPositions: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                positions_map: {
                                  type: "object",
                                  properties: {
                                    data: {
                                      type: "array",
                                      items: {
                                        type: "object",
                                        properties: {
                                          key: {
                                            type: "string",
                                            example: "1"
                                          },
                                          value: {
                                            type: "object",
                                            properties: {
                                              borrow_positions: {
                                                type: "object",
                                                properties: {
                                                  data: {
                                                    type: "array",
                                                    items: {
                                                      type: "object",
                                                      properties: {
                                                        key: {
                                                          type: "string",
                                                          example: "0x1::aptos_coin::AptosCoin"
                                                        },
                                                        value: {
                                                          type: "object",
                                                          properties: {
                                                            borrow_amount: {
                                                              type: "string",
                                                              example: "117444352967"
                                                            },
                                                            coin_name: {
                                                              type: "string",
                                                              example: "0x1::aptos_coin::AptosCoin"
                                                            },
                                                            interest_accumulated: {
                                                              type: "string",
                                                              example: "204352967"
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              },
                                              lend_positions: {
                                                type: "object",
                                                properties: {
                                                  data: {
                                                    type: "array",
                                                    items: {
                                                      type: "object",
                                                      properties: {
                                                        key: {
                                                          type: "string",
                                                          example: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt"
                                                        },
                                                        value: {
                                                          type: "string",
                                                          example: "119881806209"
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              },
                                              position_name: {
                                                type: "string",
                                                example: "Loop-Position"
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                },
                                user_position_ids: {
                                  type: "array",
                                  items: {
                                    type: "string"
                                  },
                                  example: ["1", "2"]
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
                        example: "Failed to fetch user positions"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/aptos/pools": {
        get: {
          tags: ["aptos"],
          summary: "Get Aptos pools",
          description: "Returns information about all pools from Aptos protocols",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      protocols: {
                        type: "object",
                        additionalProperties: {
                          type: "integer"
                        },
                        example: {
                          "Joule": 1,
                          "Echelon": 1,
                          "Aries": 1,
                          "Hyperion": 1
                        }
                      },
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            asset: {
                              type: "string",
                              example: "USDC"
                            },
                            provider: {
                              type: "string",
                              example: "Circle USDC"
                            },
                            totalAPY: {
                              type: "number",
                              example: 21.79
                            },
                            depositApy: {
                              type: "number",
                              example: 21.79
                            },
                            extraAPY: {
                              type: "number",
                              example: 0
                            },
                            borrowAPY: {
                              type: "number",
                              example: 32.96
                            },
                            extraBorrowAPY: {
                              type: "number",
                              example: 0
                            },
                            extraStakingAPY: {
                              type: "number",
                              example: 0
                            },
                            token: {
                              type: "string",
                              example: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
                            },
                            protocol: {
                              type: "string",
                              example: "Joule"
                            }
                          }
                        }
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
      }
    }
  };

  return NextResponse.json(swagger);
} 