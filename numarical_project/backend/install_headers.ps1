# Helper script: copy headers from cloned repos into include folder
$Base = "$PSScriptRoot"
$CrowRepo = Join-Path $Base ".tmp_crow"
$JsonRepo = Join-Path $Base ".tmp_json"
$DestInclude = Join-Path $Base "include"
$DestNloh = Join-Path $DestInclude "nlohmann"

Write-Output "Base: $Base"
if (-not (Test-Path $DestInclude)) { New-Item -ItemType Directory -Path $DestInclude -Force | Out-Null }
if (-not (Test-Path $DestNloh)) { New-Item -ItemType Directory -Path $DestNloh -Force | Out-Null }

# Copy Crow include directory (fallback to its include folder)
$crowIncludeSrc = Join-Path $CrowRepo 'include'
if (Test-Path $crowIncludeSrc) {
    # Copy crow.h and the crow directory into our include
    Copy-Item -Path (Join-Path $crowIncludeSrc 'crow.h') -Destination (Join-Path $DestInclude 'crow.h') -Force
    Copy-Item -Path (Join-Path $crowIncludeSrc 'crow') -Destination (Join-Path $DestInclude 'crow') -Recurse -Force
    Write-Output "Copied Crow include files from $crowIncludeSrc"
} else {
    Write-Error "Crow include folder not found in $CrowRepo"
    exit 1
}

 $jsonFile = Join-Path $JsonRepo 'single_include\nlohmann\json.hpp'
 if (Test-Path $jsonFile) {
     Copy-Item -Path $jsonFile -Destination (Join-Path $DestNloh 'json.hpp') -Force
     Write-Output "Copied json.hpp"
 } else {
     Write-Error "json.hpp not found at $jsonFile"
     exit 1
 }

if ((Test-Path (Join-Path $DestInclude 'crow_all.h')) -and (Test-Path (Join-Path $DestNloh 'json.hpp'))) {
    Write-Output "Headers installed successfully"
} else {
    Write-Error "Header installation failed"
    exit 1
}
