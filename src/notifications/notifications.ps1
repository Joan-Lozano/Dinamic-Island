# Puente con las notificaciones de Windows (UserNotificationListener).
# Emite JSON por stdout:
#   {"type":"access","status":"Allowed|Denied|Unspecified"}
#   {"type":"notification","id":..,"app":..,"aumid":..,"title":..,"body":..,"time":<ms epoch>}
# Comandos por stdin: {"cmd":"open","aumid":"..."}  {"cmd":"quit"}
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if ($task.Wait(8000)) { $task.Result }
}
function Emit($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4)) }

$queue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()
$rs = [runspacefactory]::CreateRunspace(); $rs.Open()
$rs.SessionStateProxy.SetVariable('queue', $queue)
$reader = [powershell]::Create(); $reader.Runspace = $rs
[void]$reader.AddScript({
    while (($l = [Console]::In.ReadLine()) -ne $null) { $queue.Enqueue($l) }
    $queue.Enqueue('{"cmd":"quit"}')
})
[void]$reader.BeginInvoke()

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
$accessType = [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]
$seen = New-Object 'System.Collections.Generic.HashSet[uint32]'
$seeded = $false
$lastStatus = ''

function Handle-Commands {
    $line = $null
    while ($queue.TryDequeue([ref]$line)) {
        $c = $line | ConvertFrom-Json
        if ($c.cmd -eq 'quit') { exit }
        if ($c.cmd -eq 'open' -and $c.aumid -match '^[\w.!\-]+$') {
            Start-Process explorer.exe "shell:AppsFolder\$($c.aumid)"
        }
    }
}

while ($true) {
    try {
        Handle-Commands
        $status = Await ($listener.RequestAccessAsync()) $accessType
        if ("$status" -ne $lastStatus) { $lastStatus = "$status"; Emit @{ type = 'access'; status = "$status" } }

        if ("$status" -eq 'Allowed') {
            $list = $listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast).GetAwaiter().GetResult()
            $ids = New-Object 'System.Collections.Generic.HashSet[uint32]'
            foreach ($n in $list) {
                [void]$ids.Add($n.Id)
                if ($seen.Contains($n.Id)) { continue }
                [void]$seen.Add($n.Id)
                if (-not $seeded) { continue }   # primera lectura: no re-emitir lo que ya estaba en el centro de acciones
                $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                $texts = @()
                if ($binding) { $texts = @($binding.GetTextElements() | ForEach-Object { $_.Text }) }
                Emit @{
                    type  = 'notification'
                    id    = [int]$n.Id
                    app   = $n.AppInfo.DisplayInfo.DisplayName
                    aumid = $n.AppInfo.AppUserModelId
                    title = if ($texts.Count -gt 0) { $texts[0] } else { '' }
                    body  = if ($texts.Count -gt 1) { ($texts[1..($texts.Count - 1)] -join "`n") } else { '' }
                    time  = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                }
            }
            $seeded = $true
            $seen.IntersectWith($ids)
        }
    } catch {
        # Errores transitorios de WinRT: reintentar en el siguiente ciclo.
    }
    Start-Sleep -Milliseconds 1000
}
