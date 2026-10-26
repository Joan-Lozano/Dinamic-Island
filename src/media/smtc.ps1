# Puente SMTC (System Media Transport Controls) para Windows.
# Lee la sesión multimedia activa (Spotify, Chrome, Edge, Firefox...) y emite
# una línea JSON por tick por stdout. Recibe comandos JSON por stdin:
#   {"cmd":"toggle"} {"cmd":"next"} {"cmd":"prev"} {"cmd":"seek","value":<segundos>}
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamReference, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    if ($task.Wait(5000)) { $task.Result }
}

function Emit($obj) {
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
}

function Get-Thumb($props) {
    try {
        if (-not $props.Thumbnail) { return $null }
        $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        if (-not $stream) { return $null }
        $mime = $stream.ContentType
        $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
        $ms = New-Object System.IO.MemoryStream
        $net.CopyTo($ms)
        $net.Dispose(); $stream.Dispose()
        if ($ms.Length -eq 0) { return $null }
        return "data:$mime;base64," + [Convert]::ToBase64String($ms.ToArray())
    } catch { return $null }
}

# PlaybackStatus: Closed=0 Opened=1 Changing=2 Stopped=3 Playing=4 Paused=5
function Pick-Session($mgr) {
    $sessions = $mgr.GetSessions()
    foreach ($s in $sessions) {
        if ([int]$s.GetPlaybackInfo().PlaybackStatus -eq 4) { return $s }
    }
    $cur = $mgr.GetCurrentSession()
    if ($cur) { return $cur }
    if ($sessions.Count -gt 0) { return $sessions[0] }
    return $null
}

# Lector de stdin en otro runspace para no bloquear el bucle principal.
$queue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()
$rs = [runspacefactory]::CreateRunspace(); $rs.Open()
$rs.SessionStateProxy.SetVariable('queue', $queue)
$reader = [powershell]::Create(); $reader.Runspace = $rs
[void]$reader.AddScript({
    while (($l = [Console]::In.ReadLine()) -ne $null) { $queue.Enqueue($l) }
    $queue.Enqueue('{"cmd":"quit"}')
})
[void]$reader.BeginInvoke()

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$lastKey = ''
$thumb = $null
$thumbTries = 0

while ($true) {
    try {
        $session = Pick-Session $mgr

        $line = $null
        while ($queue.TryDequeue([ref]$line)) {
            $c = $line | ConvertFrom-Json
            switch ($c.cmd) {
                'quit'   { exit }
                'toggle' { if ($session) { [void](Await ($session.TryTogglePlayPauseAsync()) ([bool])) } }
                'next'   { if ($session) { [void](Await ($session.TrySkipNextAsync()) ([bool])) } }
                'prev'   { if ($session) { [void](Await ($session.TrySkipPreviousAsync()) ([bool])) } }
                'seek'   { if ($session) { [void](Await ($session.TryChangePlaybackPositionAsync([long]([double]$c.value * 10000000))) ([bool])) } }
            }
        }

        if (-not $session) {
            Emit @{ active = $false }
        } else {
            $info = $session.GetPlaybackInfo()
            $tl = $session.GetTimelineProperties()
            $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $app = $session.SourceAppUserModelId
            $key = "$app|$($props.Title)|$($props.Artist)|$($props.AlbumTitle)"

            $sendThumb = $false
            if ($key -ne $lastKey) {
                $lastKey = $key
                $thumb = Get-Thumb $props
                $thumbTries = 0
                $sendThumb = $true
            } elseif (-not $thumb -and $thumbTries -lt 6) {
                $thumbTries++
                $thumb = Get-Thumb $props
                if ($thumb) { $sendThumb = $true }
            }

            $playing = ([int]$info.PlaybackStatus -eq 4)
            $dur = ($tl.EndTime - $tl.StartTime).TotalSeconds
            $pos = $tl.Position.TotalSeconds
            if ($playing -and $tl.LastUpdatedTime.Year -gt 2000) {
                $pos += ([DateTimeOffset]::UtcNow - $tl.LastUpdatedTime).TotalSeconds
            }
            if ($dur -gt 0 -and $pos -gt $dur) { $pos = $dur }
            if ($pos -lt 0) { $pos = 0 }

            $msg = @{
                active   = $true
                key      = $key
                app      = $app
                title    = $props.Title
                artist   = $props.Artist
                album    = $props.AlbumTitle
                playing  = $playing
                position = [math]::Round($pos, 2)
                duration = [math]::Round($dur, 2)
                canNext  = [bool]$info.Controls.IsNextEnabled
                canPrev  = [bool]$info.Controls.IsPreviousEnabled
                canSeek  = [bool]$info.Controls.IsPlaybackPositionEnabled
            }
            if ($sendThumb) { $msg.thumb = $thumb }
            Emit $msg
        }
    } catch {
        # Errores transitorios de WinRT (sesión cerrándose, etc.): reintentar.
    }
    Start-Sleep -Milliseconds 500
}
