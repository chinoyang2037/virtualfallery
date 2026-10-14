$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 8765)
$listener.Start()
Write-Host 'Gallery preview: http://127.0.0.1:8765/index.html'
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
Start-Process 'http://127.0.0.1:8765/index.html'
$types = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json; charset=utf-8';'.jpg'='image/jpeg';'.png'='image/png';'.webp'='image/webp';'.mp3'='audio/mpeg'}
try {
 while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
   $stream = $client.GetStream(); $stream.ReadTimeout = 10000
   $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
   $line = $reader.ReadLine(); if (!$line) { continue }
   $parts = $line.Split(' ')
   while ($reader.ReadLine()) {}
   $route = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0]).Replace('/', [IO.Path]::DirectorySeparatorChar).TrimStart([IO.Path]::DirectorySeparatorChar)
   if (!$route) { $route = 'index.html' }
   $file = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $route))
   $inside = $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
   if ($inside -and [IO.File]::Exists($file)) {
    $body = [IO.File]::ReadAllBytes($file); $status = '200 OK'
    $mime = $types[[IO.Path]::GetExtension($file).ToLower()]; if (!$mime) { $mime = 'application/octet-stream' }
   } else { $body = [Text.Encoding]::UTF8.GetBytes('File not found'); $status = '404 Not Found'; $mime = 'text/plain' }
   $head = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n")
   $stream.Write($head, 0, $head.Length); $stream.Write($body, 0, $body.Length); $stream.Flush()
  } catch { Write-Host $_.Exception.Message } finally { $client.Close() }
 }
} finally { $listener.Stop() }
