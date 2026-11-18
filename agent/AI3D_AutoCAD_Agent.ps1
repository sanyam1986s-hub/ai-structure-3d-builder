# =====================================================================
#  AI Structure 3D Builder - AutoCAD Agent  (v1.1 - live status window)
#  Watches a folder for drawing jobs exported by the web app
#  (*AI3D2D*.lsp  or  *AI3D2D*_lsp.txt), opens AutoCAD, creates a new
#  drawing, runs the job (command AI3D2D) and saves it as DWG.
#  Run with Windows PowerShell 5.1:  AI3D_AutoCAD_Agent.bat
# =====================================================================
param(
  [string]$Watch    = (Join-Path $env:USERPROFILE 'Downloads'),
  [string]$OutDir   = 'D:\Claude_Project\AI3D_DWG',
  [string]$Template = '',
  [int]$Poll        = 2,
  [switch]$Once,
  [switch]$NoGui
)
$ErrorActionPreference = 'Stop'
$Sig  = ';;; AI Structure 3D Builder'
$Done = Join-Path $Watch 'ai3d_done'
$Tmp  = Join-Path $env:TEMP 'ai3d'
foreach($d in @($OutDir,$Done,$Tmp)){ if(-not (Test-Path -LiteralPath $d)){ New-Item -ItemType Directory -Path $d -Force | Out-Null } }

function Log([string]$m,[string]$c='Gray'){ $line=('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'),$m); Write-Host $line -ForegroundColor $c
  if($Ui){ [void]$Ui.Log.Items.Add($line); $Ui.Log.TopIndex=[Math]::Max(0,$Ui.Log.Items.Count-1); [Windows.Forms.Application]::DoEvents() } }
# ---------------- live status window (Agent Mode) ----------------
$Ui = $null
if(-not $NoGui){
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.Form
    $f.Text = 'AI3D AutoCAD Agent - Agent Mode'; $f.Width = 760; $f.Height = 520; $f.TopMost = $true
    $f.BackColor = [Drawing.Color]::FromArgb(2,6,23); $f.ForeColor = [Drawing.Color]::FromArgb(207,250,254)
    $f.Font = New-Object Drawing.Font('Segoe UI',10)
    $hd = New-Object Windows.Forms.Label; $hd.Text = 'AI AGENT MODE  -  waiting for jobs'; $hd.Dock = 'Top'; $hd.Height = 34
    $hd.Font = New-Object Drawing.Font('Segoe UI',13,[Drawing.FontStyle]::Bold); $hd.ForeColor = [Drawing.Color]::FromArgb(103,232,249)
    $job = New-Object Windows.Forms.Label; $job.Text = ('Watching: ' + $Watch + '   |   DWG: ' + $OutDir); $job.Dock = 'Top'; $job.Height = 24
    $steps = New-Object Windows.Forms.Label; $steps.Dock = 'Top'; $steps.Height = 46; $steps.Font = New-Object Drawing.Font('Consolas',10)
    $pb = New-Object Windows.Forms.ProgressBar; $pb.Dock = 'Top'; $pb.Height = 16; $pb.Minimum = 0; $pb.Maximum = 100
    $lb = New-Object Windows.Forms.ListBox; $lb.Dock = 'Fill'; $lb.BackColor = [Drawing.Color]::Black; $lb.ForeColor = [Drawing.Color]::FromArgb(134,239,172)
    $lb.Font = New-Object Drawing.Font('Consolas',9); $lb.BorderStyle = 'None'
    $f.Controls.Add($lb); $f.Controls.Add($pb); $f.Controls.Add($steps); $f.Controls.Add($job); $f.Controls.Add($hd)
    $f.Show(); [Windows.Forms.Application]::DoEvents()
    $Ui = @{ Form=$f; Head=$hd; Job=$job; Steps=$steps; Bar=$pb; Log=$lb }
  } catch { $Ui = $null }
}
$StepNames = @('Connect AutoCAD','New drawing','Load job','Draw (AI3D2D)','Save DWG')
function Pump{ if($Ui){ [Windows.Forms.Application]::DoEvents() } }
function Pause-Ui([int]$ms){ $end=(Get-Date).AddMilliseconds($ms); while((Get-Date) -lt $end){ Pump; Start-Sleep -Milliseconds 100 } }
function Set-Step([int]$i,[string]$head){
  if(-not $Ui){ return }
  $txt = ''
  for($k=0; $k -lt $StepNames.Count; $k++){ $mark = if($k -lt $i){'[OK]'} elseif($k -eq $i){'[>>]'} else {'[  ]'}; $txt += ($mark + ' ' + $StepNames[$k] + '   ') }
  $Ui.Steps.Text = $txt
  if($i -ge $StepNames.Count){ $Ui.Bar.Style='Continuous'; $Ui.Bar.Value=100 }
  elseif($i -eq 3){ $Ui.Bar.Style='Marquee' } else { $Ui.Bar.Style='Continuous'; $Ui.Bar.Value=[int](100*$i/$StepNames.Count) }
  if($head){ $Ui.Head.Text = $head }
  Pump
}


# AutoCAD rejects COM calls while it is busy -> retry
function Invoke-Retry([scriptblock]$Block,[int]$Tries=120){
  for($i=0; $i -lt $Tries; $i++){
    try { return (& $Block) }
    catch {
      $msg = $_.Exception.Message
      if($msg -match 'rejected|busy|0x8001010A|0x80010001|RPC_E_'){ Pause-Ui 500 } else { throw }
    }
  }
  throw 'AutoCAD stayed busy for too long'
}
function Wait-Idle($Acad,[int]$Seconds=600){
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while($sw.Elapsed.TotalSeconds -lt $Seconds){
    try { if($Acad.GetAcadState().IsQuiescent){ return } } catch {}
    Pause-Ui 500
  }
  throw 'Timeout waiting for AutoCAD to become idle'
}
function Get-AutoCAD{
  $a = $null
  try { $a = [Runtime.InteropServices.Marshal]::GetActiveObject('AutoCAD.Application'); Log 'Connected to running AutoCAD' 'Cyan' }
  catch { Log 'Starting AutoCAD ... (first start can take a minute)' 'Yellow'; $a = New-Object -ComObject 'AutoCAD.Application' }
  Invoke-Retry { $a.Visible = $true } | Out-Null
  Wait-Idle $a 300
  return $a
}
function Invoke-Job($File){
  $first = Get-Content -LiteralPath $File.FullName -TotalCount 1
  if(-not $first -or -not $first.StartsWith($Sig)){
    Log ('Skip (not an AI3D job): ' + $File.Name) 'DarkYellow'
    Move-Item -LiteralPath $File.FullName -Destination (Join-Path $Done ('skipped_' + $File.Name)) -Force
    return
  }
  $name = [IO.Path]::GetFileNameWithoutExtension($File.Name) -replace '_lsp$',''
  $lsp  = Join-Path $Tmp 'ai3d_job.lsp'
  Copy-Item -LiteralPath $File.FullName -Destination $lsp -Force

  Set-Step 0 ('AI AGENT MODE  -  ' + $name)
  if($Ui){ $Ui.Job.Text = ('Job: ' + $File.Name) }
  $acad = Get-AutoCAD
  Set-Step 1
  $doc  = Invoke-Retry { if($Template){ $acad.Documents.Add($Template) } else { $acad.Documents.Add() } }
  Invoke-Retry { $doc.Activate() } | Out-Null
  Wait-Idle $acad
  # trust the temp folder so SECURELOAD does not block the job file
  try {
    $tp = [string](Invoke-Retry { $doc.GetVariable('TRUSTEDPATHS') })
    if($tp -notlike ('*' + $Tmp + '*')){ Invoke-Retry { $doc.SetVariable('TRUSTEDPATHS', (($tp.TrimEnd(';') + ';' + $Tmp).TrimStart(';'))) } | Out-Null }
  } catch { Log 'Note: could not set TRUSTEDPATHS (AutoCAD may ask to allow loading - click Load)' 'DarkYellow' }

  Set-Step 2
  $p = $lsp -replace '\\','/'
  Log ('Drawing  ' + $name + ' ...') 'Green'
  $n = @(Select-String -LiteralPath $lsp -Pattern '^\s+\(ai:' ).Count
  Log ('Entities to draw: ' + $n)
  Set-Step 3
  Invoke-Retry { $doc.SendCommand('(load "' + $p + '") AI3D2D ') } | Out-Null
  Pause-Ui 1000
  Wait-Idle $acad 1800
  try { Log ('Model space objects: ' + (Invoke-Retry { $doc.ModelSpace.Count })) 'Cyan' } catch {}
  Set-Step 4

  $dwg = Join-Path $OutDir ($name + '.dwg')
  Invoke-Retry { $doc.SaveAs($dwg) } | Out-Null
  Log ('Saved    ' + $dwg) 'Cyan'
  Set-Step 5 'AI AGENT MODE  -  done, waiting for next job'
  Move-Item -LiteralPath $File.FullName -Destination (Join-Path $Done $File.Name) -Force
}

Write-Host ''
Write-Host '  AI Structure 3D Builder - AutoCAD Agent' -ForegroundColor Cyan
Log ('Watching : ' + $Watch)
Log ('DWG out  : ' + $OutDir)
Log 'In the web app: tab "AutoCAD 2D" -> "AI Agent: open AutoCAD and draw".  Ctrl+C to stop.'
while($true){
  $jobs = @(Get-ChildItem -LiteralPath $Watch -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'AI3D2D' -and $_.Name -match '(\.lsp|_lsp\.txt)$' } |
            Sort-Object LastWriteTime)
  foreach($f in $jobs){
    $s1 = $f.Length; Start-Sleep -Milliseconds 500; $f.Refresh()
    if($f.Length -ne $s1 -or $f.Length -eq 0){ continue }
    Pump   # still downloading
    try { Invoke-Job $f }
    catch {
      Log ('ERROR ' + $f.Name + ': ' + $_.Exception.Message) 'Red'
      Move-Item -LiteralPath $f.FullName -Destination (Join-Path $Done ('failed_' + $f.Name)) -Force -ErrorAction SilentlyContinue
    }
  }
  if($Once){ break }
  if($Ui -and -not $Ui.Form.Visible){ break }
  Pause-Ui ($Poll*1000)
}
