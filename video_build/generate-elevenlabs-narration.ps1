$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env.local'
$scriptPath = Join-Path $PSScriptRoot 'narration-script.txt'
$outputDirectory = Join-Path $PSScriptRoot 'narration'
$outputPath = Join-Path $outputDirectory 'intakebrief-voiceover.mp3'

if (-not (Test-Path $envPath)) {
  throw 'Missing .env.local. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID locally.'
}
if (-not (Test-Path $scriptPath)) {
  throw "Missing narration script: $scriptPath"
}

$settings = @{}
foreach ($line in Get-Content $envPath) {
  if ($line -match '^([^#=]+)=(.*)$') {
    $settings[$matches[1].Trim()] = $matches[2].Trim()
  }
}

$apiKey = $settings['ELEVENLABS_API_KEY']
$voiceId = $settings['ELEVENLABS_VOICE_ID']
$modelId = $settings['ELEVENLABS_MODEL_ID']
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'ELEVENLABS_API_KEY is missing in .env.local.' }
if ([string]::IsNullOrWhiteSpace($voiceId)) { throw 'ELEVENLABS_VOICE_ID is missing in .env.local.' }
# A voice label is not a model id. Fall back safely when a human-readable
# voice name was entered in this optional field.
if ([string]::IsNullOrWhiteSpace($modelId) -or $modelId -notmatch '^eleven_') {
  $modelId = 'eleven_multilingual_v2'
}

New-Item -ItemType Directory -Force $outputDirectory | Out-Null
$uri = 'https://api.elevenlabs.io/v1/text-to-speech/{0}?output_format=mp3_44100_128' -f $voiceId
$body = @{
  text = (Get-Content -Raw $scriptPath).Trim()
  model_id = $modelId
  voice_settings = @{
    stability = 0.68
    similarity_boost = 0.72
  }
} | ConvertTo-Json -Depth 4 -Compress
Write-Host "Generating ElevenLabs narration with model $modelId ($((Get-Content -Raw $scriptPath).Trim().Length) characters)."

try {
  Invoke-WebRequest `
    -Method Post `
    -Uri $uri `
    -Headers @{ 'xi-api-key' = $apiKey; Accept = 'audio/mpeg' } `
    -ContentType 'application/json' `
    -Body $body `
    -OutFile $outputPath | Out-Null
} catch {
  $detail = $_.Exception.Message
  if ($_.Exception.Response) {
    $response = $_.Exception.Response
    if ($response.Content) {
      try { $detail = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { }
    } else {
      $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
      try { $detail = $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
  }
  throw "ElevenLabs narration request failed: $detail"
}

if ((Get-Item $outputPath).Length -lt 1024) {
  throw 'ElevenLabs returned an unexpectedly small audio file.'
}

Write-Host "Narration generated: $outputPath"
