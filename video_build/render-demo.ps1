$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$raw = Join-Path $PSScriptRoot 'raw_recording'
$clips = Join-Path $PSScriptRoot 'clips'
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

$titleFilter = "drawbox=x=0:y=0:w=1920:h=18:color=0x7E2431:t=fill," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='INTAKEBRIEF':fontcolor=0x7E2431:fontsize=38:x=(w-text_w)/2:y=310," +
  "drawtext=fontfile='C\:/Windows/Fonts/georgiab.ttf':text='A real inquiry. Start to finish.':fontcolor=0x102A23:fontsize=76:x=(w-text_w)/2:y=415," +
  "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='Guardianship test flow  |  contact form to confirmed consultation':fontcolor=0x52635D:fontsize=34:x=(w-text_w)/2:y=550"

$endFilter = "drawbox=x=0:y=0:w=1920:h=18:color=0x7E2431:t=fill," +
  "drawtext=fontfile='C\:/Windows/Fonts/georgiab.ttf':text='One inquiry. One completed chain.':fontcolor=0x102A23:fontsize=72:x=(w-text_w)/2:y=300," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='TOPICAL REPLY  -  TIME HELD  -  DEPOSIT VERIFIED':fontcolor=0x7E2431:fontsize=34:x=(w-text_w)/2:y=455," +
  "drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='APPOINTMENT CONFIRMED':fontcolor=0x1F604A:fontsize=48:x=(w-text_w)/2:y=535"

New-TitleCard -OutputPath (Join-Path $clips '00-title.mp4') -Duration 2.5 -Filter $titleFilter

New-DemoClip 'take-02-clean-form-fill.mp4' 5 52 5 `
  '1  |  A short, non-confidential guardianship inquiry.' '01-form.mp4'
New-DemoClip 'take-03-submit-and-result.mp4' 10 14 2 `
  '2  |  One click starts the intake workflow.' '02-submit.mp4'
New-DemoClip 'take-03-submit-and-result.mp4' 24 25 3 `
  '3  |  Routed as guardianship - high confidence.' '03-routing.mp4'
New-DemoClip 'take-09-firm-notification.mp4' 0 14 2 `
  '4  |  The firm receives the real inquiry.' '04-firm-email.mp4'
New-DemoClip 'take-08-topical-email.mp4' 0 17 2 `
  '5  |  The client reply is topical, not generic.' '05-topical-email.mp4'
New-DemoClip 'take-04-slot-hold-and-checkout.mp4' 4 18 1.8 `
  '6  |  Real availability. A 15-minute hold.' '06-slot.mp4'
New-DemoClip 'take-05-checkout-form.mp4' 14 60 4.5 `
  '7  |  Stripe test checkout reserves the consultation.' '07-checkout.mp4'
New-DemoClip 'take-06-payment-and-confirmation.mp4' 0 6 1.5 `
  '8  |  A verified $50 sandbox deposit.' '08-payment.mp4'
New-DemoClip 'take-06-payment-and-confirmation.mp4' 84 17 3.4 `
  '9  |  The redirect alone does not confirm the booking.' '09-verifying.mp4'
New-DemoClip 'take-07-confirmation-email.mp4' 0 17 1.7 `
  '10  |  Webhook verified. Appointment confirmed.' '10-confirmed.mp4'

New-TitleCard -OutputPath (Join-Path $clips '11-end.mp4') -Duration 3.5 -Filter $endFilter

$concatFile = Join-Path $PSScriptRoot 'concat.txt'
Invoke-FFmpeg @(
  '-y', '-v', 'warning', '-f', 'concat', '-safe', '0', '-i', $concatFile,
  '-c', 'copy', '-movflags', '+faststart', $output
)

Copy-Item -LiteralPath $output -Destination $publicOutput -Force

Write-Host "Rendered: $output"
Write-Host "Published: $publicOutput"
