$urls = 'index.html','player.html?id=bunny','styles.css','videos.js','app.js','player.js'
foreach ($u in $urls) {
  try {
    $resp = Invoke-WebRequest -Uri ('http://127.0.0.1:8765/' + $u) -UseBasicParsing -TimeoutSec 5
    '{0,-26} {1}  {2} bytes' -f $u, [int]$resp.StatusCode, $resp.RawContentLength
  } catch {
    '{0,-26} ERROR  {1}' -f $u, $_.Exception.Message
  }
}

# Sanity check: ensure player.html actually returns the expected hooks
$page = (Invoke-WebRequest -Uri 'http://127.0.0.1:8765/player.html?id=bunny' -UseBasicParsing).Content
'contains <video id=videoPlayer>: ' + ($page -match 'id="videoPlayer"')
'contains player.js script tag : ' + ($page -match 'src="player\.js"')

# Sanity check: videos.js actually exposes window.VIDEOS
$vjs = (Invoke-WebRequest -Uri 'http://127.0.0.1:8765/videos.js' -UseBasicParsing).Content
'videos.js exports VIDEOS     : ' + ($vjs -match 'window\.VIDEOS')
