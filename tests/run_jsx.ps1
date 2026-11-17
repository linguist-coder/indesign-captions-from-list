param($jsx, $out)
# Runs a JSX file in InDesign 2026 via COM and writes the returned string to $out (UTF-8).
$id = New-Object -ComObject InDesign.Application.2026
$r = $id.DoScript((Resolve-Path $jsx).Path, 1246973031)
[System.IO.File]::WriteAllText($out, [string]$r, (New-Object System.Text.UTF8Encoding $false))
"wrote $out"
