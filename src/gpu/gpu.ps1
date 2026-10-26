# Uso de GPU para cualquier fabricante (NVIDIA, AMD, Intel) con los contadores
# "GPU Engine" de Windows, los mismos que usa el Administrador de tareas.
# Emite una línea JSON por lectura: {"name":"..","vendor":"Intel","pct":12.3}
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$name = ''
try {
    $ctl = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Basic|Remote|Virtual' } | Select-Object -First 1
    if ($ctl) { $name = $ctl.Name }
} catch { }
$vendor = if ($name -match 'NVIDIA') { 'NVIDIA' } elseif ($name -match 'AMD|Radeon|ATI') { 'AMD' } elseif ($name -match 'Intel') { 'Intel' } else { '' }

while ($true) {
    try {
        $samples = (Get-Counter '\GPU Engine(*)\Utilization Percentage').CounterSamples
        # Suma por adaptador y tipo de motor; la carga de la GPU es el motor más ocupado.
        $by = @{}
        foreach ($s in $samples) {
            if ($s.InstanceName -match 'luid_(0x[0-9a-f]+_0x[0-9a-f]+)_.*engtype_(\w*)') {
                $k = "$($Matches[1])|$($Matches[2])"
                $by[$k] += $s.CookedValue
            }
        }
        $max = 0
        foreach ($v in $by.Values) { if ($v -gt $max) { $max = $v } }
        if ($max -gt 100) { $max = 100 }
        [Console]::Out.WriteLine((@{ name = $name; vendor = $vendor; pct = [math]::Round($max, 1) } | ConvertTo-Json -Compress))
    } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        Start-Sleep -Seconds 2
    }
}
