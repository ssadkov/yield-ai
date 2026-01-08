<?php
/**
 * API endpoint to compute depositMessageHash from CCTP message
 * 
 * POST /compute-deposit-message-hash.php
 * Body: { "message": CCTPMessage }
 * Returns: { "depositMessageHash": "0x..." }
 * 
 * Requires: composer require symfony/polyfill-hash (for keccak256)
 * Or use: https://github.com/ethereum/eth-php (has keccak256)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['message'])) {
        http_response_code(400);
        echo json_encode(['error' => 'CCTP message is required']);
        exit;
    }
    
    $message = $input['message'];
    
    // Validate message structure
    if (!isset($message['sourceDomain']) || !isset($message['destinationDomain']) || !isset($message['nonce'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid CCTP message structure']);
        exit;
    }
    
    // Serialize CCTP message
    $serialized = serializeCCTPMessage($message);
    
    // Compute keccak256 hash
    // Option 1: Use eth-php library (recommended)
    // $hash = \Ethereum\Keccak::hash($serialized, 256);
    
    // Option 2: Use symfony/polyfill-hash
    // $hash = hash('sha3-256', $serialized, false);
    
    // Option 3: Use native PHP (if available)
    // Note: PHP doesn't have native keccak256, need library
    
    // For now, using a placeholder - you need to install a keccak256 library
    // Install: composer require ethereum/eth-php
    if (function_exists('keccak256')) {
        $hash = keccak256($serialized);
    } else {
        // Fallback: use eth-php if available
        if (class_exists('\Ethereum\Keccak')) {
            $hash = \Ethereum\Keccak::hash($serialized, 256);
        } else {
            throw new Exception('keccak256 library not available. Install: composer require ethereum/eth-php');
        }
    }
    
    $depositMessageHash = '0x' . $hash;
    
    echo json_encode([
        'depositMessageHash' => $depositMessageHash,
        'messageHash' => $hash,
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * Convert address object to bytes
 */
function addressToBytes($addressObj) {
    if (!is_array($addressObj) || !isset($addressObj['address'])) {
        return str_repeat("\0", 32);
    }
    
    $bytes = str_repeat("\0", 32);
    for ($i = 0; $i < 32; $i++) {
        $bytes[$i] = chr($addressObj['address'][$i] ?? 0);
    }
    return $bytes;
}

/**
 * Serialize CCTP payload
 */
function serializePayload($payload) {
    if (!is_array($payload)) {
        return '';
    }
    
    $buffer = str_repeat("\0", 128); // 32 + 32 + 32 + 32
    
    $offset = 0;
    
    // burnToken address (32 bytes)
    $burnTokenBytes = addressToBytes($payload['burnToken'] ?? []);
    substr_replace($buffer, $burnTokenBytes, $offset, 32);
    $offset += 32;
    
    // mintRecipient address (32 bytes)
    $mintRecipientBytes = addressToBytes($payload['mintRecipient'] ?? []);
    substr_replace($buffer, $mintRecipientBytes, $offset, 32);
    $offset += 32;
    
    // amount (uint256, big-endian, 32 bytes)
    $amount = isset($payload['amount']) ? gmp_init($payload['amount']) : gmp_init(0);
    $amountHex = str_pad(gmp_strval($amount, 16), 64, '0', STR_PAD_LEFT);
    $amountBytes = hex2bin($amountHex);
    substr_replace($buffer, $amountBytes, $offset, 32);
    $offset += 32;
    
    // messageSender address (32 bytes)
    $messageSenderBytes = addressToBytes($payload['messageSender'] ?? []);
    substr_replace($buffer, $messageSenderBytes, $offset, 32);
    
    return $buffer;
}

/**
 * Serialize CCTP message
 */
function serializeCCTPMessage($message) {
    $version = 0;
    $sourceDomain = $message['sourceDomain'] ?? 0;
    $destinationDomain = $message['destinationDomain'] ?? 0;
    $nonce = isset($message['nonce']) ? gmp_init($message['nonce']) : gmp_init(0);
    
    $senderBytes = addressToBytes($message['sender'] ?? []);
    $recipientBytes = addressToBytes($message['recipient'] ?? []);
    $destinationCallerBytes = addressToBytes($message['destinationCaller'] ?? []);
    $payloadBytes = serializePayload($message['payload'] ?? []);
    
    // Build buffer: 1 + 4 + 4 + 8 + 32 + 32 + 32 + payload
    $buffer = '';
    
    // version (1 byte)
    $buffer .= chr($version);
    
    // sourceDomain (uint32, little-endian, 4 bytes)
    $buffer .= pack('V', $sourceDomain);
    
    // destinationDomain (uint32, little-endian, 4 bytes)
    $buffer .= pack('V', $destinationDomain);
    
    // nonce (uint64, little-endian, 8 bytes)
    $nonceHex = str_pad(gmp_strval($nonce, 16), 16, '0', STR_PAD_LEFT);
    $nonceBytes = strrev(hex2bin($nonceHex)); // little-endian
    $buffer .= $nonceBytes;
    
    // addresses (32 bytes each)
    $buffer .= $senderBytes;
    $buffer .= $recipientBytes;
    $buffer .= $destinationCallerBytes;
    
    // payload
    $buffer .= $payloadBytes;
    
    return $buffer;
}
?>



