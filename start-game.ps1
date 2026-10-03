$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$prefix = "http://127.0.0.1:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start local server. Close other copies of the game and try again."
  Write-Host $_
  exit 1
}
Write-Host "Game running at $prefix"
Start-Process ($prefix + "home.html")
$mime = @{
  ".html"="text/html"; ".htm"="text/html"; ".js"="text/javascript"; ".css"="text/css"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".webp"="image/webp"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"
  ".mp4"="video/mp4"; ".webm"="video/webm"; ".mp3"="audio/mpeg"; ".wav"="audio/wav"
  ".json"="application/json"; ".woff2"="font/woff2"; ".woff"="font/woff"
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.LocalPath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "home.html" }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $path.StartsWith([IO.Path]::GetFullPath($root))) {
      $res.StatusCode = 403
    } elseif (Test-Path $path -PathType Container) {
      $path = Join-Path $path "index.html"
    }
    if (Test-Path $path -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
      $bytes = [IO.File]::ReadAllBytes($path)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
