# Generates icon-192.png and icon-512.png for Chrome PWA installability
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent

function Save-Icon {
  param([int]$Size, [string]$OutPath)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 31, 42, 68))
  $fontPx = [Math]::Max(8, [int]($Size * 0.38))
  $font = New-Object System.Drawing.Font('Segoe UI', $fontPx, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
  $g.DrawString('D', $font, $brush, $rect, $sf)
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $brush.Dispose()
}

Save-Icon -Size 192 -OutPath (Join-Path $root 'icon-192.png')
Save-Icon -Size 512 -OutPath (Join-Path $root 'icon-512.png')
Write-Host "OK: icon-192.png, icon-512.png in $root"
