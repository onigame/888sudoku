<?php
$mdPath = __DIR__ . '/../RELEASE_NOTES.md';
$lines = file_exists($mdPath) ? file($mdPath, FILE_IGNORE_NEW_LINES) : ['# Release Notes'];

function formatInline($text) {
    $escaped = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $escaped = preg_replace('/`([^`]+)`/', '<code>$1</code>', $escaped);
    $escaped = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $escaped);
    return $escaped;
}

$htmlParts = [];
$inList = false;

foreach ($lines as $line) {
    $trimmed = trim($line);
    if ($trimmed === '') {
        if ($inList) {
            $htmlParts[] = '</ul>';
            $inList = false;
        }
        continue;
    }

    if (preg_match('/^#\s+(.+)$/', $trimmed, $m)) {
        if ($inList) {
            $htmlParts[] = '</ul>';
            $inList = false;
        }
        $htmlParts[] = '<h1>' . formatInline($m[1]) . '</h1>';
    } elseif (preg_match('/^##\s+(.+)$/', $trimmed, $m)) {
        if ($inList) {
            $htmlParts[] = '</ul>';
            $inList = false;
        }
        $htmlParts[] = '<h2>' . formatInline($m[1]) . '</h2>';
    } elseif (preg_match('/^-\s+(.+)$/', $trimmed, $m)) {
        if (!$inList) {
            $htmlParts[] = '<ul>';
            $inList = true;
        }
        $htmlParts[] = '<li>' . formatInline($m[1]) . '</li>';
    } else {
        if ($inList) {
            $htmlParts[] = '</ul>';
            $inList = false;
        }
        $htmlParts[] = '<p>' . formatInline($trimmed) . '</p>';
    }
}

if ($inList) {
    $htmlParts[] = '</ul>';
}
$bodyHtml = implode("\n", $htmlParts);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>8×8×8 3D Sudoku — Release Notes</title>
  <style>
    body {
      margin: 0;
      padding: 32px 20px;
      background: #0b0f17;
      color: #e6edf7;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: #121826;
      border: 1px solid #243047;
      border-radius: 12px;
      padding: 28px 34px;
    }
    h1 {
      margin-top: 0;
      font-size: 1.7rem;
      border-bottom: 1px solid #243047;
      padding-bottom: 10px;
    }
    h2 {
      margin-top: 26px;
      font-size: 1.2rem;
      color: #38bdf8;
    }
    ul {
      padding-left: 22px;
    }
    li {
      margin-bottom: 8px;
      color: #cbd5e1;
    }
    strong {
      color: #f8fafc;
    }
    code {
      background: #0b0f17;
      border: 1px solid #243047;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 0.88em;
      color: #fde047;
    }
    .back-link {
      display: inline-block;
      margin-top: 20px;
      color: #38bdf8;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <?php echo $bodyHtml; ?>
    <a class="back-link" href="./">← Back to 8×8×8 3D Sudoku</a>
  </div>
</body>
</html>
