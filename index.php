<?php
/**
 * PHP Proxy for Node.js Noisewatch Application
 * This file forwards all requests to the Node.js app running on port 3000
 */

// Get the full request URI
$requestUri = $_SERVER['REQUEST_URI'];

// Build the target URL (Node.js app on localhost:3000)
$targetUrl = 'http://127.0.0.1:3000' . $requestUri;

// Initialize cURL
$ch = curl_init($targetUrl);

// Set cURL options
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

// Forward the request method
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

// Forward POST/PUT data if present
if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH'])) {
    $postData = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
}

// Forward headers
$headers = [];
foreach (getallheaders() as $key => $value) {
    // Skip host header to avoid conflicts
    if (strtolower($key) !== 'host') {
        $headers[] = "$key: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute the request
$response = curl_exec($ch);

// Check for errors
if (curl_errno($ch)) {
    http_response_code(503);
    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Unavailable - Noisewatch</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .error-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            text-align: center;
        }
        h1 { font-size: 3em; margin: 0 0 20px 0; }
        p { font-size: 1.2em; line-height: 1.6; }
        .error-code { 
            background: rgba(255, 255, 255, 0.2);
            padding: 10px 20px;
            border-radius: 5px;
            margin-top: 20px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>⚠️ Service Unavailable</h1>
        <p>The Noisewatch application server is currently offline or not responding.</p>
        <p>Please try again in a few moments or contact the administrator.</p>
        <div class="error-code">Error: ' . htmlspecialchars(curl_error($ch)) . '</div>
    </div>
</body>
</html>';
    curl_close($ch);
    exit;
}

// Get HTTP status code
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

// Split headers and body
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

curl_close($ch);

// Set HTTP response code
http_response_code($httpCode);

// Forward response headers (excluding some that cause conflicts)
$headerLines = explode("\r\n", $responseHeaders);
foreach ($headerLines as $header) {
    if (empty($header) || strpos($header, 'HTTP/') === 0) {
        continue;
    }
    
    // Skip headers that might cause issues
    $lowerHeader = strtolower($header);
    if (strpos($lowerHeader, 'transfer-encoding:') === 0 ||
        strpos($lowerHeader, 'connection:') === 0) {
        continue;
    }
    
    header($header);
}

// Output the response body
echo $responseBody;
?>

