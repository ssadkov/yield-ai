"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { ManagePositions } from "@/components/protocols/manage-positions/ManagePositions";
import { useProtocol } from "@/lib/contexts/ProtocolContext";

export default function TestManagingPositions() {
  const { account } = useWallet();
  const { selectedProtocol, setSelectedProtocol } = useProtocol();
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const protocols = [
    "Hyperion",
    "Tapp Exchange", 
    "Auro Finance",
    "Amnis Finance",
    "Echelon",
    "Joule",
    "Meso Finance"
  ];

  const testProtocol = async (protocolName: string) => {
    if (!account?.address) {
      setTestResults(prev => ({ ...prev, [protocolName]: "No wallet connected" }));
      return;
    }

    try {
      setTestResults(prev => ({ ...prev, [protocolName]: "Testing..." }));
      
      const protocol = getProtocolByName(protocolName);
      if (!protocol) {
        setTestResults(prev => ({ ...prev, [protocolName]: "Protocol not found" }));
        return;
      }

      // Test API endpoint
      let apiPath = protocolName.toLowerCase();
      if (protocolName.toLowerCase().includes('tapp')) {
        apiPath = 'tapp';
      } else if (protocolName.toLowerCase().includes('auro')) {
        apiPath = 'auro';
      } else if (protocolName.toLowerCase().includes('meso')) {
        apiPath = 'meso';
      } else if (protocolName.toLowerCase().includes('amnis')) {
        apiPath = 'amnis';
      }

      const response = await fetch(`/api/protocols/${apiPath}/userPositions?address=${account.address}`);
      const data = await response.json();

      if (data.success) {
        setTestResults(prev => ({ 
          ...prev, 
          [protocolName]: `Success: ${Array.isArray(data.data) ? data.data.length : 0} positions` 
        }));
      } else {
        setTestResults(prev => ({ ...prev, [protocolName]: "API error" }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [protocolName]: `Error: ${error}` }));
    }
  };

  const testAllProtocols = () => {
    protocols.forEach(testProtocol);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Managing Positions Test</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Wallet Status</h2>
          <p>Connected: {account?.address ? "Yes" : "No"}</p>
          {account?.address && <p>Address: {account.address.toString()}</p>}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Protocol Tests</h2>
          <Button onClick={testAllProtocols} className="mb-4">
            Test All Protocols
          </Button>
          
          <div className="grid gap-4 md:grid-cols-2">
            {protocols.map(protocolName => (
              <Card key={protocolName}>
                <CardHeader>
                  <CardTitle className="text-sm">{protocolName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      onClick={() => testProtocol(protocolName)}
                    >
                      Test API
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const protocol = getProtocolByName(protocolName);
                        if (protocol) setSelectedProtocol(protocol);
                      }}
                    >
                      Open Managing
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {testResults[protocolName] || "Not tested"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {selectedProtocol && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Managing Positions</h2>
            <ManagePositions 
              protocol={selectedProtocol} 
              onClose={() => setSelectedProtocol(null)} 
            />
          </div>
        )}
      </div>
    </div>
  );
} 