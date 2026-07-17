$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $PSScriptRoot 'raw_recording'
$clips = Join-Path $PSScriptRoot 'clips'
$emailSnapshots = Join-Path $PSScriptRoot 'email_snapshots'
$output = Join-Path $PSScriptRoot 'intakebrief-contact-form-demo.mp4'
$publicOutput = Join-Path $root 'public\how-it-works.mp4'

New-Item -ItemType Directory -Force $clips | Out-Null

function Invoke-FFmpeg {
  param([string[]]$Arguments)
  & ffmpeg @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed with exit code $LASTEXITCODE"
  }
}

function New-TitleCard {
  param(
    [string]$OutputPath,
    [double]$Duration,
    [string]$Filter
  )

  Invoke-FFmpeg @(
    '-y', '-v', 'warning',
    '-f', 'lavfi', '-i', "color=c=#F6F0E5:s=1920x1080:r=30:d=$Duration",
    '-vf', $Filter,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $OutputPath
  )
}

function New-DemoClip {
  param(
    [string]$InputName,
    [double]$Start,
    [double]$Duration,
    [double]$Speed,
    [string]$Caption,
    [string]$OutputName
  )

  $inputPath = Join-Path $raw $InputName
  $outputPath = Join-Path $clips $OutputName
  $safeCaption = $Caption.Replace("'", "\\'")
  $filter = "crop=1092:614:34:29,scale=1920:1080:flags=lanczos,setpts=PTS/$Speed,fps=30," +
    "drawbox=x=0:y=930:w=1920:h=150:color=0x102A23@0.92:t=fill," +
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='$safeCaption':fontcolor=white:fontsize=45:x=(w-text_w)/2:y=982"

  Invoke-FFmpeg @(
    '-y', '-v', 'warning',
    '-ss', "$Start", '-t', "$Duration", '-i', $inputPath,
    '-vf', $filter,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', $outputPath
  )
}

function New-EmailSnapshotClip {
  param(
    [string]$InputName,
    [double]$Duration,
    [int]$VerticalOffset,
    [string]$Caption,
    [string]$OutputName
  )

  $inputPath = Join-Path $emailSnapshots $InputName
  $outputPath = Join-Path $clips $OutputName
  $safeCaption = $Caption.Replace("'", "\\'")
  $filter = "[0:v]scale=1720:-1:flags=lanczos[shot];" +
    "color=c=#F6F0E5:s=1920x1080:r=30:d=$Duration[bg];" +
    "[bg][shot]overlay=x=(W-w)/2:y=${VerticalOffset}:shortest=1," +
    "drawbox=x=0:y=930:w=1920:h=150:color=0x102A23@0.92:t=fill," +
    "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='$safeCaption':fontcolor=white:fontsize=45:x=(w-text_w)/2:y=982"

  Invoke-FFmpeg @(
    '-y', '-v', 'warning', '-loop', '1', '-t', "$Duration", '-i', $inputPath,
    '-vf', $filter,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', $outputPath
  )
}

$titleFilter = "drawbox=x=0:y=0:w=1920:h=18:color=0x7E2431:t=fill," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='INTAKEBRIEF':fontcolor=0x7E2431:fontsize=38:x=(w-text_w)/2:y=310," +
  "drawtext=fontfile='C\:/Windows/Fonts/georgiab.ttf':text='A real inquiry. Start to finish.':fontcolor=0x102A23:fontsize=76:x=(w-text_w)/2:y=415," +
  "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='Guardianship test flow  |  contact form to confirmed consultation':fontcolor=0x52635D:fontsize=34:x=(w-text_w)/2:y=550"

$endFilter = "drawbox=x=0:y=0:w=1920:h=18:color=0x7E2431:t=fill," +
  "drawtext=fontfile='C\:/Windows/Fonts/georgiab.ttf':text='One inquiry. One completed chain.':fontcolor=0x102A23:fontsize=72:x=(w-text_w)/2:y=300," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='TOPICAL REPLY  -  TIME HELD  -  DEPOSIT VERIFIED':fontcolor=0x7E2431:fontsize=34:x=(w-text_w)/2:y=455," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='APPOINTMENT CONFIRMED':fontcolor=0x1F604A:fontsize=48:x=(w-text_w)/2:y=535"

New-TitleCard -OutputPath (Join-Path $clips '00-title.mp4') -Duration 2.5 -Filter $titleFilter

New-DemoClip 'take-02-clean-form-fill.mp4' 5 42 6 `
  '1  |  A visitor describes a guardianship issue. No documents attached.' '01-form.mp4'
New-DemoClip 'take-03-submit-and-result.mp4' 10 10 2.5 `
  '2  |  The inquiry is accepted and sent.' '02-submit.mp4'
New-DemoClip 'take-03-submit-and-result.mp4' 24 12 3 `
  '3  |  The system identifies guardianship with high confidence.' '03-routing.mp4'
New-EmailSnapshotClip 'firm-inquiry-alert.png' 4 280 `
  '4  |  The firm gets the inquiry and its guardianship routing.' '04-firm-email.mp4'
New-EmailSnapshotClip 'customer-topical-reply.png' 7 100 `
  '5  |  The customer receives a reply built around this inquiry.' '05-topical-email.mp4'
New-DemoClip 'take-04-slot-hold-and-checkout.mp4' 4 12 2.4 `
  '6  |  The customer selects an available consultation time.' '06-slot.mp4'
New-DemoClip 'take-05-checkout-form.mp4' 14 30 4.3 `
  '7  |  Stripe Sandbox collects the $50 reservation deposit.' '07-checkout.mp4'
New-DemoClip 'take-06-payment-and-confirmation.mp4' 0 5 1.7 `
  '8  |  Stripe returns the completed test deposit.' '08-payment.mp4'
New-DemoClip 'take-06-payment-and-confirmation.mp4' 84 12 3 `
  '9  |  The browser waits for signed webhook verification.' '09-verifying.mp4'
New-EmailSnapshotClip 'appointment-confirmed.png' 4 380 `
  '10  |  Payment verified. Consultation confirmed.' '10-confirmed.mp4'

New-TitleCard -OutputPath (Join-Path $clips '11-end.mp4') -Duration 3.5 -Filter $endFilter

$concatFile = Join-Path $PSScriptRoot 'concat.txt'
Invoke-FFmpeg @(
  '-y', '-v', 'warning', '-f', 'concat', '-safe', '0', '-i', $concatFile,
  '-c', 'copy', '-movflags', '+faststart', $output
)

Copy-Item -LiteralPath $output -Destination $publicOutput -Force

Write-Host "Rendered: $output"
Write-Host "Published: $publicOutput"
