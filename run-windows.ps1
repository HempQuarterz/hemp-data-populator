# PowerShell script to run the hemp data populator
$ErrorActionPreference = "Stop"

# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment from: $envFile"
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#]+?)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Error ".env file not found at: $envFile"
    exit 1
}

# Verify environment variables are loaded
Write-Host "SUPABASE_URL: $($env:SUPABASE_URL ? 'Loaded' : 'Not loaded')"
Write-Host "SUPABASE_SERVICE_ROLE_KEY: $($env:SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not loaded')"

# Run the application
Write-Host "`nStarting Hemp Data Populator...`n"
npx tsx src/index.ts --mode=once