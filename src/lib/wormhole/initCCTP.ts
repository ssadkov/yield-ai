/**
 * Initialize CCTP protocols for Wormhole SDK
 * This function must be called before initializing Wormhole to register protocols
 */

export async function initCCTPProtocols() {
  // Ensure we're in client-side context
  if (typeof window === 'undefined') {
    console.warn('[initCCTP] Running on server side - skipping protocol registration');
    return;
  }
  
  try {
    console.log('[initCCTP] Starting CCTP protocol initialization...');
    
    // Import registerProtocol first - it must be the same instance used by CCTP modules
    // CCTP modules import registerProtocol from @wormhole-foundation/sdk-connect
    // So we need to use the same import to ensure we're using the same registry
    console.log('[initCCTP] Importing SDK modules...');
    const sdkConnect = await import('@wormhole-foundation/sdk-connect');
    const sdkDefinitions = await import('@wormhole-foundation/sdk-definitions');
    const sdkSolana = await import('@wormhole-foundation/sdk-solana');
    
    console.log('[initCCTP] SDK modules imported');
    
    // Get registerProtocol - try sdk-connect first, then sdk-definitions
    let registerProtocol: any = (sdkConnect as any).registerProtocol || (sdkDefinitions as any).registerProtocol;
    const { _platform } = sdkSolana;
    
    console.log('[initCCTP] registerProtocol available:', typeof registerProtocol);
    console.log('[initCCTP] _platform:', _platform);
    
    if (!registerProtocol) {
      console.error('[initCCTP] registerProtocol not found!');
      console.log('[initCCTP] sdk-connect keys:', Object.keys(sdkConnect));
      console.log('[initCCTP] sdk-definitions keys:', Object.keys(sdkDefinitions));
      throw new Error('registerProtocol not found');
    }
    
    // IMPORTANT: CCTP modules call registerProtocol at module load time (top-level)
    // In Next.js/Turbopack, static imports may execute on server, but we need them on client
    // So we import them dynamically here to ensure they execute on client side
    console.log('[initCCTP] Importing CCTP modules (this will trigger their registerProtocol calls)...');
    
    // Import CCTP modules - they will call registerProtocol(_platform, 'CircleBridge', SolanaCircleBridge)
    // at module load time, which should register in the same protocolFactory that we're using
    const [solanaCCTPModule, aptosCCTPModule] = await Promise.all([
      import('@wormhole-foundation/sdk-solana-cctp'),
      import('@wormhole-foundation/sdk-aptos-cctp'),
    ]);
    
    console.log('[initCCTP] CCTP modules imported - they should have registered CircleBridge automatically');
    
    // Verify that protocols were registered by checking protocolIsRegistered
    const { protocolIsRegistered: checkProtocol } = sdkDefinitions as any;
    if (checkProtocol) {
      const solanaCBRegistered = checkProtocol(_platform, 'CircleBridge');
      const aptosCBRegistered = checkProtocol('Aptos', 'CircleBridge');
      console.log('[initCCTP] Protocol registration check:', {
        solanaCircleBridge: solanaCBRegistered,
        aptosCircleBridge: aptosCBRegistered,
      });
    }
    
    // Get CircleBridge classes from the imported modules
    // They are exported from circleBridge.js via export * from './circleBridge.js'
    // So they should be available directly on the module
    const SolanaCircleBridge = (solanaCCTPModule as any).SolanaCircleBridge;
    const AptosCircleBridge = (aptosCCTPModule as any).AptosCircleBridge;
    
    console.log('[initCCTP] Checking exports:', {
      solanaModuleKeys: Object.keys(solanaCCTPModule),
      aptosModuleKeys: Object.keys(aptosCCTPModule),
      hasSolanaCircleBridge: !!SolanaCircleBridge,
      hasAptosCircleBridge: !!AptosCircleBridge,
      SolanaCircleBridgeType: typeof SolanaCircleBridge,
      AptosCircleBridgeType: typeof AptosCircleBridge,
      _platform,
    });
    
    // If classes are not found, try to access them differently
    if (!SolanaCircleBridge) {
      console.warn('[initCCTP] SolanaCircleBridge not found in module exports');
      console.log('[initCCTP] Solana module structure:', solanaCCTPModule);
    }
    if (!AptosCircleBridge) {
      console.warn('[initCCTP] AptosCircleBridge not found in module exports');
      console.log('[initCCTP] Aptos module structure:', aptosCCTPModule);
    }
    
    // First, ensure CircleBridge is registered (it should be, but let's make sure)
    if (SolanaCircleBridge && _platform) {
      try {
        registerProtocol(_platform, 'CircleBridge', SolanaCircleBridge);
        console.log('[initCCTP] CircleBridge registered for Solana');
      } catch (err: any) {
        if (err.message?.includes('already registered')) {
          console.log('[initCCTP] CircleBridge already registered for Solana');
        } else {
          console.warn('[initCCTP] Failed to register CircleBridge for Solana:', err);
        }
      }
    }
    
    if (AptosCircleBridge) {
      try {
        registerProtocol('Aptos', 'CircleBridge', AptosCircleBridge);
        console.log('[initCCTP] CircleBridge registered for Aptos');
      } catch (err: any) {
        if (err.message?.includes('already registered')) {
          console.log('[initCCTP] CircleBridge already registered for Aptos');
        } else {
          console.warn('[initCCTP] Failed to register CircleBridge for Aptos:', err);
        }
      }
    }
    
    // Register AutomaticCircleBridge
    if (SolanaCircleBridge && _platform) {
      try {
        registerProtocol(_platform, 'AutomaticCircleBridge', SolanaCircleBridge);
        console.log('[initCCTP] AutomaticCircleBridge registered for Solana');
      } catch (err: any) {
        if (err.message?.includes('already registered')) {
          console.log('[initCCTP] AutomaticCircleBridge already registered for Solana');
        } else {
          console.error('[initCCTP] Failed to register AutomaticCircleBridge for Solana:', err);
          throw err;
        }
      }
    } else {
      console.warn('[initCCTP] Cannot register AutomaticCircleBridge for Solana:', {
        hasSolanaCircleBridge: !!SolanaCircleBridge,
        hasPlatform: !!_platform,
      });
    }
    
    if (AptosCircleBridge) {
      try {
        registerProtocol('Aptos', 'AutomaticCircleBridge', AptosCircleBridge);
        console.log('[initCCTP] AutomaticCircleBridge registered for Aptos');
      } catch (err: any) {
        if (err.message?.includes('already registered')) {
          console.log('[initCCTP] AutomaticCircleBridge already registered for Aptos');
        } else {
          console.error('[initCCTP] Failed to register AutomaticCircleBridge for Aptos:', err);
          throw err;
        }
      }
    } else {
      console.warn('[initCCTP] Cannot register AutomaticCircleBridge for Aptos: AptosCircleBridge not found');
    }
    
      // Small delay to ensure protocol registration completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Final verification: check that protocols are registered
      if (checkProtocol) {
        const finalSolanaCB = checkProtocol(_platform, 'CircleBridge');
        const finalSolanaACB = checkProtocol(_platform, 'AutomaticCircleBridge');
        const finalAptosCB = checkProtocol('Aptos', 'CircleBridge');
        const finalAptosACB = checkProtocol('Aptos', 'AutomaticCircleBridge');
        console.log('[initCCTP] Final protocol registration check:', {
          solanaCircleBridge: finalSolanaCB,
          solanaAutomaticCircleBridge: finalSolanaACB,
          aptosCircleBridge: finalAptosCB,
          aptosAutomaticCircleBridge: finalAptosACB,
        });
        
        // Log protocolFactory state for debugging
        const { protocolFactory: pf } = sdkDefinitions as any;
        if (pf) {
          console.log('[initCCTP] protocolFactory state:', {
            hasCircleBridge: 'CircleBridge' in pf,
            hasAutomaticCircleBridge: 'AutomaticCircleBridge' in pf,
            circleBridgePlatforms: pf.CircleBridge ? Object.keys(pf.CircleBridge) : [],
            automaticCircleBridgePlatforms: pf.AutomaticCircleBridge ? Object.keys(pf.AutomaticCircleBridge) : [],
          });
        }
      }
      
      console.log('[initCCTP] CCTP protocols initialization complete');
    } catch (err) {
    console.error('[initCCTP] Failed to initialize CCTP protocols:', err);
    throw err;
  }
}
