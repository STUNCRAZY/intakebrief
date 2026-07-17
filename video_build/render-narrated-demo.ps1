$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $PSScriptRoot 'raw_recording'
$clips = Join-Path $PSScriptRoot 'clips'
$source = Join-Path $raw 'take-13-user-screen-recording.mp4'
$emailEvidence = Join-Path $raw 'emails-composite.png'
$narration = Join-Path $PSScriptRoot 'narration\intakebrief-voiceover.mp3'
$silentOutput = Join-Path $PSScriptRoot 'intakebrief-contact-form-demo-silent.mp4'
$output = Join-Path $PSScriptRoot 'intakebrief-contact-form-demo.mp4'
$publicOutput = Join-Path $root 'public\how-it-works.mp4'
$concatFile = Join-Path $PSScriptRoot 'concat.txt'

foreach ($required in @($source, $emailEvidence, $narration, $concatFile)) {
  if (-not (Test-Path $required)) { throw "Missing required video input: $required" }
}
New-Item -ItemType Directory -Force $clips | Out-Null

function Invoke-FFmpeg {
  param([string[]]$Arguments)
  & ffmpeg @Arguments
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed with exit code $LASTEXITCODE" }
}

function New-TitleCard {
  param([string]$OutputPath, [double]$Duration, [string]$Heading, [string]$Subheading)
  $filter = "drawbox=x=0:y=0:w=1920:h=18:color=0x7E2431:t=fill," +
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='INTAKEBRIEF':fontcolor=0x7E2431:fontsize=38:x=(w-text_w)/2:y=300," +
    "drawtext=fontfile='C\:/Windows/Fonts/georgiab.ttf':text='$Heading':fontcolor=0x102A23:fontsize=68:x=(w-text_w)/2:y=415," +
    "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='$Subheading':fontcolor=0x52635D:fontsize=32:x=(w-text_w)/2:y=525"
  Invoke-FFmpeg @('-y', '-v', 'warning', '-f', 'lavfi', '-i', "color=c=#F6F0E5:s=1920x1080:r=30:d=$Duration", '-vf', $filter, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', $OutputPath)
}

function New-SourceClip {
  param(
    [double]$Start,
    [double]$Duration,
    [double]$Speed,
    [string]$Caption,
    [string]$OutputName,
    [ValidateSet('none', 'form', 'result', 'checkout')][string]$Mask = 'none'
  )
  $outputPath = Join-Path $clips $OutputName
  $safeCaption = $Caption.Replace("'", "\\'")
  $maskFilter = ''
  if ($Mask -eq 'form') {
    $maskFilter = ",drawbox=x=145:y=327:w=977:h=64:color=0xF6F0E5:t=fill,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='test.client@example.com':fontcolor=0x52635D:fontsize=30:x=166:y=345,drawbox=x=145:y=456:w=977:h=64:color=0xF6F0E5:t=fill,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='(555) 010-0199':fontcolor=0x52635D:fontsize=30:x=166:y=474"
  }
  if ($Mask -eq 'result') {
    $maskFilter = ",drawbox=x=145:y=160:w=500:h=46:color=0xF6F0E5:t=fill,drawbox=x=145:y=245:w=500:h=46:color=0xF6F0E5:t=fill"
  }
  if ($Mask -eq 'checkout') {
    $maskFilter = ",drawbox=x=1200:y=45:w=500:h=75:color=white:t=fill,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='test.checkout@example.com':fontcolor=0x52635D:fontsize=28:x=1220:y=72"
  }
  $filter = "scale=1750:1080:flags=lanczos,pad=1920:1080:85:0:color=0xF6F0E5,setpts=PTS/$Speed,fps=30" +
    $maskFilter +
    ",drawbox=x=0:y=930:w=1920:h=150:color=0x102A23@0.92:t=fill," +
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='$safeCaption':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=983"
  Invoke-FFmpeg @('-y', '-v', 'warning', '-ss', "$Start", '-t', "$Duration", '-i', $source, '-vf', $filter, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', $outputPath)
}

function New-EmailEvidenceClip {
  param(
    [int]$CropTop,
    [int]$CropHeight,
    [double]$Duration,
    [string]$Caption,
    [string]$OutputName
  )
  $outputPath = Join-Path $clips $OutputName
  $safeCaption = $Caption.Replace("'", "\\'")
  $filter = "crop=1182:${CropHeight}:0:${CropTop},scale=1720:-1:flags=lanczos,pad=1920:930:(ow-iw)/2:(oh-ih)/2:color=0xF6F0E5," +
    "drawbox=x=0:y=930:w=1920:h=150:color=0x102A23@0.92:t=fill," +
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='$safeCaption':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=983"
  Invoke-FFmpeg @('-y', '-v', 'warning', '-loop', '1', '-t', "$Duration", '-i', $emailEvidence, '-vf', $filter, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', $outputPath)
}

New-TitleCard (Join-Path $clips '00-title.mp4') 3.0 'From inquiry to confirmed consultation.' 'A real IntakeBrief test workflow'
New-SourceClip 24 30 3.5 '1  |  Secure intake. Brief, non-confidential details.' '01-form.mp4' 'form'
New-SourceClip 72 4 1.0 '2  |  Submitted once. Delivery and routing confirmed.' '02-delivery.mp4' 'result'
New-EmailEvidenceClip 0 112 3.0 '3  |  The firm receives the inquiry and matter routing.' '03-firm-email.mp4'
New-EmailEvidenceClip 220 397 6.0 '4  |  The client receives a reply matched to the inquiry.' '04-client-email.mp4'
New-SourceClip 74 9 1.6 '5  |  The client selects an available consultation time.' '05-slots.mp4'
New-SourceClip 80 7 1.5 '6  |  Stripe Sandbox presents the fixed $50 test deposit.' '06-checkout.mp4' 'checkout'
New-SourceClip 127 17 2.6 '7  |  Hosted checkout keeps payment details off the firm site.' '07-payment.mp4' 'checkout'
New-SourceClip 156 3.5 1.0 '8  |  The browser waits for signed webhook verification.' '08-verification.mp4'
New-EmailEvidenceClip 619 73 3.0 '9  |  Payment verified. Consultation confirmed.' '09-confirmation-email.mp4'
New-TitleCard (Join-Path $clips '10-end.mp4') 3.5 'One inquiry. One completed chain.' 'Qualified lead  |  Scheduled consultation  |  Verified deposit'

Invoke-FFmpeg @('-y', '-v', 'warning', '-f', 'concat', '-safe', '0', '-i', $concatFile, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $silentOutput)
Invoke-FFmpeg @('-y', '-v', 'warning', '-i', $silentOutput, '-i', $narration, '-filter_complex', '[1:a]atempo=0.78,apad=pad_dur=70[narration]', '-map', '0:v:0', '-map', '[narration]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', $output)
Copy-Item -LiteralPath $output -Destination $publicOutput -Force

Write-Host "Rendered: $output"
Write-Host "Published: $publicOutput"
