<?php
header('Content-Type: application/json; charset=utf-8');

$numParam = isset($_GET['number']) ? $_GET['number'] : '1';
if (!preg_match('/^[1-9][0-9]*$/', $numParam)) {
    http_response_code(400);
    echo json_encode(['error' => 'Puzzle number must be a positive integer.']);
    exit;
}

$num = intval($numParam, 10);
if ($num < 1 || $num > 2147483647) {
    http_response_code(400);
    echo json_encode(['error' => 'Puzzle number out of range.']);
    exit;
}

$puzzleFile = __DIR__ . '/../puzzles/' . $num . '.json';
if (file_exists($puzzleFile)) {
    readfile($puzzleFile);
    exit;
}

$cliScript = realpath(__DIR__ . '/../lib/cli_generate.js');
$cmd = 'node ' . escapeshellarg($cliScript) . ' ' . escapeshellarg((string)$num) . ' 2>&1';
$output = [];
$exitCode = 0;
exec($cmd, $output, $exitCode);

if ($exitCode !== 0) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to generate puzzle.',
        'details' => implode("\n", $output)
    ]);
    exit;
}

echo implode("\n", $output);
